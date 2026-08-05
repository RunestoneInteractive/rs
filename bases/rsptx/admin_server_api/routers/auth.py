import datetime
import re
from datetime import timedelta

from fastapi import APIRouter, Form, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from pydal.validators import CRYPT

from rsptx.auth.email import send_email
from rsptx.auth.session import NotAuthenticatedException, auth_manager
from rsptx.configuration import settings
from rsptx.db.crud import (
    consume_reset_token,
    create_user,
    create_user_course_entry,
    delete_user_course_entry,
    fetch_course,
    fetch_courses_by_institution,
    fetch_courses_for_user,
    fetch_instructor_courses,
    fetch_last_course_access,
    fetch_library_books,
    fetch_user,
    fetch_user_by_email,
    set_reset_token,
    update_user,
    delete_user,
    user_in_course,
)
from rsptx.db.models import AuthUserValidator
from rsptx.logging import rslogger
from rsptx.response_helpers.core import canonical_utcnow
from rsptx.templates import get_shared_templates
from rsptx.validation.fields import clean_text, validate_password, validate_text_field

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

templates = get_shared_templates()

# All browser-facing URLs use /admin/auth/... (nginx routes /admin/auth/ → container /auth/)
_LOGIN = "/admin/auth/login"
_REGISTER = "/admin/auth/register"
_COURSES = "/admin/auth/courses"
_MY_COURSES = "/admin/auth/my_courses"
_PROFILE = "/admin/auth/profile"
_DONATE = "/admin/auth/donate"


def _verify_password(stored: str, plain: str) -> bool:
    if not stored:
        return False
    try:
        salt = stored.split("$")[1]
    except (IndexError, AttributeError):
        return False
    crypt = CRYPT(key=settings.web2py_private_key, salt=salt)
    return str(crypt(plain)[0]) == stored


def _user_exists(user) -> bool:
    """Return True only if fetch_user returned a real DB row (id is set)."""
    return bool(user and user.id)


# Usernames may be a plain handle or an email address. Allow letters, digits,
# underscore, and the characters that appear in email addresses (@ . - + %).
# Spaces and other special characters are rejected.
_USERNAME_RE = re.compile(r"^[A-Za-z0-9._@+%-]+$")


def _validate_username(username: str) -> str | None:
    """Return an error message if the username is invalid, else None."""
    if not username:
        return "Username is required."
    if not _USERNAME_RE.match(username):
        return (
            "Username may only contain letters, digits, and the characters "
            "@ . _ - + % (no spaces). An email address is allowed."
        )
    return None


def _safe_next(next: str, default: str = "/ns/course/index") -> str:
    """Return ``next`` only if it is a path on this site, else ``default``.

    ``next`` is attacker-controllable -- it arrives in a query string and ends
    up as a redirect target after a successful login. Anything that is not a
    site-relative path is discarded, which rules out absolute URLs
    (``https://evil.example``), scheme-relative ones (``//evil.example``, which
    a browser treats as absolute), and backslash variants that some browsers
    normalise to slashes.
    """
    if not next or not next.startswith("/"):
        return default
    if next.startswith("//") or next.startswith("/\\"):
        return default
    return next


async def _current_user(request: Request):
    """Return the authenticated user or None (never raises)."""
    try:
        return await auth_manager(request)
    except (NotAuthenticatedException, Exception):
        return None


async def _browse_url(course_name: str, pagepath: str) -> str | None:
    """Return a read-only ``?mode=browsing`` URL for a page, or None.

    Browsing mode is anonymous -- the book server drops the user when it sees
    ``mode=browsing`` -- so a course with ``login_required`` set would bounce
    the reader straight back to the sign-in page. For those, point at the
    **base** course instead: a custom course's pages are served from its base
    course's build, so this is the same content without making
    ``login_required`` bypassable with a query string.

    For an open course we can link the course itself, which preserves any
    instructor customization.
    """
    if not course_name or not pagepath:
        return None
    course_row = await fetch_course(course_name)
    if not course_row:
        return None
    book = course_row.base_course if course_row.login_required else course_name
    if not book:
        return None
    return f"/ns/books/published/{book}/{pagepath}?mode=browsing"


async def _navbar_context(user: AuthUserValidator) -> dict:
    """Context the shared navbar (_navbar.html) needs for a logged-in user.

    Provides the user's active course and whether they are an instructor in
    it, which the navbar uses to decide what links and menus to show.
    """
    course = await fetch_course(user.course_name)
    is_instructor = False
    if course and course.id:
        is_instructor = bool(await fetch_instructor_courses(user.id, course.id))
    return {"course": course, "is_instructor": is_instructor}


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, next: str = "/ns/course/index"):
    # If a valid JWT is already present the user is logged in; send them
    # straight to the course home page rather than showing the login form.
    user = await _current_user(request)
    if _user_exists(user):
        # if the user is in a state where they don't have any courses yet send them to choose one
        if user.course_id == 0:
            return RedirectResponse(
                "/admin/auth/courses", status_code=status.HTTP_302_FOUND
            )
        return RedirectResponse("/ns/course/index", status_code=status.HTTP_302_FOUND)

    return templates.TemplateResponse(
        "admin/auth/login.html",
        {"request": request, "next": _safe_next(next), "error": None},
    )


# ---------------------------------------------------------------------------
# "This course requires you to sign in"
# ---------------------------------------------------------------------------


@router.get("/login-required", response_class=HTMLResponse)
async def login_required_page(
    request: Request, course: str = "", next: str = "/ns/course/index"
):
    """Explain why an anonymous visitor cannot read a course, and offer a way in.

    Replaces web2py's ``default/accessIssue``. The book server sends people here
    when a course has ``login_required`` set and no one is signed in
    (``book_server_api/routers/books.py``).

    The old page was written for a failure mode that no longer exists: with two
    auth systems you could hold a valid web2py session but no Runestone JWT, so
    it told you to log *out* and back in. There is one session now, so this is
    simply "please sign in", plus the troubleshooting notes that still apply.
    """
    next = _safe_next(next)

    # Already signed in? Then they followed a stale link, or signed in from
    # another tab. Send them where they were trying to go.
    user = await _current_user(request)
    if _user_exists(user):
        return RedirectResponse(next, status_code=status.HTTP_302_FOUND)

    # Offer a read-only way in. `next` is /ns/books/published/<course>/<page...>;
    # pull the page path back out so _browse_url can pick the right book.
    browse_url = None
    prefix = f"/ns/books/published/{course}/"
    if course and next.startswith(prefix):
        browse_url = await _browse_url(course, next[len(prefix) :])

    return templates.TemplateResponse(
        "admin/auth/login_required.html",
        {
            "request": request,
            "course": course,
            "next": next,
            "browse_url": browse_url,
        },
    )


@router.post("/login", response_class=HTMLResponse)
async def login_post(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    next: str = Form(default="/ns/course/index"),
):
    user = await fetch_user(username)
    if not _user_exists(user) or not _verify_password(user.password, password):
        rslogger.info(f"LOGIN FAILED: {username} Exists: {_user_exists(user)}")
        return templates.TemplateResponse(
            "admin/auth/login.html",
            {
                "request": request,
                "next": next,
                "error": "Invalid username or password.",
            },
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    access_token = auth_manager.create_access_token(
        data={"sub": user.username}, expires=timedelta(days=105)
    )
    if user.course_id == 0:
        response = RedirectResponse(
            "/admin/auth/courses", status_code=status.HTTP_302_FOUND
        )
    else:
        response = RedirectResponse(_safe_next(next), status_code=status.HTTP_302_FOUND)
    auth_manager.set_cookie(response, access_token)
    rslogger.info(f"LOGIN SUCCESS: {username}")
    return response


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


@router.get("/logout")
async def logout():
    response = RedirectResponse(_LOGIN, status_code=status.HTTP_302_FOUND)
    auth_manager.delete_cookie(response)
    return response


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse(
        "admin/auth/register.html",
        {"request": request, "errors": []},
    )


@router.post("/register", response_class=HTMLResponse)
async def register_post(
    request: Request,
    username: str = Form(...),
    first_name: str = Form(...),
    last_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    password2: str = Form(...),
    institution: str = Form(default=""),
    instructor: str = Form(default=""),
):
    errors = []

    username = username.strip()
    username_error = _validate_username(username)
    if username_error:
        errors.append(username_error)

    # Trim the free-text fields before validating or storing them. Without this a
    # name of " " was accepted and became the student's name on every roster.
    first_name = clean_text(first_name)
    last_name = clean_text(last_name)
    email = clean_text(email)
    institution = clean_text(institution)

    for value, label in (
        (first_name, "First name"),
        (last_name, "Last name"),
        (email, "Email"),
    ):
        field_error = validate_text_field(value, label)
        if field_error:
            errors.append(field_error)

    institution_error = validate_text_field(
        institution, "Institution name", required=False
    )
    if institution_error:
        errors.append(institution_error)

    if password != password2:
        errors.append("Passwords do not match.")
    password_error = validate_password(password)
    if password_error:
        errors.append(password_error)

    existing = await fetch_user(username)
    if _user_exists(existing):
        errors.append("That username is already taken.")

    existing_email = await fetch_user_by_email(email)
    if _user_exists(existing_email):
        errors.append("An account with that email already exists.")

    if errors:
        return templates.TemplateResponse(
            "admin/auth/register.html",
            {
                "request": request,
                "errors": errors,
                "submitted": {
                    "username": username,
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": email,
                    "institution": institution,
                    "instructor": instructor,
                },
            },
        )

    now = datetime.datetime.utcnow()
    new_user = AuthUserValidator(
        username=username,
        first_name=first_name,
        last_name=last_name,
        email=email,
        password=password,
        course_name="",
        course_id=0,
        donated=False,
        active=True,
        accept_tcp=True,
        created_on=now,
        modified_on=now,
        registration_key="",
        registration_id=username,
        reset_password_key="",
    )
    try:
        created = await create_user(new_user)
    except Exception as exc:
        rslogger.error("REGISTER ERROR: %s", exc)
        return templates.TemplateResponse(
            "admin/auth/register.html",
            {
                "request": request,
                "errors": ["REGISTER FAILED. Please try again."],
                "submitted": {
                    "username": username,
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": email,
                    "institution": institution,
                    "instructor": instructor,
                },
            },
        )

    if not _user_exists(created):
        return templates.TemplateResponse(
            "admin/auth/register.html",
            {
                "request": request,
                "errors": ["Registration failed. Please try again."],
                "submitted": {
                    "username": username,
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": email,
                    "institution": institution,
                    "instructor": instructor,
                },
            },
        )

    access_token = auth_manager.create_access_token(
        data={"sub": created.username}, expires=timedelta(days=105)
    )

    is_instructor = instructor == "yes"
    if is_instructor:
        redirect_to = "/admin/instructor/create_course"
    else:
        inst_param = f"?institution={institution}" if institution else ""
        redirect_to = f"{_COURSES}{inst_param}"

    response = RedirectResponse(redirect_to, status_code=status.HTTP_302_FOUND)
    auth_manager.set_cookie(response, access_token)
    rslogger.info(
        f"REGISTER SUCCESS: {username} (instructor={is_instructor}, institution='{institution}')"
    )
    return response


# ---------------------------------------------------------------------------
# Course enrollment
# ---------------------------------------------------------------------------


@router.get("/courses", response_class=HTMLResponse)
async def courses_page(request: Request, institution: str = ""):
    user = await _current_user(request)
    if not _user_exists(user):
        return RedirectResponse(
            f"{_LOGIN}?next={_COURSES}", status_code=status.HTTP_302_FOUND
        )

    open_books = await fetch_library_books()
    institution_courses = []
    if institution:
        institution_courses = await fetch_courses_by_institution(institution)

    return templates.TemplateResponse(
        "admin/auth/courses.html",
        {
            "request": request,
            "user": user,
            "open_books": open_books,
            "institution_courses": institution_courses,
            "institution": institution,
            "error": None,
            **(await _navbar_context(user)),
        },
    )


@router.post("/courses", response_class=HTMLResponse)
async def courses_post(
    request: Request,
    course_name: str = Form(...),
    institution: str = Form(default=""),
):
    user = await _current_user(request)
    if not _user_exists(user):
        return RedirectResponse(_LOGIN, status_code=status.HTTP_302_FOUND)

    course = await fetch_course(course_name)
    if not course or not course.id:
        open_books = await fetch_library_books()
        institution_courses = (
            await fetch_courses_by_institution(institution) if institution else []
        )
        return templates.TemplateResponse(
            "admin/auth/courses.html",
            {
                "request": request,
                "user": user,
                "open_books": open_books,
                "institution_courses": institution_courses,
                "institution": institution,
                "error": f"Course '{course_name}' not found. Please check the name and try again.",
                **(await _navbar_context(user)),
            },
        )

    already_enrolled = await user_in_course(user.id, course.id)
    if not already_enrolled:
        await create_user_course_entry(user.id, course.id)

    await update_user(
        user.id, {"course_name": course.course_name, "course_id": course.id}
    )

    # When a student registers for a new course, invite them to support
    # Runestone. We don't ask again once they've donated.
    if not already_enrolled and not user.donated:
        return RedirectResponse(_DONATE, status_code=status.HTTP_302_FOUND)

    return RedirectResponse("/ns/course/index", status_code=status.HTTP_302_FOUND)


# ---------------------------------------------------------------------------
# Donate (shown after a student registers for a new course)
# ---------------------------------------------------------------------------


@router.get("/donate", response_class=HTMLResponse)
async def donate_page(request: Request, next: str = ""):
    """Invite the reader to support Runestone.

    ``next`` is where they were actually headed. An LTI launch by a brand-new
    enrollment lands here on its way to an assignment, so the page has to be a
    stop along the route, not a dead end -- web2py did this with
    ``session.lti_url_next``. Empty means they arrived on their own and there is
    nowhere in particular to continue to.
    """
    # The donate page is open to everyone -- logged-in students we prompt after
    # registration as well as anonymous visitors who want to support Runestone.
    # Only build the (user-specific) navbar context when someone is signed in.
    user = await _current_user(request)
    context = {"request": request, "user": None, "next": _safe_next(next, "")}
    if _user_exists(user):
        context["user"] = user
        context.update(await _navbar_context(user))
    return templates.TemplateResponse("admin/auth/donate.html", context)


@router.post("/donate/mark")
async def donate_mark(request: Request):
    """Record that the current user has donated so we stop asking.

    Called from the donate page after a successful PayPal capture.
    """
    user = await _current_user(request)
    if _user_exists(user):
        await update_user(user.id, {"donated": True})
        return {"ok": True}
    return {"ok": False}


# ---------------------------------------------------------------------------
# My Courses (list enrolled courses, switch active course, drop a course)
# ---------------------------------------------------------------------------


async def _build_my_courses_context(user: AuthUserValidator):
    """Return the template context dict for the my_courses page."""
    enrolled = await fetch_courses_for_user(user.id)

    # Collect course IDs where user is an instructor
    # CourseInstructorValidator uses field name `course` (the course id)
    instructor_course_ids = set()
    for ic in await fetch_instructor_courses(user.id):
        instructor_course_ids.add(ic.course)

    # Most-recent access time per course in the last 30 days. Used both to flag
    # recently-used courses (with a ⏱️ in the template) and to sort the lists.
    access_dict = await fetch_last_course_access(
        user.username, datetime.datetime.now() - timedelta(days=30)
    )

    open_books = []
    class_courses = []
    active_course = None
    for course in enrolled:
        is_instructor = course.id in instructor_course_ids
        is_active = course.course_name == user.course_name
        if is_active:
            active_course = course
        entry = {
            "course_name": course.course_name,
            "is_instructor": is_instructor,
            "is_active": is_active,
            "recently_used": course.course_name in access_dict,
            "id": course.id,
        }
        if course.base_course == course.course_name:
            open_books.append(entry)
        else:
            class_courses.append(entry)

    # Sort by most-recently-accessed first, then alphabetically. Courses used
    # in the last 30 days are ordered by recency (newest at the top); courses
    # not accessed in that window fall back to alphabetical order. This mirrors
    # the legacy web2py `courses` controller behavior.
    long_ago = datetime.datetime(1970, 1, 1)

    def _sort_key(c):
        last_acc = access_dict.get(c["course_name"], long_ago)
        # Negate the timestamp so more-recent access sorts first while we keep
        # the overall (ascending) sort and break ties alphabetically.
        return (-last_acc.timestamp(), c["course_name"].lower())

    open_books.sort(key=_sort_key)
    class_courses.sort(key=_sort_key)
    return {
        "open_books": open_books,
        "class_courses": class_courses,
        "course": active_course,
        "is_instructor": bool(active_course)
        and active_course.id in instructor_course_ids,
    }


@router.get("/my_courses", response_class=HTMLResponse)
async def my_courses_page(
    request: Request,
    bad_course: str = "",
    bad_page: str = "",
    page_course: str = "",
    requested_course: str = "",
    current_course: str = "",
    requested_path: str = "",
):
    """List the user's courses.

    The book server bounces people here when it cannot serve the page they
    asked for, passing the reason in the query string
    (``book_server_api/routers/books.py``):

    * ``bad_course``      -- no such course
    * ``bad_page``/``page_course`` -- the course exists but has no such page
    * ``requested_course``/``current_course``/``requested_path`` -- the course
      they asked for is not their active one

    Without those the page gives no hint why the reader was redirected, which
    is what the old web2py ``courses.html`` explained. It also offered a
    browsing-mode link for the requested course; both are restored here.
    """
    user = await _current_user(request)
    if not _user_exists(user):
        return RedirectResponse(
            f"{_LOGIN}?next={_MY_COURSES}", status_code=status.HTTP_302_FOUND
        )
    ctx = await _build_my_courses_context(user)

    browse_url = None
    if requested_course and requested_path:
        browse_url = await _browse_url(requested_course, requested_path)

    return templates.TemplateResponse(
        "admin/auth/my_courses.html",
        {
            "request": request,
            "user": user,
            "error": None,
            "bad_course": bad_course,
            "bad_page": bad_page,
            "page_course": page_course,
            "requested_course": requested_course,
            "current_course": current_course,
            "browse_url": browse_url,
            **ctx,
        },
    )


@router.post("/my_courses/switch", response_class=HTMLResponse)
async def my_courses_switch(request: Request, course_name: str = Form(...)):
    """Switch the user's active course."""
    user = await _current_user(request)
    if not _user_exists(user):
        return RedirectResponse(_LOGIN, status_code=status.HTTP_302_FOUND)

    course = await fetch_course(course_name)
    if not course or not course.id:
        ctx = await _build_my_courses_context(user)
        return templates.TemplateResponse(
            "admin/auth/my_courses.html",
            {
                "request": request,
                "user": user,
                "error": f"Course '{course_name}' not found.",
                **ctx,
            },
        )

    await update_user(
        user.id, {"course_name": course.course_name, "course_id": course.id}
    )
    return RedirectResponse("/ns/course/index", status_code=status.HTTP_302_FOUND)


@router.post("/my_courses/drop", response_class=HTMLResponse)
async def my_courses_drop(request: Request, course_name: str = Form(...)):
    """Drop (un-enroll from) a course. Cannot drop the currently active course."""
    user = await _current_user(request)
    if not _user_exists(user):
        return RedirectResponse(_LOGIN, status_code=status.HTTP_302_FOUND)

    if course_name == user.course_name:
        ctx = await _build_my_courses_context(user)
        return templates.TemplateResponse(
            "admin/auth/my_courses.html",
            {
                "request": request,
                "user": user,
                "error": "You cannot drop your currently active course. Switch to another course first.",
                **ctx,
            },
        )

    course = await fetch_course(course_name)
    if course and course.id:
        await delete_user_course_entry(user.id, course.id)

    return RedirectResponse(_MY_COURSES, status_code=status.HTTP_302_FOUND)


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------


@router.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request):
    user = await _current_user(request)
    if not _user_exists(user):
        return RedirectResponse(
            f"{_LOGIN}?next={_PROFILE}", status_code=status.HTTP_302_FOUND
        )
    return templates.TemplateResponse(
        "admin/auth/profile.html",
        {
            "request": request,
            "user": user,
            "errors": [],
            "success": None,
            **(await _navbar_context(user)),
        },
    )


@router.post("/profile", response_class=HTMLResponse)
async def profile_post(
    request: Request,
    first_name: str = Form(...),
    last_name: str = Form(...),
    email: str = Form(...),
):
    user = await _current_user(request)
    if not _user_exists(user):
        return RedirectResponse(_LOGIN, status_code=status.HTTP_302_FOUND)

    errors = []
    existing = await fetch_user_by_email(email)
    if _user_exists(existing) and existing.id != user.id:
        errors.append("That email address is already in use by another account.")

    if errors:
        return templates.TemplateResponse(
            "admin/auth/profile.html",
            {
                "request": request,
                "user": user,
                "errors": errors,
                "success": None,
                **(await _navbar_context(user)),
            },
        )

    await update_user(
        user.id, {"first_name": first_name, "last_name": last_name, "email": email}
    )
    updated = await fetch_user(user.username)

    return templates.TemplateResponse(
        "admin/auth/profile.html",
        {
            "request": request,
            "user": updated,
            "errors": [],
            "success": "Profile updated successfully.",
            **(await _navbar_context(updated)),
        },
    )


@router.post("/delete-account", response_class=HTMLResponse)
async def delete_account(request: Request, confirm: str = Form(default="")):
    user = await _current_user(request)
    if not _user_exists(user):
        return RedirectResponse(_LOGIN, status_code=status.HTTP_302_FOUND)

    if confirm != user.username:
        return templates.TemplateResponse(
            "admin/auth/profile.html",
            {
                "request": request,
                "user": user,
                "errors": ["Username confirmation did not match. Account not deleted."],
                "success": None,
                **(await _navbar_context(user)),
            },
        )

    await delete_user(user.username)
    response = RedirectResponse(_LOGIN, status_code=status.HTTP_302_FOUND)
    auth_manager.delete_cookie(response)
    return response


# ---------------------------------------------------------------------------
# Forgot username
# ---------------------------------------------------------------------------


@router.get("/forgot-username", response_class=HTMLResponse)
async def forgot_username_page(request: Request):
    return templates.TemplateResponse(
        "admin/auth/forgot_username.html",
        {"request": request, "sent": False, "error": None},
    )


@router.post("/forgot-username", response_class=HTMLResponse)
async def forgot_username_post(request: Request, email: str = Form(...)):
    user = await fetch_user_by_email(email)
    if _user_exists(user):
        await send_email(
            to=email,
            subject="Your Runestone Academy username",
            text=f"Your Runestone Academy username is: {user.username}\n\nIf you did not request this, you can ignore this email.",
        )
    return templates.TemplateResponse(
        "admin/auth/forgot_username.html",
        {"request": request, "sent": True, "error": None},
    )


# ---------------------------------------------------------------------------
# Forgot password / reset password
# ---------------------------------------------------------------------------


@router.get("/forgot-password", response_class=HTMLResponse)
async def forgot_password_page(request: Request):
    return templates.TemplateResponse(
        "admin/auth/forgot_password.html",
        {"request": request, "sent": False, "error": None},
    )


@router.post("/forgot-password", response_class=HTMLResponse)
async def forgot_password_post(request: Request, email: str = Form(...)):
    user = await fetch_user_by_email(email)
    if _user_exists(user):
        token = await set_reset_token(user.id)
        reset_url = f"{request.base_url}admin/auth/reset-password/{token}"
        await send_email(
            to=email,
            subject="Reset your Runestone Academy password",
            text=(
                f"Click the link below to reset your password. "
                f"This link expires in 1 hour.\n\n{reset_url}\n\n"
                "If you did not request a password reset, you can ignore this email."
            ),
        )
    return templates.TemplateResponse(
        "admin/auth/forgot_password.html",
        {"request": request, "sent": True, "error": None},
    )


@router.get("/reset-password/{token}", response_class=HTMLResponse)
async def reset_password_page(request: Request, token: str):
    import time as _time

    try:
        ts = int(token.split("-")[0], 16)
        valid = _time.time() - ts <= 3600
    except (ValueError, IndexError):
        valid = False

    return templates.TemplateResponse(
        "admin/auth/reset_password.html",
        {"request": request, "token": token, "expired": not valid, "error": None},
    )


@router.post("/reset-password/{token}", response_class=HTMLResponse)
async def reset_password_post(
    request: Request,
    token: str,
    password: str = Form(...),
    password2: str = Form(...),
):
    if password != password2:
        return templates.TemplateResponse(
            "admin/auth/reset_password.html",
            {
                "request": request,
                "token": token,
                "expired": False,
                "error": "Passwords do not match.",
            },
        )
    if len(password) < 6:
        return templates.TemplateResponse(
            "admin/auth/reset_password.html",
            {
                "request": request,
                "token": token,
                "expired": False,
                "error": "Password must be at least 6 characters.",
            },
        )

    user = await consume_reset_token(token)
    if not user:
        return templates.TemplateResponse(
            "admin/auth/reset_password.html",
            {"request": request, "token": token, "expired": True, "error": None},
        )

    await update_user(
        user.id, {"password": password, "modified_on": canonical_utcnow()}
    )
    rslogger.info(f"RESET SUCCESS: {user.username}")
    return RedirectResponse(
        f"{_LOGIN}?next=/ns/course/index", status_code=status.HTTP_302_FOUND
    )
