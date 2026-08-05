"""
root.py - The site's front door.

The proxy sends every request that no other server claims here (see
``projects/caddy/Caddyfile``). This replaces web2py's ``default/index`` as
the landing behaviour:

* a visitor with a valid ``access_token`` cookie goes to their current course
* everyone else goes to ``settings.landing_page_url``

It also serves the files a browser or crawler expects at the site root --
``/favicon.ico``, ``/robots.txt``, ``/ads.txt``. Those used to come from
web2py's static folder, which is unreachable in a deployment that runs
without the legacy ``runestone`` container.

Finally it carries the health checks. Because this server now answers every
otherwise-unclaimed URL, "is admin up?" is the same question as "is this node
usable?", which is exactly what a load balancer wants to know.
"""

import asyncio
import pathlib

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from sqlalchemy import text

from rsptx.auth.session import auth_manager
from rsptx.configuration import settings
from rsptx.db.async_session import async_session
from rsptx.logging import rslogger
from rsptx.templates import template_folder

router = APIRouter(
    tags=["root"],
)

# The course home page lives on the book server; a user with no course yet has
# to pick one before that page can render.
_COURSE_HOME = "/ns/course/index"
_PICK_COURSE = "/admin/auth/courses"

# The canonical copies live in the shared templates component, which is also
# what gets baked into the proxy images as /srv/staticAssets.
_STATIC_ASSETS = pathlib.Path(template_folder) / "staticAssets"

# These change about once a decade; let browsers and crawlers hang on to them.
_ROOT_FILE_CACHE = {"Cache-Control": "public, max-age=86400"}

# A health check must never be answered from a cache, or the load balancer is
# reading history rather than the current state of this node.
_NO_CACHE = {"Cache-Control": "no-store"}

# Long enough that a busy-but-working database still passes, short enough that
# a wedged one is reported rather than waited on.
_READY_TIMEOUT_SECONDS = 5


@router.get("/root")
async def root(request: Request, user=Depends(auth_manager.optional)):
    """Send the visitor to their course, or to the public landing page.

    ``auth_manager.optional`` never raises: a missing, expired or otherwise
    invalid ``access_token`` cookie simply yields ``None``, which is treated
    the same as being logged out.
    """
    # fetch_user can return an empty validator rather than None, so check id.
    if not (user and user.id):
        return RedirectResponse(
            settings.landing_page_url, status_code=status.HTTP_302_FOUND
        )

    if not user.course_id:
        return RedirectResponse(_PICK_COURSE, status_code=status.HTTP_302_FOUND)

    return RedirectResponse(_COURSE_HOME, status_code=status.HTTP_302_FOUND)


# ---------------------------------------------------------------------------
# Site-root files
# ---------------------------------------------------------------------------
# The proxy routes these paths here untouched (they are NOT rewritten to
# /root), so the public URL stays exactly where browsers and crawlers look.


@router.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """The tab icon. Browsers request this from the site root unprompted."""
    return FileResponse(
        _STATIC_ASSETS / "favicon.ico",
        media_type="image/x-icon",
        headers=_ROOT_FILE_CACHE,
    )


@router.get("/robots.txt", include_in_schema=False)
async def robots():
    """Crawler rules. Books are indexable; the auth/instructor surface is not."""
    return FileResponse(
        _STATIC_ASSETS / "robots.txt",
        media_type="text/plain",
        headers=_ROOT_FILE_CACHE,
    )


@router.get("/ads.txt", include_in_schema=False)
async def ads():
    """Authorized Digital Sellers record; must be served from the site root."""
    return FileResponse(
        _STATIC_ASSETS / "ads.txt",
        media_type="text/plain",
        headers=_ROOT_FILE_CACHE,
    )


# ---------------------------------------------------------------------------
# Health checks
# ---------------------------------------------------------------------------
# Two checks, because a load balancer and a human are asking different
# questions. Point the load balancer at /health and monitoring at /health/ready.


@router.get("/health", include_in_schema=False)
async def health():
    """Liveness: is this process accepting and answering requests?

    Deliberately touches nothing external -- no database, no redis. This is
    what the load balancer polls, and a check that depends on a shared
    resource fails on every node at once when that resource hiccups, so the
    load balancer drains the whole pool and turns a degraded site into a dead
    one. Use /health/ready when you want to know about dependencies.
    """
    return JSONResponse({"status": "ok"}, headers=_NO_CACHE)


@router.get("/health/ready", include_in_schema=False)
async def ready():
    """Readiness: can this node actually do useful work?

    Adds a trivial round trip to the database. Returns 503 when that fails, so
    monitoring and deploy gates can tell "serving errors" apart from "down".
    Not for the load balancer -- see the note in :func:`health`.
    """
    try:
        # Bounded on purpose. A refused connection raises immediately, but a
        # database that accepts the socket and then stops answering would hang
        # this request indefinitely -- and a health check that hangs looks the
        # same as one that passes to anything with a generous timeout.
        async with asyncio.timeout(_READY_TIMEOUT_SECONDS):
            async with async_session() as session:
                await session.execute(text("select 1"))
    except Exception as e:
        rslogger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            {"status": "error", "database": "unavailable"},
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            headers=_NO_CACHE,
        )

    return JSONResponse({"status": "ok", "database": "ok"}, headers=_NO_CACHE)
