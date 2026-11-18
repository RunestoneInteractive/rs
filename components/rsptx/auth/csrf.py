# ****************************************
# |docname| - Cross-site request forgery
# ****************************************
# The ``access_token`` cookie is ``SameSite=None`` in production so that LTI
# iframes work (see ``session.py``). The price is that the browser attaches it to
# a request *any* site makes to us: a student's page holding an auto-submitting
# ``<form action="https://runestone.academy/admin/auth/delete-account">`` would
# run with the full authority of whichever instructor opened it.
#
# The defence here is the one the browser hands us for free. On every request a
# modern browser says where it came from -- ``Sec-Fetch-Site``, and ``Origin`` on
# anything that is not a GET -- and page script cannot forge either header. So a
# state-changing request that carries the auth cookie must come from our own
# origin (or, when ``LOAD_BALANCER_HOST`` is set, a host under it, which is how
# the author server on its own subdomain reaches the others).
#
# What is deliberately let through:
#
# * safe methods (GET, HEAD, OPTIONS, TRACE) -- they must not change state;
# * requests without the auth cookie -- there is no ambient authority to borrow;
# * requests with neither header -- that is not a browser, and so not CSRF;
# * the paths a server passes as ``exempt_paths`` -- an LMS posts its launches
#   to us cross-site by design, and those carry their own signed proof.
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
from typing import Iterable
from urllib.parse import urlsplit

# Third-party imports
# -------------------
from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse

# Local application imports
# -------------------------
from rsptx.auth.session import auth_manager
from rsptx.configuration import settings
from rsptx.logging import rslogger

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})


def _trusted_origin(origin: str, request: Request) -> bool:
    """True if ``origin`` is this host, or the load balancer host or a subdomain of it."""
    parts = urlsplit(origin)
    if not parts.hostname:
        # Includes the literal "null" a sandboxed iframe or a cross-site
        # redirect produces.
        return False
    host = request.headers.get("host", "").lower()
    if host and parts.netloc.lower() == host:
        return True
    lb_host = (settings.load_balancer_host or "").lower()
    if lb_host:
        return parts.hostname == lb_host or parts.hostname.endswith("." + lb_host)
    return False


def is_cross_site_forgery(request: Request) -> bool:
    """Decide whether a cookie-authenticated, state-changing request came from another site."""
    fetch_site = request.headers.get("sec-fetch-site")
    if fetch_site in ("same-origin", "none"):
        return False
    if fetch_site == "cross-site":
        return True
    # ``same-site`` (a sibling subdomain, which on a university host may be
    # student web space) or a browser too old to send Sec-Fetch-Site: judge by
    # Origin.
    origin = request.headers.get("origin")
    if origin is None:
        return fetch_site is not None
    return not _trusted_origin(origin, request)


def add_csrf_protection(app: FastAPI, exempt_paths: Iterable[str] = ()) -> None:
    """
    Reject cross-site state-changing requests that carry the auth cookie.

    :param app: The FastAPI app to protect.
    :param exempt_paths: App-relative paths (what the router sees, without the
        proxy's prefix or ``root_path``) that legitimately receive cross-site
        POSTs, such as LTI launches.
    """
    exempt = frozenset(exempt_paths)

    @app.middleware("http")
    async def csrf_guard(request: Request, call_next) -> Response:
        if (
            request.method in SAFE_METHODS
            or auth_manager.cookie_name not in request.cookies
        ):
            return await call_next(request)

        path = request.url.path
        root_path = request.scope.get("root_path", "")
        if root_path and path.startswith(root_path):
            path = path[len(root_path) :]
        if path in exempt:
            return await call_next(request)

        if is_cross_site_forgery(request):
            rslogger.warning(
                f"Blocked cross-site {request.method} to {request.url.path} "
                f"(Origin: {request.headers.get('origin')}, "
                f"Sec-Fetch-Site: {request.headers.get('sec-fetch-site')})"
            )
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Cross-site request blocked."},
            )
        return await call_next(request)
