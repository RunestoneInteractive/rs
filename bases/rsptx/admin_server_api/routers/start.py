"""
start.py - Public "Getting Started" page for the admin server.

Ports the old web2py ``default/start`` roadmap (a static image-map flowchart)
into a modern, responsive, accessible page served at ``/admin/get-started``.

The page routes each visitor down one of three paths (independent learner,
student with a course code, or instructor) to their correct first action.
It is intentionally public: it must render for logged-out visitors, so it
does not depend on ``auth_manager``.
"""

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from rsptx.templates import template_folder

router = APIRouter(
    prefix="/get-started",
    tags=["get-started"],
)

templates = Jinja2Templates(directory=template_folder)


@router.get("", response_class=HTMLResponse)
@router.get("/", response_class=HTMLResponse)
async def get_started(request: Request):
    """Wayfinding page: pick who you are, then follow the steps to your first book."""
    return templates.TemplateResponse(
        "get_started.html",
        {
            "request": request,
            "page_title": "Getting Started",
        },
    )
