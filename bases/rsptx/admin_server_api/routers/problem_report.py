"""
problem_report.py - Low-friction "Report a Problem" form for the admin server.

Gives students (and anyone else) a single, simple form to report a problem with
a page in a book.  Whatever we already know -- the reporter's username, their
active course, and the page they came from -- is prefilled so all they have to
do is describe what went wrong.

On submit the report is filed as a GitHub issue in ``settings.github_issue_repo``
using ``settings.github_token`` (see :mod:`rsptx.configuration`).  The form is
intentionally forgiving: it works whether or not the visitor is logged in, and
if GitHub is not configured it tells the user to email support instead.
"""

import httpx

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from rsptx.auth.session import auth_manager
from rsptx.configuration import settings
from rsptx.db.crud import fetch_course, fetch_instructor_courses
from rsptx.logging import rslogger
from rsptx.response_helpers.core import canonical_utcnow
from rsptx.templates import template_folder

router = APIRouter(
    prefix="/problem",
    tags=["problem-report"],
)

templates = Jinja2Templates(directory=template_folder)

# Browser-facing URL: nginx/caddy route /admin/problem/ -> container /problem/
_REPORT_URL = "/admin/problem/report"

# Support contact shown when GitHub issue creation is unavailable.
_SUPPORT_EMAIL = "support@runestone.academy"


async def _current_user(request: Request):
    """Return the authenticated user, or None -- never raises.

    The form must render for logged-out visitors too, so we swallow the
    ``NotAuthenticatedException`` (and anything else) auth_manager may raise.
    """
    try:
        return await auth_manager(request)
    except Exception:
        return None


def _prefill(user, page: str) -> dict:
    """Build the prefilled field values for the form from what we know."""
    return {
        "username": getattr(user, "username", "") or "",
        "course": getattr(user, "course_name", "") or "",
        "page": page or "",
        "description": "",
    }


async def _base_context(request: Request, user) -> dict:
    """Common template context, including what the shared navbar needs.

    ``_auth_base.html`` includes ``_navbar.html`` for a logged-in user, and that
    partial references ``course`` and ``is_instructor``. Provide them (or a safe
    default) so the page renders whether or not someone is signed in.
    """
    course = None
    is_instructor = False
    if user and getattr(user, "course_name", None):
        course = await fetch_course(user.course_name)
        if course and course.id and getattr(user, "id", None):
            is_instructor = bool(await fetch_instructor_courses(user.id, course.id))
    return {
        "request": request,
        "user": user,
        "page_title": "Report a Problem",
        "course": course,
        "is_instructor": is_instructor,
        "student_page": True,
        "support_email": _SUPPORT_EMAIL,
    }


async def _create_github_issue(
    username: str, course: str, page: str, description: str
) -> str | None:
    """File the problem report as a GitHub issue.

    :return: The ``html_url`` of the created issue on success, or None if it
        could not be filed (including when GitHub is not configured).
    """
    if not settings.github_token:
        rslogger.warning("GITHUB_TOKEN not configured; cannot file problem report.")
        return None

    reporter = username or "an anonymous user"
    where = page or course or "an unspecified page"
    title = f"Problem report: {where}"
    body = (
        f'A problem was reported through the Runestone "Report a Problem" form.\n\n'
        f"| Field | Value |\n"
        f"| --- | --- |\n"
        f"| **Reporter** | {username or '(not logged in)'} |\n"
        f"| **Course** | {course or '(unknown)'} |\n"
        f"| **Page** | {page or '(not provided)'} |\n"
        f"| **Reported at** | {canonical_utcnow().isoformat()} |\n\n"
        f"### Description\n\n{description}\n"
    )

    url = f"https://api.github.com/repos/{settings.github_issue_repo}/issues"
    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    payload = {"title": title, "body": body, "labels": ["problem-report"]}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        rslogger.error("Error contacting GitHub to file problem report: %s", exc)
        return None

    if resp.status_code != 201:
        rslogger.error(
            "GitHub issue creation failed (%s): %s", resp.status_code, resp.text
        )
        return None

    issue_url = resp.json().get("html_url", "")
    rslogger.info("Filed problem report from %s: %s", reporter, issue_url)
    return issue_url or _issues_page_url()


def _issues_page_url() -> str:
    """Public URL of the repo's issues list, used as a fallback tracking link."""
    return f"https://github.com/{settings.github_issue_repo}/issues"


@router.get("/report", response_class=HTMLResponse)
async def report_form(request: Request, page: str = ""):
    """Render the problem-report form, prefilled with what we already know.

    ``page`` is the URL of the page the problem is about.  A "Report a Problem"
    link on a book page should pass it (e.g. ``/admin/problem/report?page=...``);
    if it is omitted we fall back to the HTTP ``Referer`` header.
    """
    user = await _current_user(request)
    page = page or request.headers.get("referer", "")
    ctx = await _base_context(request, user)
    ctx.update(submitted=_prefill(user, page), errors=[], success=False)
    return templates.TemplateResponse("admin/problem_report.html", ctx)


@router.post("/report", response_class=HTMLResponse)
async def report_submit(
    request: Request,
    description: str = Form(...),
    username: str = Form(default=""),
    course: str = Form(default=""),
    page: str = Form(default=""),
):
    """Validate the report and file it as a GitHub issue."""
    user = await _current_user(request)
    # Trust the session over the form: a logged-in user's username and course
    # come from their JWT, not the (spoofable) hidden fields, so a report can't
    # be filed under someone else's name.
    if user:
        username = getattr(user, "username", "") or username
        course = getattr(user, "course_name", "") or course
    description = description.strip()

    errors = []
    if not description:
        errors.append("Please describe the problem before submitting.")

    if errors:
        ctx = await _base_context(request, user)
        ctx.update(
            submitted={
                "username": username,
                "course": course,
                "page": page,
                "description": description,
            },
            errors=errors,
            success=False,
        )
        return templates.TemplateResponse("admin/problem_report.html", ctx)

    issue_url = await _create_github_issue(username, course, page, description)

    if not issue_url:
        errors.append(
            "Sorry, we couldn't submit your report automatically. Please email "
            f"{_SUPPORT_EMAIL} and include the page address and a description."
        )

    ctx = await _base_context(request, user)
    ctx.update(
        submitted=_prefill(user, page),
        errors=errors,
        success=bool(issue_url),
        issue_url=issue_url,
        issues_page_url=_issues_page_url(),
    )
    return templates.TemplateResponse("admin/problem_report.html", ctx)
