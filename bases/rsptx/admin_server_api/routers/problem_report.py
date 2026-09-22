"""
problem_report.py - Low-friction "Report a Problem" form for the admin server.

Gives students (and anyone else) a single, simple form to report a problem with
a page in a book.  Whatever we already know -- the reporter's username, their
active course, and the page they came from -- is prefilled so all they have to
do is describe what went wrong.

There are two ways to submit.  "Submit Report" files the report as a GitHub
issue in ``settings.github_issue_repo`` using ``settings.github_token`` (see
:mod:`rsptx.configuration`) -- it works for everyone, but the issue is authored
by the Runestone account, so the reporter hears nothing back.  "File it yourself
on GitHub" instead redirects the reporter to GitHub's own new-issue page with
everything prefilled; they press Submit there and the issue is authored by them,
so GitHub notifies them of replies.

The form is intentionally forgiving: it works whether or not the visitor is
logged in, and if GitHub is not configured it tells the user to email support
instead.
"""

import re
from urllib.parse import quote_plus, urlencode

import httpx

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from rsptx.auth.session import auth_manager
from rsptx.configuration import settings
from rsptx.db.crud import fetch_course, fetch_instructor_courses
from rsptx.logging import rslogger
from rsptx.response_helpers.core import canonical_utcnow
from rsptx.templates import get_shared_templates

router = APIRouter(
    prefix="/problem",
    tags=["problem-report"],
)

templates = get_shared_templates()

# Browser-facing URL: nginx/caddy route /admin/problem/ -> container /problem/
_REPORT_URL = "/admin/problem/report"

# Browser-facing URL of the "file it under my own GitHub account" button.
_GITHUB_REPORT_URL = _REPORT_URL + "/github"

# Support contact shown when GitHub issue creation is unavailable.
_SUPPORT_EMAIL = "support@runestone.academy"

# Label applied to every report, however it is filed.
_ISSUE_LABEL = "problem-report"

# Longest prefilled-issue URL we will hand to the browser.  GitHub and some
# browsers reject very long URLs, so an oversized report has its console log
# trimmed (see :func:`_trim_console_log`) until the link fits.
_MAX_ISSUE_URL = 8000

# Console lines worth keeping even when they are old enough to be trimmed:
# whatever the reporter actually hit is almost always on one of these.
_IMPORTANT_LOG_LINE = re.compile(
    r"\b(error|warn|warning|uncaught|promise|reject(ed|ion)?|exception"
    r"|traceback|fail(ed|ure)?|fatal|severe)\b",
    re.IGNORECASE,
)

# Stands in for the console output we had to leave out.
_LOG_OMITTED = "... earlier console output omitted ..."


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
        "email": getattr(user, "email", "") or "",
        "page": page or "",
        "description": "",
        "console_log": "",
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


def _issue_title(course: str, page: str) -> str:
    """Headline for the issue: where the problem is, as best we can tell."""
    where = page or course or "an unspecified page"
    return f"Problem report: {where}"


def _console_log_section(console_log: str) -> str:
    """Markdown for the console log, or "" when there is nothing to show."""
    if not console_log.strip():
        return ""
    # Fence it so backticks/markdown in the log don't wreck the issue body.
    return f"\n### Browser console log\n\n```text\n{console_log}\n```\n"


def _trim_console_log(console_log: str, budget: int) -> str:
    """Cut ``console_log`` down to roughly ``budget`` characters.

    Errors and warnings are claimed first, newest first, so a stack trace that
    scrolled past a wall of chatter still reaches the issue.  Whatever budget
    is left then goes to the most recent lines, since those are the context
    around whatever the reporter just hit.  Everything dropped comes off the
    front, and each gap is marked so nobody reads the result as continuous.
    """
    if len(console_log) <= budget:
        return console_log

    lines = console_log.splitlines()
    keep = [False] * len(lines)
    budget = max(0, budget - len(_LOG_OMITTED) - 1)
    used = 0

    # Errors and warnings, newest first.  Keep scanning past one that doesn't
    # fit -- an older, shorter line still might.
    for i in range(len(lines) - 1, -1, -1):
        if not _IMPORTANT_LOG_LINE.search(lines[i]):
            continue
        cost = len(lines[i]) + 1
        if used + cost <= budget:
            keep[i] = True
            used += cost

    # Then the most recent run of ordinary lines, as far back as the rest of
    # the budget reaches.
    for i in range(len(lines) - 1, -1, -1):
        if keep[i]:
            continue
        cost = len(lines[i]) + 1
        if used + cost > budget:
            break
        keep[i] = True
        used += cost

    if not any(keep):
        # Not one whole line fits -- a single console.log of a big blob will do
        # that.  Keep the tail of it rather than throwing the log away.
        return f"{_LOG_OMITTED}\n{console_log[-budget:]}" if budget else _LOG_OMITTED

    out = []
    dropped = False
    for i, line in enumerate(lines):
        if not keep[i]:
            dropped = True
            continue
        if dropped:
            out.append(_LOG_OMITTED)
            dropped = False
        out.append(line)
    if dropped:
        out.append(_LOG_OMITTED)
    return "\n".join(out)


def _issue_body(
    username: str,
    email: str,
    course: str,
    page: str,
    description: str,
    console_log: str = "",
) -> str:
    """Markdown body of the issue, shared by both submit paths."""
    body = (
        f'A problem was reported through the Runestone "Report a Problem" form.\n\n'
        f"| Field | Value |\n"
        f"| --- | --- |\n"
        f"| **Reporter** | {username or '(not logged in)'} |\n"
        f"| **Email** | {email or '(not provided)'} |\n"
        f"| **Course** | {course or '(unknown)'} |\n"
        f"| **Page** | {page or '(not provided)'} |\n"
        f"| **Reported at** | {canonical_utcnow().isoformat()} |\n\n"
        f"### Description\n\n{description}\n"
    )
    return body + _console_log_section(console_log)


def _close_fence(body: str) -> str:
    """Close a code fence the trimming cut through, so the rest still renders."""
    body = body.rstrip()
    if body.count("```") % 2:
        body += "\n```"
    return body


def _new_issue_url(
    username: str,
    email: str,
    course: str,
    page: str,
    description: str,
    console_log: str = "",
) -> str:
    """Build a GitHub "new issue" URL with the report already filled in.

    Sending the reporter here instead of posting for them means the issue is
    authored by *their* GitHub account, so they get notified of replies and can
    follow the fix.  Nothing is filed until they press Submit on GitHub.

    GitHub and some browsers reject very long URLs, so if the report doesn't
    fit we give the console log whatever room is left over and let
    :func:`_trim_console_log` decide which of it to keep.  The description is
    never trimmed unless it alone is too big for the link.
    """
    base = f"https://github.com/{settings.github_issue_repo}/issues/new"
    title = _issue_title(course, page)

    def with_body(text: str) -> str:
        params = {"title": title, "labels": _ISSUE_LABEL, "body": text}
        return f"{base}?{urlencode(params)}"

    def with_log(log: str) -> str:
        return with_body(_issue_body(username, email, course, page, description, log))

    url = with_log(console_log)
    if len(url) <= _MAX_ISSUE_URL:
        return url

    # Largest slice of the log that still fits.  Encoding expands the body by a
    # variable amount, so search on the result rather than trying to predict it.
    lo, hi = 0, len(console_log)
    best = None
    while lo <= hi:
        mid = (lo + hi) // 2
        candidate = with_log(_trim_console_log(console_log, mid))
        if len(candidate) <= _MAX_ISSUE_URL:
            best = candidate
            lo = mid + 1
        else:
            hi = mid - 1
    if best is not None:
        return best

    # Even with no log at all it doesn't fit, so the description itself is
    # enormous.  Drop the log and trim the description's tail as a last resort.
    note = "\n\n_(Trimmed to fit in a link -- some detail was left out.)_"
    body = _issue_body(username, email, course, page, description)
    while (
        len(body) > 200 and len(with_body(_close_fence(body) + note)) > _MAX_ISSUE_URL
    ):
        body = body[: int(len(body) * 0.9)]
    return with_body(_close_fence(body) + note)


def _log_budget(
    username: str, email: str, course: str, page: str, description: str
) -> int:
    """Encoded characters of console log that will fit in the prefilled link.

    The form hands this to the browser so it can warn the reporter *before*
    they submit that their log is about to be trimmed.  Percent-encoding is a
    per-character map, so encoded lengths simply add: the budget is whatever
    :data:`_MAX_ISSUE_URL` has left once the rest of the report and the code
    fence around the log are encoded.
    """
    without_log = _new_issue_url(username, email, course, page, description)
    # Cost of the fence and heading alone -- "a" stands in for the log itself,
    # since an empty one produces no section at all.
    fence = len(quote_plus(_console_log_section("a"))) - 1
    return max(0, _MAX_ISSUE_URL - len(without_log) - fence)


async def _create_github_issue(
    username: str,
    email: str,
    course: str,
    page: str,
    description: str,
    console_log: str = "",
) -> str | None:
    """File the problem report as a GitHub issue, under the Runestone account.

    :return: The ``html_url`` of the created issue on success, or None if it
        could not be filed (including when GitHub is not configured).
    """
    if not settings.github_token:
        rslogger.warning("GITHUB_TOKEN not configured; cannot file problem report.")
        return None

    reporter = username or "an anonymous user"
    title = _issue_title(course, page)
    body = _issue_body(username, email, course, page, description, console_log)

    url = f"https://api.github.com/repos/{settings.github_issue_repo}/issues"
    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    payload = {"title": title, "body": body, "labels": [_ISSUE_LABEL]}

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


def _identity(user, username: str, email: str, course: str) -> tuple[str, str, str]:
    """Reconcile the submitted identity fields with the session.

    Trust the session over the form: a logged-in user's username, email, and
    course come from their JWT, not the (spoofable) hidden fields, so a report
    can't be filed under someone else's name.
    """
    if user:
        username = getattr(user, "username", "") or username
        email = getattr(user, "email", "") or email
        course = getattr(user, "course_name", "") or course
    return username, email, course


async def _render_form(
    request: Request, user, submitted: dict, errors: list[str] | None = None, **extra
) -> HTMLResponse:
    """Render the report form.

    Every path that shows the form comes through here so that ``log_budget``
    -- which the page needs to warn about an oversized console log -- is always
    computed from the same fields the page is about to display.
    """
    ctx = await _base_context(request, user)
    ctx.update(
        submitted=submitted,
        errors=errors or [],
        success=False,
        log_budget=_log_budget(
            submitted.get("username", ""),
            submitted.get("email", ""),
            submitted.get("course", ""),
            submitted.get("page", ""),
            submitted.get("description", ""),
        ),
    )
    ctx.update(extra)
    return templates.TemplateResponse("admin/problem_report.html", ctx)


def _describe_or_error(description: str) -> list[str]:
    """The one validation both submit paths share."""
    if not description.strip():
        return ["Please describe the problem before submitting."]
    return []


@router.get("/report", response_class=HTMLResponse)
async def report_form(request: Request, page: str = ""):
    """Render the problem-report form, prefilled with what we already know.

    ``page`` is the URL of the page the problem is about.  A "Report a Problem"
    link on a book page should pass it (e.g. ``/admin/problem/report?page=...``);
    if it is omitted we fall back to the HTTP ``Referer`` header.
    """
    user = await _current_user(request)
    page = page or request.headers.get("referer", "")
    return await _render_form(request, user, _prefill(user, page))


@router.post("/report", response_class=HTMLResponse)
async def report_submit(
    request: Request,
    description: str = Form(...),
    username: str = Form(default=""),
    email: str = Form(default=""),
    course: str = Form(default=""),
    page: str = Form(default=""),
    console_log: str = Form(default=""),
):
    """Validate the report and file it as a GitHub issue for the reporter."""
    user = await _current_user(request)
    username, email, course = _identity(user, username, email, course)
    description = description.strip()

    errors = _describe_or_error(description)
    if errors:
        return await _render_form(
            request,
            user,
            {
                "username": username,
                "email": email,
                "course": course,
                "page": page,
                "description": description,
                "console_log": console_log,
            },
            errors,
        )

    issue_url = await _create_github_issue(
        username, email, course, page, description, console_log
    )

    errors = []
    if not issue_url:
        errors.append(
            "Sorry, we couldn't submit your report automatically. Please email "
            f"{_SUPPORT_EMAIL} and include the page address and a description."
        )

    return await _render_form(
        request,
        user,
        _prefill(user, page),
        errors,
        success=bool(issue_url),
        issue_url=issue_url,
        issues_page_url=_issues_page_url(),
    )


@router.post("/report/github")
async def report_via_github(
    request: Request,
    description: str = Form(...),
    username: str = Form(default=""),
    email: str = Form(default=""),
    course: str = Form(default=""),
    page: str = Form(default=""),
    console_log: str = Form(default=""),
):
    """Redirect to GitHub's new-issue page with this report prefilled.

    Same form and same fields as :func:`report_submit`, but the reporter
    presses Submit on GitHub, so the issue is authored by their account and
    they get notified of replies.  We never see the report unless they finish
    it over there -- which is why "Submit Report" is still the other button.

    Note this route deliberately does *not* require ``settings.github_token``:
    it never talks to the API, it only builds a URL.
    """
    user = await _current_user(request)
    username, email, course = _identity(user, username, email, course)
    description = description.strip()

    errors = _describe_or_error(description)
    if errors:
        return await _render_form(
            request,
            user,
            {
                "username": username,
                "email": email,
                "course": course,
                "page": page,
                "description": description,
                "console_log": console_log,
            },
            errors,
        )

    url = _new_issue_url(username, email, course, page, description, console_log)
    rslogger.info(
        "Sending %s to GitHub to file their own problem report.",
        username or "an anonymous user",
    )
    # 303 so the browser follows with GET; the POST body is not replayed.
    return RedirectResponse(url, status_code=303)
