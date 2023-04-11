# *************************
# |docname| - Runestone API
# *************************
# This module implements the Student facing API for assignments
#
# *     chooseAssignment
# *     doAssignment
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import datetime
import random
from typing import Optional, Dict, Any

# Third-party imports
# -------------------
from bleach import clean
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from rsptx.db.crud import fetch_assignments, fetch_all_assignment_stats
from fastapi.templating import Jinja2Templates

from rsptx.auth.session import is_instructor, auth_manager

from ..localconfig import local_settings

# Routing
# =======
# See `APIRouter config` for an explanation of this approach.
router = APIRouter(
    prefix="/student",
    tags=["student"],
)


# getAssessResults
# ----------------
@router.get("/chooseAssignment")
async def get_assignments(
    request: Request, user=Depends(auth_manager), response_class=HTMLResponse
):
    """Create the chooseAssignment page for the user.

    :param request: _description_
    :type request: Request
    :param user: _description_, defaults to Depends(auth_manager
    :type user: _type_, optional
    :param response_class: _description_, defaults to HTMLResponse
    :type response_class: _type_, optional
    """

    sid = user.username
    course = user.course_name

    templates = Jinja2Templates(
        directory=f"{local_settings._assignment_server_path}/templates{router.prefix}"
    )
    rslogger.debug(f"{local_settings._assignment_server_path}/templates{router.prefix}")
    assignments = await fetch_assignments(course)
    stats_list = await fetch_all_assignment_stats(course, user.id)
    stats = {}
    for s in stats_list:
        stats[s.assignment] = s
    rslogger.debug(f"stats: {stats}")
    return templates.TemplateResponse(
        "chooseAssignment.html",
        {
            "assignment_list": assignments,
            "stats": stats,
            "course": course,
            "user": sid,
            "request": request,
        },
    )
