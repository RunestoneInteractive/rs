import datetime
import pandas as pd

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import create_engine
from pydantic import BaseModel
from typing import List, Optional

# Local application imports
# -------------------------

from rsptx.db.crud import (
    fetch_assignment_questions,
    fetch_assignments,
    fetch_questions_by_search_criteria,
    fetch_question_count_per_subchapter,
    create_assignment_question,
    create_question,
    fetch_course,
    create_assignment,
    fetch_questions_for_chapter_subchapter,
    remove_assignment_questions,
    reorder_assignment_questions,
    update_assignment_question,
    update_assignment,
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
    SearchSpecification,
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
async def get_assignment_gb(
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
        rslogger.error(f"Error creating assignment: {new_assignment}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating assignment: {str(e)}",
        )

    return make_json_response(
        status=status.HTTP_201_CREATED, detail={"status": "success", "id": res.id}
    )


@router.post("/update_assignment")
async def do_update_assignment(
    request: Request,
    request_data: AssignmentValidator,
    user=Depends(auth_manager),
    response_class=JSONResponse,
):
    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED, detail="not an instructor"
        )
    course = await fetch_course(user.course_name)
    request_data.course = course.id
    rslogger.debug(f"Updating assignment: {request_data}")
    if request_data.current_index is None:
        request_data.current_index = 0
    try:
        await update_assignment(request_data)
    except Exception as e:
        rslogger.error(f"Error updating assignment: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error updating assignment: {str(e)}",
        )
    return make_json_response(status=status.HTTP_200_OK, detail={"status": "success"})


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


@router.get("/assignments")
async def get_assignments(
    request: Request, user=Depends(auth_manager), response_class=JSONResponse
):
    # get the course
    course = await fetch_course(user.course_name)

    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED, detail="not an instructor"
        )

    # todo: update fetch to only get new style??
    assignments = await fetch_assignments(course.course_name, is_visible=True)
    rslogger.debug(f"Got assignments: {assignments} for {course.course_name}")

    return make_json_response(
        status=status.HTTP_200_OK, detail={"assignments": assignments}
    )


class AQRequest(BaseModel):
    assignment: int


@router.post("/assignment_questions")
async def get_assignment_questions(
    request: Request,
    request_data: AQRequest,
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

    res = await fetch_assignment_questions(request_data.assignment)
    countd = await fetch_question_count_per_subchapter(course.base_course)

    # res has two components: AssignmentQuestion and Question
    # res.AssignmentQuestion all the assignment question data
    # res.Question all the question data

    rslogger.debug(f"Got assignment questions: {res} for {request_data.assignment}")

    qlist = []
    for row in res:
        aq = AssignmentQuestionValidator.from_orm(row.AssignmentQuestion).model_dump()
        q = QuestionValidator.from_orm(row.Question).model_dump()
        if q["qnumber"] is not None:
            aq["qnumber"] = q["qnumber"]
        else:
            aq["qnumber"] = q["name"]

        if aq["reading_assignment"] == True:
            aq["numQuestions"] = countd[q["chapter"]][q["subchapter"]]

        # augment the assignment question with additional question data
        aq["name"] = q["name"]
        aq["subchapter"] = q["subchapter"]
        aq["chapter"] = q["chapter"]
        aq["base_course"] = q["base_course"]
        qlist.append(aq)

    rslogger.debug(f"qlist: {qlist}")

    return make_json_response(status=status.HTTP_200_OK, detail={"exercises": qlist})


@router.post("/update_assignment_question")
async def up_assignment_question(
    request: Request,
    request_data: AssignmentQuestionValidator,
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
    try:
        await update_assignment_question(
            AssignmentQuestionValidator(**request_data.model_dump())
        )
    except Exception as e:
        rslogger.error(f"Error updating assignment question: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error updating assignment question: {str(e)}",
        )
    return make_json_response(status=status.HTTP_200_OK, detail={"status": "success"})


@router.post("/remove_assignment_questions")
async def remove_assignment_questions_ep(
    request: Request,
    request_data: List[int],
    user=Depends(auth_manager),
    response_class=JSONResponse,
):
    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED, detail="not an instructor"
        )
    rslogger.debug(f"Removing assignment questions: {request_data}")
    try:
        await remove_assignment_questions(request_data)
    except Exception as e:
        rslogger.error(f"Error removing assignment questions: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error removing assignment questions: {str(e)}",
        )
    return make_json_response(status=status.HTTP_200_OK, detail={"status": "success"})


@router.post("/reorder_assignment_questions")
async def reorder_assignment_questions_ep(
    request: Request,
    request_data: List[int],
    user=Depends(auth_manager),
    response_class=JSONResponse,
):
    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED, detail="not an instructor"
        )

    try:
        await reorder_assignment_questions(request_data)
    except Exception as e:
        rslogger.error(f"Error reordering assignment questions: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error reordering assignment questions: {str(e)}",
        )
    return make_json_response(status=status.HTTP_200_OK, detail={"status": "success"})


class PickerOptions(BaseModel):
    skipreading: Optional[bool] = False
    from_source_only: Optional[bool] = True
    pages_only: Optional[bool] = False


@router.post("/fetch_chooser_data")
async def fetch_chooser_data(
    request: Request,
    request_data: PickerOptions,
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
    res = await fetch_questions_for_chapter_subchapter(
        course.base_course,
        skipreading=request_data.skipreading,
        from_source_only=request_data.from_source_only,
        pages_only=request_data.pages_only,
    )
    return make_json_response(status=status.HTTP_200_OK, detail={"questions": res})


@router.post("/search_questions")
async def search_questions(
    request: Request,
    request_data: SearchSpecification,
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

    if request_data.source_regex:
        words = request_data.source_regex.replace(",", " ")
        words = request_data.source_regex.split()
        request_data.source_regex = ".*(" + "|".join(words) + ").*"
        request_data.author = ".*" + request_data.author + ".*"
    if request_data.base_course == "true":
        request_data.base_course = course.base_course
    else:
        request_data.base_course = None

    res = await fetch_questions_by_search_criteria(request_data)

    qlist = []
    for row in res:
        row.timestamp = row.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        qlist.append(row.model_dump())
    rslogger.debug(f"qlist: {qlist}")
    return make_json_response(status=status.HTTP_200_OK, detail={"questions": qlist})
