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

from typing import Optional

# Third-party imports
# -------------------
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from rsptx.db.crud import (
    fetch_assignments,
    fetch_all_assignment_stats,
    fetch_grade,
    upsert_grade,
)

from rsptx.db.models import GradeValidator

from fastapi.templating import Jinja2Templates

from rsptx.auth.session import auth_manager
from rsptx.templates import template_folder
from rsptx.response_helpers.core import make_json_response


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

    templates = Jinja2Templates(directory=template_folder)

    assignments = await fetch_assignments(course)
    stats_list = await fetch_all_assignment_stats(course, user.id)
    stats = {}
    for s in stats_list:
        stats[s.assignment] = s
    rslogger.debug(f"stats: {stats}")
    return templates.TemplateResponse(
        "assignment/student/chooseAssignment.html",
        {
            "assignment_list": assignments,
            "stats": stats,
            "course": course,
            "user": sid,
            "request": request,
        },
    )


import pdb


class UpdateStatusRequest(BaseModel):
    """
    This is the request data for the update_submit endpoint. We use a Pydantic model so that
    the data is validated before it is passed to the endpoint.
    """

    assignment_id: int
    new_state: Optional[str]


@router.post("/update_submit")
async def update_submit(
    request: Request,
    request_data: UpdateStatusRequest,
    user=Depends(auth_manager),
    response_class=JSONResponse,
):
    """Update the submit date for an assignment.

    This is an API endpoint that is called by the client to update the status of an assignment.
    The endpoint is called updateAssignmentProgress and is defined in assignmentStatus.js.

    :param request: _description_
    :type request: Request
    :param user: _description_, defaults to Depends(auth_manager
    :type user: _type_, optional
    :param response_class: _description_, defaults to JSONResponse
    :type response_class: _type_, optional
    """

    assignment_id = request_data.assignment_id
    is_submit = request_data.new_state

    grade = await fetch_grade(user.id, assignment_id)
    rslogger.debug(f"grade: {grade}")
    if grade:
        # toggles the is_submit variable from True to False
        # keep this clause for backward compatibility
        if is_submit is None:
            if grade.is_submit == "In Progress":
                grade.is_submit = "Finished"
            elif grade.is_submit == "Finished":
                grade.is_submit = "Not Started"
            else:
                grade.is_submit = "In Progress"
        else:
            grade.is_submit = is_submit
    else:
        grade = GradeValidator(
            auth_user=user.id,
            assignment=assignment_id,
            is_submit=is_submit,
            manual_total=False,
        )
    await upsert_grade(grade)

    return make_json_response(detail=dict(success=True))
