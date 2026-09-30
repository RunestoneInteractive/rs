"""
Authentication for the dash server.

Every request must carry the ``access_token`` cookie the admin server issues at
login, and its user must be an instructor for the course they are currently in.
The check runs as a Flask ``before_request`` hook, so it covers pages and Dash's
own callback endpoints alike.

Background callbacks are the exception: they run in a Celery worker, where there
is no request to look at.  The page therefore hands them the course as a signed
token (:func:`sign_course`), minted while the request *was* authenticated, and
the callback verifies it (:func:`verify_course`).  Without the signature an
instructor could edit the value in the browser and read another course's data.
"""

from dataclasses import asdict, dataclass
from typing import Optional
from urllib.parse import quote

import jwt
from flask import g, redirect, request
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy import text

from rsptx.configuration import settings
from rsptx.dash_server_api.db import engine
from rsptx.logging import rslogger

COOKIE_NAME = "access_token"
LOGIN_URL = "/admin/auth/login"

#: A course token outlives the page that minted it for at most this long.
COURSE_TOKEN_MAX_AGE = 12 * 60 * 60

#: Static files the Dash renderer loads; they reveal nothing, so skip the DB.
_PUBLIC_PREFIXES = ("_dash-component-suites/", "assets/", "_favicon.ico")


@dataclass(frozen=True)
class CourseContext:
    """The instructor making the request and the course they are teaching."""

    username: str
    course_id: int
    course_name: str
    base_course: str


def _secret() -> bytes:
    secret = settings.jwt_secret
    return secret if isinstance(secret, bytes) else secret.encode()


def _load_context(token: str) -> Optional[CourseContext]:
    """The instructor's context for a JWT, or None if it does not grant access."""
    try:
        # fastapi-login signs with HS256 and puts the username in ``sub``.
        payload = jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    username = payload.get("sub")
    if not username:
        return None
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                select courses.id, courses.course_name, courses.base_course
                from auth_user
                    join courses on courses.id = auth_user.course_id
                    join course_instructor
                        on course_instructor.course = courses.id
                        and course_instructor.instructor = auth_user.id
                where auth_user.username = :username
                """
            ),
            {"username": username},
        ).first()
    if row is None:
        return None
    return CourseContext(username, row.id, row.course_name, row.base_course)


def current_context() -> CourseContext:
    """The context set by :func:`require_instructor` for this request."""
    return g.rs_context


def require_instructor(url_base_pathname: str):
    """Flask ``before_request`` hook: let only instructors through.

    A browser asking for a page is sent to the login page; anything else (a
    callback's XHR) gets a bare 401/403, which Dash shows as a callback error.
    """
    path = request.path
    rel = path[len(url_base_pathname) :] if path.startswith(url_base_pathname) else ""
    if rel.startswith(_PUBLIC_PREFIXES):
        return None

    token = request.cookies.get(COOKIE_NAME)
    context = _load_context(token) if token else None
    if context is not None:
        g.rs_context = context
        return None

    wants_page = request.method == "GET" and "text/html" in request.headers.get(
        "Accept", ""
    )
    if token is None:
        if wants_page:
            # X-Original-URI is the public path when a proxy rewrote it.
            here = request.headers.get("X-Original-URI") or request.full_path
            return redirect(f"{LOGIN_URL}?next={quote(here)}")
        return "Not logged in", 401
    rslogger.info("dash: refused a request from a non-instructor")
    return (
        "You must be an instructor for your current course to view this page.",
        403,
    )


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(_secret(), salt="dash-course-context")


def sign_course(context: CourseContext) -> str:
    """A tamper-proof token carrying ``context`` to a background callback."""
    return _serializer().dumps(asdict(context))


def verify_course(token: Optional[str]) -> CourseContext:
    """The context in a token from :func:`sign_course`.

    :raises PermissionError: if the token is missing, forged or too old.
    """
    if not token:
        raise PermissionError("missing course token")
    try:
        data = _serializer().loads(token, max_age=COURSE_TOKEN_MAX_AGE)
    except BadSignature as e:
        raise PermissionError("invalid course token") from e
    return CourseContext(**data)
