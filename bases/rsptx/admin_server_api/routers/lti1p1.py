# *************************
# |docname| - LTI 1.1 API
# *************************
# This module implements the LTI 1.1 launch endpoint, ported from the legacy
# web2py controller ``applications/runestone/controllers/lti.py``. It handles an
# OAuth1-signed launch from an LMS: verify the signature, create/login the user,
# provision the course/instructor, and dispatch to an assignment, the practice
# tool, a deep-linking (ContentItemSelection) response, or the book.
#
# Imports
# =======
# Standard library
# ----------------
import datetime
import html
import json
import time
import uuid
from urllib.parse import quote, urlsplit
from typing import Optional

# Third-party imports
# -------------------
import oauth2
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from pydantic import ValidationError

# Local application imports
# -------------------------
from rsptx.auth.session import auth_manager
from rsptx.configuration import settings
from rsptx.db.crud import (
    create_instructor_course_entry,
    create_user,
    create_user_course_entry,
    delete_course_instructor,
    fetch_assignments,
    fetch_course,
    fetch_course_by_id,
    fetch_lti1p1_config_by_consumer,
    fetch_lti1p1_course_ids,
    fetch_one_assignment,
    fetch_user,
    update_user,
    upsert_lti1p1_grade_link,
    user_in_course,
)
from rsptx.db.models import AuthUserValidator
from rsptx.lti1p1.core import (
    param_converter,
    send_lti1p1_grade,
    verify_lti1p1_signature,
)
from rsptx.logging import rslogger
from rsptx.response_helpers.core import canonical_utcnow
from rsptx.templates import get_shared_templates

from .lti1p3 import get_domain

# Routing
# =======
router = APIRouter(
    prefix="/lti1p1",
    tags=["lti1p1"],
)


async def _collect_params(request: Request) -> dict:
    """
    Merge query-string and form-body parameters into a single dict. LTI 1.1
    launches are normally POSTs with an ``application/x-www-form-urlencoded``
    body, but we accept GET as well.
    """
    params = dict(request.query_params)
    try:
        form = await request.form()
        for key in form:
            params[key] = form[key]
    except Exception:
        pass
    return params


def _launch_url(request: Request) -> str:
    """
    Reconstruct the external URL that the LMS signed. The signature base string
    excludes the query string. Because nginx rewrites ``/runestone/lti`` to
    ``/lti1p1``, the original path is carried in the ``X-Original-URI`` header
    (set in the proxy config); fall back to the request path otherwise.
    """
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("host", request.url.netloc)
    original_uri = request.headers.get("x-original-uri", request.url.path)
    path = original_uri.split("?")[0]
    return f"{proto}://{host}{path}"


def _render_error(request: Request, errors: list) -> HTMLResponse:
    """Render the LTI launch error page."""
    templates = get_shared_templates()
    context = {"request": request, "lti_errors": errors}
    return templates.TemplateResponse(
        "admin/lti1p1/launch_error.html", context, status_code=400
    )


def _render_retired(request: Request, feature: str, detail: str) -> HTMLResponse:
    """Explain that a launched feature no longer exists.

    An LMS keeps whatever link an instructor configured years ago, so retired
    features keep being launched. 200 rather than an error status: nothing went
    wrong, the destination simply does not exist any more, and an error page in
    an LMS iframe just generates support mail.
    """
    templates = get_shared_templates()
    return templates.TemplateResponse(
        "admin/lti1p1/retired.html",
        {"request": request, "feature": feature, "detail": detail},
    )


@router.get("")
@router.get("/")
@router.post("")
@router.post("/")
async def index(request: Request):
    """
    Main LTI 1.1 launch endpoint. Mirrors the web2py ``lti/index`` controller.
    """
    params = await _collect_params(request)

    user_id = params.get("user_id", None)
    last_name = params.get("lis_person_name_family", None)
    first_name = params.get("lis_person_name_given", None)
    full_name = params.get("lis_person_name_full", None)
    message_type = params.get("lti_message_type")
    # The course is resolved from the consumer key below, once the signature has
    # been verified; ``custom_course_id`` is only a fallback.
    param_course_id = param_converter(params.get("custom_course_id", None))

    if full_name and not last_name:
        names = full_name.strip().split()
        last_name = names[-1]
        first_name = " ".join(names[:-1])

    email = params.get("lis_person_contact_email_primary", None)
    roles = params.get("roles", "")
    if isinstance(roles, list):
        roles = " ".join(str(r) for r in roles)
    instructor = ("Instructor" in roles) or ("TeachingAssistant" in roles)
    result_source_did = params.get("lis_result_sourcedid", None)
    outcome_url = params.get("lis_outcome_service_url", None)
    # Deprecated: the non-compliant ``assignment_id``; prefer ``custom_assignment_id``.
    assignment_id = param_converter(
        params.get("custom_assignment_id", params.get("assignment_id", None))
    )
    practice = params.get("practice", None)

    # Validate the required user fields.
    if user_id is None:
        return _render_error(request, ["user_id is required for this tool to function"])
    if first_name is None:
        return _render_error(
            request, ["First Name is required for this tool to function"]
        )
    if last_name is None:
        return _render_error(
            request, ["Last Name is required for this tool to function"]
        )
    if email is None:
        return _render_error(request, ["Email is required for this tool to function"])

    # In the Canvas Student View the email may be empty; fall back to the user id.
    email = email or (user_id + "@junk.com")

    # Look up the consumer key and verify the OAuth signature.
    key = params.get("oauth_consumer_key", None)
    if key is None:
        return _render_error(request, ["Missing oauth_consumer_key"])
    lti_record = await fetch_lti1p1_config_by_consumer(key)
    if lti_record is None:
        return _render_error(request, ["Could not find oauth_consumer_key"])

    method = request.method
    launch_url = _launch_url(request)
    if not verify_lti1p1_signature(
        lti_record.consumer, lti_record.secret, method, launch_url, params
    ):
        return _render_error(request, ["OAuth Security Validation failed"])

    # Resolve the course. The key/secret pair was issued for a specific course,
    # so ``course_lti_map`` is authoritative and is preferred over the LMS's
    # ``custom_course_id``, which instructors routinely copy from another course
    # or forget to update when they copy a course in the LMS.
    course, course_error = await _resolve_course(lti_record, param_course_id)
    if course_error:
        return _render_error(request, [course_error])

    # Create / update / login the user.
    userinfo = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "username": email,
    }
    user, is_new_enrollment = await _login_or_create_user(userinfo, course, instructor)
    if user is None:
        return _render_error(request, ["Unable to create user record"])

    domain = get_domain()

    async def _send_to(redirect_to: str) -> Response:
        """Log the user in and send them to ``redirect_to``.

        In academy mode a brand-new enrollment is asked to support Runestone
        first. The ask goes *in front of* where they were headed rather than
        replacing it -- web2py did the same thing by stashing
        ``session.lti_url_next`` and honouring it after the donation page, so a
        student launching an assignment for the first time still lands on that
        assignment.
        """
        if is_new_enrollment and settings.academy_mode:
            # Hand on the *path*, not the absolute URL we just built: the donate
            # page only accepts a site-relative `next` (an absolute URL there
            # would be an open redirect), so passing the full URL would silently
            # discard the destination and strand the student on their course
            # page instead of the assignment they launched.
            parts = urlsplit(redirect_to)
            dest = parts.path + (f"?{parts.query}" if parts.query else "")
            redirect_to = f"https://{domain}/admin/auth/donate?next={quote(dest)}"
        return await _finalize_login(user, redirect_to)

    # Content-item selection (deep linking).
    if message_type == "ContentItemSelectionRequest":
        if course is None:
            return _render_error(
                request, ["This LTI key is not associated with a Runestone course."]
            )
        return await _provide_assignment_list(params, course, lti_record)

    # Assignment launch.
    if assignment_id:
        redirect_to, error = await _launch_assignment(
            assignment_id,
            user,
            result_source_did,
            outcome_url,
            lti_record,
            domain,
            is_instructor=instructor,
        )
        if error:
            # The link points at an assignment that is gone, or that belongs to
            # another course. The student cannot act on either, and an error
            # page inside an LMS iframe is a dead end -- log them in and drop
            # them on their course page, where the current assignment list is.
            # _launch_assignment has already logged the specifics.
            rslogger.info(
                f"LTI1.1 - {error} ({assignment_id}) for {user.username}; "
                "sending them to the course page"
            )
            return await _send_to(f"https://{domain}/ns/course/index")
        return await _send_to(redirect_to)

    # Practice launch. The practice tool has been retired; LMS courses still
    # have these links configured, so explain rather than error.
    if practice:
        return _render_retired(
            request,
            "Practice",
            "The Runestone practice tool has been retired and is no longer "
            "available. Your other course work is unaffected.",
        )

    # Optional custom redirect within the book.
    redirect_url = params.get("redirect", None)
    if redirect_url:
        if isinstance(redirect_url, list):
            redirect_url = redirect_url[0]
        if redirect_url.startswith("/") or redirect_url.startswith("http"):
            return _render_error(request, ["Invalid redirect URL"])
        redirect_to = f"https://{domain}/{redirect_url}"
        return await _send_to(redirect_to)

    # Otherwise, send them to their course.
    return await _send_to(f"https://{domain}/ns/course/index")


async def _resolve_course(lti_record, param_course_id):
    """
    Decide which Runestone course this launch is for.

    ``course_lti_map`` records the course the consumer key was issued for, and
    that is what we trust. ``custom_course_id`` is supplied by the LMS and is
    only consulted when the key is not mapped to exactly one course -- either
    because the mapping predates the key (older installs) or because an
    administrator pointed several courses at one key, in which case the LMS
    parameter is what distinguishes them.

    Returns the course row rather than just its id: everything downstream needs
    ``course_name`` as well, and resolving here means a mapping that points at a
    deleted course is caught once, in the one place that knows what to do about
    it, instead of raising an AttributeError further in.

    :return: (course, error_message); exactly one is non-None on a bad course,
        and (None, None) when the launch carries no course at all.
    """
    mapped = await fetch_lti1p1_course_ids(lti_record.id)

    # Resolve the LMS-supplied value, which may be an id or a course name.
    param_id = None
    if param_course_id:
        try:
            param_id = int(param_course_id)
        except ValueError:
            cname = str(param_course_id)
            course = await fetch_course(cname)
            if course:
                param_id = course.id
            elif not mapped:
                rslogger.error(f"LTI1.1 - invalid course name: {cname}")
                return None, f"Invalid course name: {cname} LTI not launched."
            else:
                rslogger.warning(
                    f"LTI1.1 - invalid course name {cname} from the LMS; using the "
                    f"course mapped to consumer key {lti_record.consumer}"
                )

    if len(mapped) == 1:
        course_id = mapped[0]
        if param_id is not None and param_id != course_id:
            rslogger.warning(
                f"LTI1.1 - LMS sent custom_course_id {param_id} but consumer key "
                f"{lti_record.consumer} is mapped to course {course_id}; using "
                "the mapped course"
            )
    elif len(mapped) > 1:
        # Ambiguous mapping: the LMS parameter is the only thing that can pick
        # one, and it must name a course the key is actually mapped to.
        if param_id not in mapped:
            rslogger.error(
                f"LTI1.1 - consumer key {lti_record.consumer} maps to courses "
                f"{mapped} but the LMS sent custom_course_id {param_id}"
            )
            return (
                None,
                "This LTI key is shared by several courses and the launch did not identify one of them.",
            )
        course_id = param_id
    else:
        # No mapping for this key -- fall back to whatever the LMS told us.
        if param_id is None:
            rslogger.error(
                f"LTI1.1 - no course mapped to consumer key {lti_record.consumer} "
                "and no custom_course_id in the launch"
            )
            return None, None
        course_id = param_id

    course = await fetch_course_by_id(course_id)
    if course is None:
        rslogger.error(
            f"LTI1.1 - course {course_id} for consumer key {lti_record.consumer} "
            "does not exist"
        )
        return None, f"Course {course_id} no longer exists. LTI not launched."
    return course, None


async def _login_or_create_user(
    userinfo: dict, course, instructor: bool
) -> tuple[Optional[AuthUserValidator], bool]:
    """
    Find or create the Runestone user for this launch, provision course and
    instructor membership, and return (user, is_new_enrollment).

    The returned user is guaranteed to carry the launched course: an LTI user
    typically has several Runestone courses, and every later request in this
    session -- as well as the assignment check in :func:`_launch_assignment` --
    reads ``course_id``/``course_name`` off this row.
    """
    course_id = course.id if course else None
    user = await fetch_user(userinfo["email"], fallback_to_registration=True)
    user_dict = {}
    if not user:
        user_dict = {
            "username": userinfo["username"],
            "first_name": userinfo["first_name"],
            "last_name": userinfo["last_name"],
            "email": userinfo["email"],
            "password": str(uuid.uuid4()),
            "created_on": canonical_utcnow(),
            "modified_on": canonical_utcnow(),
            "registration_key": "",
            "reset_password_key": "",
            "registration_id": userinfo["email"],
            "active": True,
            "donated": False,
            "accept_tcp": True,
        }
        if course:
            user_dict["course_id"] = course.id
            user_dict["course_name"] = course.course_name
        else:
            rslogger.error(
                f"LTI1.1 - missing course information for launch {user_dict}"
            )
        try:
            new_user = AuthUserValidator(**user_dict)
            user = await create_user(new_user)
            rslogger.info(f"LTI1.1 - created user {user.username} ({user.id})")
        except (ValidationError, Exception) as e:
            rslogger.error(f"LTI1.1 - error creating user: {e} user info: {user_dict}")
            return None, False

    is_new_enrollment = False
    if course:
        # Keep course_id/course_name current (verifyInstructor uses course_name).
        # The auth cookie only carries the username, so the course a request
        # runs in is whatever this row says -- switching it here is what makes
        # the redirect below land in the launched course rather than in
        # whichever course the user last visited.
        if user.course_id != course.id or user.course_name != course.course_name:
            await update_user(
                user.id, {"course_id": course.id, "course_name": course.course_name}
            )
            # ``update_user`` writes but hands nothing back, so the object we
            # were given is now stale in exactly the field we just changed.
            # Re-read it: _launch_assignment compares the assignment's course
            # against ``user.course_id``, and a stale value there rejects a
            # perfectly good assignment launch.
            user = await fetch_user(user.username, fallback_to_registration=True)
            if user is None:
                rslogger.error(
                    f"LTI1.1 - user {userinfo['username']} vanished while switching "
                    f"to course {course.course_name}"
                )
                return None, False

        # Update instructor status.
        if instructor:
            await create_instructor_course_entry(user.id, course_id)
        else:
            await delete_course_instructor(course_id, user.id)

        # Ensure enrollment. This used to be deferred to web2py's donation flow
        # in academy mode, which meant the student was never written to
        # user_courses here -- so user_in_course stayed False, is_new_enrollment
        # stayed True on every launch, and they were sent back to the donation
        # flow forever, never reaching their assignment. Enroll unconditionally;
        # academy mode now only decides whether we *ask for a donation on the
        # way*, which the caller handles.
        in_course = await user_in_course(user.id, course_id)
        if not in_course:
            is_new_enrollment = True
            await create_user_course_entry(user.id, course_id)

    return user, is_new_enrollment


async def _finalize_login(user: AuthUserValidator, redirect_to: str) -> Response:
    """
    Set the Runestone JWT cookie on a redirect response.
    """
    response = RedirectResponse(redirect_to, status_code=status.HTTP_303_SEE_OTHER)
    access_token = auth_manager.create_access_token(
        data={"sub": user.username}, expires=datetime.timedelta(hours=12)
    )
    auth_manager.set_cookie(response, access_token)
    rslogger.debug(f"LTI1.1 - sending user to {redirect_to}")
    return response


async def _launch_assignment(
    assignment_id,
    user,
    result_source_did,
    outcome_url,
    lti_record,
    domain,
    is_instructor=False,
) -> tuple[Optional[str], Optional[str]]:
    """
    Record the grade passback identifiers for the assignment, push the grade if
    it is already released and this is the first launch, and return the redirect
    URL. On failure returns (None, error_message).
    """
    try:
        assignment_id = int(assignment_id)
    except (TypeError, ValueError):
        return None, "Invalid assignment id"

    try:
        assignment = await fetch_one_assignment(assignment_id)
    except HTTPException:
        # fetch_one_assignment raises 404 rather than returning None. Letting
        # that propagate here would render a raw JSON error inside the LMS
        # iframe; an LTI link to a deleted assignment is an ordinary, expected
        # condition, so turn it back into the error tuple the caller handles.
        assignment = None
    if not assignment:
        return None, "Invalid assignment id"
    if assignment.course != user.course_id:
        rslogger.error(
            f"LTI1.1 - assignment {assignment_id} not in course {user.course_id} "
            f"for {user.username}"
        )
        return None, "Assignment not in course"

    # Record the grade passback URL/sourcedid; learn whether this is the first
    # launch of an already-scored, released assignment.
    score, first_link = await upsert_lti1p1_grade_link(
        user.id, assignment_id, result_source_did, outcome_url
    )
    if assignment.released and first_link and result_source_did and outcome_url:
        try:
            send_lti1p1_grade(
                assignment.points,
                score,
                lti_record.consumer,
                lti_record.secret,
                outcome_url,
                result_source_did,
            )
        except Exception as e:
            rslogger.error(f"LTI1.1 - grade passback on launch failed: {e}")

    if assignment.is_peer:
        if is_instructor:
            return (
                f"https://{domain}/assignment/peer/instructor/dashboard"
                f"?assignment_id={assignment_id}&next=Reset"
            ), None
        return (
            f"https://{domain}/assignment/peer/student/question"
            f"?assignment_id={assignment_id}"
        ), None

    return (
        f"https://{domain}/assignment/student/doAssignment"
        f"?assignment_id={assignment_id}"
    ), None


async def _provide_assignment_list(params: dict, course, lti_record) -> HTMLResponse:
    """
    Deep-linking (ContentItemSelection): return an auto-submitting form listing
    the course's assignments, signed with the consumer key/secret, per
    https://www.imsglobal.org/specs/lticiv1p0/specification
    """
    consumer = oauth2.Consumer(lti_record.consumer, lti_record.secret)
    return_url = params.get("content_item_return_url")
    extra_data = params.get("data", None)

    assignments = await fetch_assignments(course.course_name, fetch_all=True)
    graph = []
    for assignment in assignments:
        graph.append(
            {
                "@type": "LtiLinkItem",
                "mediaType": "application/vnd.ims.lti.v1.ltilink",
                "@id": assignment.id,
                "title": assignment.name,
                "text": assignment.description,
                "custom": {
                    "custom_course_id": course.id,
                    "assignment_id": assignment.id,
                },
            }
        )
    content_items = json.dumps(
        {
            "@context": "http://purl.imsglobal.org/ctx/lti/v1/ContentItem",
            "@graph": graph,
        }
    )

    rdict = {
        "oauth_timestamp": str(int(time.time())),
        "oauth_nonce": str(uuid.uuid1().int),
        "oauth_consumer_key": consumer.key,
        "oauth_signature_method": "HMAC-SHA1",
        "lti_message_type": "ContentItemSelection",
        "lti_version": "LTI-1p0",
        "oauth_version": "1.0",
        "oauth_callback": "about:blank",
        "content_items": content_items,
    }
    if extra_data:
        rdict["data"] = extra_data

    req = oauth2.Request.from_consumer_and_token(
        consumer,
        token=None,
        http_method="POST",
        http_url=return_url,
        parameters=rdict,
        is_form_encoded=True,
    )
    req.sign_request(oauth2.SignatureMethod_HMAC_SHA1(), consumer, None)
    rdict["oauth_signature"] = req["oauth_signature"].decode("utf8")
    rdict["return_url"] = return_url
    rdict["content_items"] = html.escape(content_items)

    tplate = """
    <!DOCTYPE html>
    <html>
    <body>
    <form name="storeForm" action="{return_url}" method="post" encType="application/x-www-form-urlencoded">
    <input type="hidden" name="lti_message_type" value="ContentItemSelection" />
    <input type="hidden" name="lti_version" value="LTI-1p0" />
    <input type="hidden" name="content_items" value="{content_items}" />
    """
    tplate += (
        """ <input type="hidden" name="data" value="{data}" /> """ if extra_data else ""
    )
    tplate += """
    <input type="hidden" name="oauth_version" value="1.0" />
    <input type="hidden" name="oauth_nonce" value="{oauth_nonce}" />
    <input type="hidden" name="oauth_timestamp" value="{oauth_timestamp}" />
    <input type="hidden" name="oauth_consumer_key" value="{oauth_consumer_key}" />
    <input type="hidden" name="oauth_callback" value="about:blank" />
    <input type="hidden" name="oauth_signature_method" value="HMAC-SHA1" />
    <input type="hidden" name="oauth_signature" value="{oauth_signature}" />
    </form>
    """
    tplate = tplate.format(**rdict)
    scpt = """
    <script type="text/javascript">
        window.onload=function(){
            setTimeout(function(){ document.forms["storeForm"].submit(); }, 1000);
        }
    </script>
    </body>
    </html>
    """
    return HTMLResponse(tplate + scpt)
