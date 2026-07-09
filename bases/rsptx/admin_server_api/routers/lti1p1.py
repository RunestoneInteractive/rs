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
from typing import Optional

# Third-party imports
# -------------------
import oauth2
from fastapi import APIRouter, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates
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
    fetch_one_assignment,
    fetch_user,
    update_user,
    upsert_lti1p1_grade_link,
    upsert_practice_grade_link,
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
from rsptx.templates import template_folder

from .lti1p3 import add_w2py_session_cookie, get_domain, get_web2py_session_cookie

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
    templates = Jinja2Templates(directory=template_folder)
    context = {"request": request, "lti_errors": errors}
    return templates.TemplateResponse(
        "admin/lti1p1/launch_error.html", context, status_code=400
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
    course_id = param_converter(params.get("custom_course_id", None))

    if course_id:
        # Allow the course_id to be either a number or the course name.
        try:
            course_id = int(course_id)
        except ValueError:
            cname = course_id
            course = await fetch_course(cname)
            if course:
                course_id = course.id
            else:
                rslogger.error(f"LTI1.1 - invalid course name: {cname}")
                return _render_error(
                    request, [f"Invalid course name: {cname} LTI not launched."]
                )

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

    # Create / update / login the user.
    userinfo = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "username": email,
    }
    user, is_new_enrollment = await _login_or_create_user(
        userinfo, course_id, instructor
    )
    if user is None:
        return _render_error(request, ["Unable to create user record"])

    # In academy mode, a brand-new enrollment is sent to the donation/payment
    # flow (still served by web2py) rather than straight into the course.
    domain = get_domain()
    if is_new_enrollment and settings.academy_mode:
        redirect_to = f"https://{domain}/runestone/default/index"
        return await _finalize_login(user, redirect_to)

    # Content-item selection (deep linking).
    if message_type == "ContentItemSelectionRequest":
        return await _provide_assignment_list(params, course_id, lti_record)

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
            return _render_error(
                request,
                [f"{error} {assignment_id}; please contact your instructor."],
            )
        return await _finalize_login(user, redirect_to)

    # Practice launch.
    if practice:
        redirect_to = await _launch_practice(
            outcome_url, result_source_did, user, course_id, domain
        )
        return await _finalize_login(user, redirect_to)

    # Optional custom redirect within the book.
    redirect_url = params.get("redirect", None)
    if redirect_url:
        if isinstance(redirect_url, list):
            redirect_url = redirect_url[0]
        if redirect_url.startswith("/") or redirect_url.startswith("http"):
            return _render_error(request, ["Invalid redirect URL"])
        redirect_to = f"https://{domain}/{redirect_url}"
        return await _finalize_login(user, redirect_to)

    # Otherwise, send them to their course.
    redirect_to = f"https://{domain}/ns/course/index"
    return await _finalize_login(user, redirect_to)


async def _login_or_create_user(
    userinfo: dict, course_id: Optional[int], instructor: bool
) -> tuple[Optional[AuthUserValidator], bool]:
    """
    Find or create the Runestone user for this launch, provision course and
    instructor membership, and return (user, is_new_enrollment).
    """
    user = await fetch_user(userinfo["email"], fallback_to_registration=True)

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
        if course_id:
            course = await fetch_course_by_id(course_id)
            user_dict["course_id"] = course_id
            user_dict["course_name"] = course.course_name
        try:
            new_user = AuthUserValidator(**user_dict)
            user = await create_user(new_user)
            rslogger.info(f"LTI1.1 - created user {user.username} ({user.id})")
        except (ValidationError, Exception) as e:
            rslogger.error(f"LTI1.1 - error creating user: {e}")
            return None, False

    is_new_enrollment = False
    if course_id:
        course = await fetch_course_by_id(course_id)
        # Keep course_id/course_name current (verifyInstructor uses course_name).
        await update_user(
            user.id, {"course_id": course_id, "course_name": course.course_name}
        )

        # Update instructor status.
        if instructor:
            await create_instructor_course_entry(user.id, course_id)
        else:
            await delete_course_instructor(course_id, user.id)

        # Ensure enrollment.
        in_course = await user_in_course(user.id, course_id)
        if not in_course:
            is_new_enrollment = True
            # In academy mode we defer enrollment to the donation flow; otherwise
            # enroll now.
            if not settings.academy_mode:
                await create_user_course_entry(user.id, course_id)

    return user, is_new_enrollment


async def _finalize_login(user: AuthUserValidator, redirect_to: str) -> Response:
    """
    Set the Runestone JWT cookie (and the web2py session cookie for pages still
    served by web2py) on a redirect response.
    """
    response = RedirectResponse(redirect_to, status_code=status.HTTP_303_SEE_OTHER)
    access_token = auth_manager.create_access_token(
        data={"sub": user.username}, expires=datetime.timedelta(hours=12)
    )
    auth_manager.set_cookie(response, access_token)
    reg_id = user.registration_id or user.username
    web2py_session_cookie = await get_web2py_session_cookie(reg_id)
    if web2py_session_cookie:
        add_w2py_session_cookie(response, web2py_session_cookie)
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

    assignment = await fetch_one_assignment(assignment_id)
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


async def _launch_practice(
    outcome_url, result_source_did, user, course_id, domain
) -> str:
    """Record practice grade passback info and return the practice redirect URL."""
    course = await fetch_course_by_id(course_id)
    await upsert_practice_grade_link(
        user.id, course.course_name, result_source_did, outcome_url
    )
    return (
        f"https://{domain}/runestone/assignments/settz_then_practice"
        f"?course_name={course.course_name}"
    )


async def _provide_assignment_list(
    params: dict, course_id: int, lti_record
) -> HTMLResponse:
    """
    Deep-linking (ContentItemSelection): return an auto-submitting form listing
    the course's assignments, signed with the consumer key/secret, per
    https://www.imsglobal.org/specs/lticiv1p0/specification
    """
    consumer = oauth2.Consumer(lti_record.consumer, lti_record.secret)
    return_url = params.get("content_item_return_url")
    extra_data = params.get("data", None)

    course = await fetch_course_by_id(course_id)
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
                    "custom_course_id": course_id,
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
