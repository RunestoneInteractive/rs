import datetime
import pandas as pd

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import create_engine

# Local application imports
# -------------------------

from rsptx.db.crud import (
    create_assignment_question,
    create_question,
    fetch_course,
    create_assignment,
)
from rsptx.auth.session import auth_manager, is_instructor
from rsptx.templates import template_folder
from rsptx.configuration import settings
from rsptx.response_helpers.core import make_json_response
from rsptx.db.models import (
    AssignmentQuestionValidator,
    AssignmentValidator,
    QuestionValidator,
)
from rsptx.validation.schemas import (
    AssignmentIncoming,
    AssignmentQuestionIncoming,
    QuestionIncoming,
)
from rsptx.logging import rslogger

# Routing
# =======
# See `APIRouter config` for an explanation of this approach.
router = APIRouter(
    prefix="/instructor",
    tags=["instructor"],
)


@router.get("/gradebook")
async def get_assignments(
    request: Request, user=Depends(auth_manager), response_class=HTMLResponse
):
    # get the course
    course = await fetch_course(user.course_name)

    if settings.server_config == "development":
        dburl = settings.dev_dburl
    elif settings.server_config == "production":
        dburl = settings.dburl
    eng = create_engine(dburl)

    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return RedirectResponse(url="/")

    classid = course.id

    df = pd.read_sql(
        """
    select score, points, assignments.id as assignment, auth_user.id as sid, is_submit
    from auth_user join grades on (auth_user.id = grades.auth_user)
    join assignments on (grades.assignment = assignments.id)
    where points is not null and assignments.course = %s
    order by last_name, first_name, assignments.duedate, assignments.id
    """,
        eng,
        params=(classid,),
    )

    assignments = pd.read_sql(
        """
    select id, name from assignments where course = %s order by duedate, id
                    """,
        eng,
        params=(classid,),
    )

    students = pd.read_sql(
        """
        select auth_user.id, username, first_name, last_name, email from auth_user join user_courses on auth_user.id = user_id
        join courses on user_courses.course_id = courses.id
        where courses.id = %s order by last_name, first_name
        """,
        eng,
        params=(classid,),
    )

    assignments.index = assignments.id
    aname = assignments.name.to_dict()
    students["full_name"] = students.first_name + " " + students.last_name
    students.index = students.id
    sfirst = students.first_name.to_dict()
    slast = students.last_name.to_dict()
    semail = students.email.to_dict()
    pt = df.pivot(index="sid", columns="assignment", values="score").rename(
        columns=aname
    )

    cols = pt.columns.to_list()
    pt["first_name"] = pt.index.map(sfirst)
    pt["last_name"] = pt.index.map(slast)
    pt["email"] = pt.index.map(semail)
    pt = pt.sort_values(by=["last_name", "first_name"])
    pt = pt[["first_name", "last_name", "email"] + cols]
    pt = pt.reset_index()
    pt = pt.drop(columns=["sid"], axis=1)
    pt.columns.name = None

    templates = Jinja2Templates(directory=template_folder)

    return templates.TemplateResponse(
        "assignment/instructor/gradebook.html",
        {
            "table_html": pt.to_html(
                table_id="table",
                columns=["first_name", "last_name", "email"] + cols,
                index=False,
                na_rep="",
            ),
            "course": course,
            "user": user.username,
            "request": request,
            "is_instructor": user_is_instructor,
            "student_page": False,
        },
    )


@router.post("/new_assignment")
async def new_assignment(
    request_data: AssignmentIncoming,
    request: Request,
    user=Depends(auth_manager),
    response_class=JSONResponse,
):
    # get the course
    course = await fetch_course(user.course_name)

    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED, detail="not an instructor"
        )

    new_assignment = AssignmentValidator(
        **request_data.model_dump(),
        course=course.id,
        visible=True,
        released=False,
        from_source=False,
        is_peer=False,
        current_index=0,
        enforce_due=False,
        peer_async_visible=False,
    )
    try:
        res = await create_assignment(new_assignment)
        rslogger.debug(f"Created assignment: {res} {res.id}")
    except Exception as e:
        rslogger.error(f"Error creating assignment: {res}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating assignment: {str(e)}",
        )

    return make_json_response(
        status=status.HTTP_201_CREATED, detail={"status": "success", "id": res.id}
    )


@router.post("/new_question")
async def new_question(
    request_data: QuestionIncoming,
    request: Request,
    user=Depends(auth_manager),
    response_class=JSONResponse,
):
    # get the course
    course = await fetch_course(user.course_name)

    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED, detail="not an instructor"
        )

    # First create the question
    new_question = QuestionValidator(
        **request_data.model_dump(),
        base_course=course.base_course,
        chapter="test",
        subchapter="test",
        timestamp=datetime.datetime.utcnow(),
        is_private=False,
        practice=False,
        from_source=False,
        review_flag=False,
    )
    try:
        q = await create_question(new_question)
    except Exception as e:
        rslogger.error(f"Error creating question: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating question: {str(e)}",
        )

    return make_json_response(
        status=status.HTTP_201_CREATED, detail={"status": "success", "id": q.id}
    )


@router.post("/new_assignment_q")
async def new_assignment_question(
    request_data: AssignmentQuestionIncoming,
    request: Request,
    user=Depends(auth_manager),
    response_class=JSONResponse,
):
    new_aq = AssignmentQuestionValidator(
        **request_data.model_dump(),
        timed=False,
        autograde="pct_correct",
        which_to_grade="best_answer",
        sorting_priority=0,
    )

    try:
        res = await create_assignment_question(new_aq)
        rslogger.debug(f"Created assignment question: {res} {res.id}")
    except Exception as e:
        rslogger.error(f"Error creating assignment question: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating assignment question: {str(e)}",
        )

    return make_json_response(
        status=status.HTTP_201_CREATED, detail={"status": "success", "id": res.id}
    )
