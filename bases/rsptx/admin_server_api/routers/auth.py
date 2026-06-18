import datetime
from datetime import timedelta

from fastapi import APIRouter, Form, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
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
from rsptx.templates import template_folder

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

templates = Jinja2Templates(directory=template_folder)

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


async def _current_user(request: Request):
    """Return the authenticated user or None (never raises)."""
    try:
        return await auth_manager(request)
    except (NotAuthenticatedException, Exception):
        return None


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, next: str = "/ns/course/index"):
    return templates.TemplateResponse(
        "admin/auth/login.html",
        {"request": request, "next": next, "error": None},
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
    response = RedirectResponse(next, status_code=status.HTTP_302_FOUND)
    auth_manager.set_cookie(response, access_token)
    return response


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


@router.get("/logout")
async def logout():
    response = RedirectResponse(_LOGIN, status_code=status.HTTP_302_FOUND)
    response.delete_cookie(auth_manager.cookie_name)
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

    if password != password2:
        errors.append("Passwords do not match.")
    if len(password) < 6:
        errors.append("Password must be at least 6 characters.")

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
        rslogger.error("Registration error: %s", exc)
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
async def donate_page(request: Request):
    user = await _current_user(request)
    if not _user_exists(user):
        return RedirectResponse(
            f"{_LOGIN}?next={_DONATE}", status_code=status.HTTP_302_FOUND
        )
    return templates.TemplateResponse(
        "admin/auth/donate.html",
        {"request": request, "user": user},
    )


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


async def _build_my_courses_context(user):
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
    for course in enrolled:
        is_instructor = course.id in instructor_course_ids
        is_active = course.course_name == user.course_name
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
    return {"open_books": open_books, "class_courses": class_courses}


@router.get("/my_courses", response_class=HTMLResponse)
async def my_courses_page(request: Request):
    user = await _current_user(request)
    if not _user_exists(user):
        return RedirectResponse(
            f"{_LOGIN}?next={_MY_COURSES}", status_code=status.HTTP_302_FOUND
        )
    ctx = await _build_my_courses_context(user)
    return templates.TemplateResponse(
        "admin/auth/my_courses.html",
        {
            "request": request,
            "user": user,
            "error": None,
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
        {"request": request, "user": user, "errors": [], "success": None},
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
            {"request": request, "user": user, "errors": errors, "success": None},
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
            },
        )

    await delete_user(user.username)
    response = RedirectResponse(_LOGIN, status_code=status.HTTP_302_FOUND)
    response.delete_cookie(auth_manager.cookie_name)
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

    await update_user(user.id, {"password": password})
    return RedirectResponse(
        f"{_LOGIN}?next=/ns/course/index", status_code=status.HTTP_302_FOUND
    )
