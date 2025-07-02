import csv
import datetime
import json
import pathlib
import pandas as pd
import io

from .assignment_summary import create_assignment_summary

from fastapi import (
    APIRouter,
    Cookie,
    HTTPException,
    Depends,
    Request,
    status,
    Form,
)
from fastapi.responses import (
    HTMLResponse,
    RedirectResponse,
    JSONResponse,
    StreamingResponse,
)
from fastapi.templating import Jinja2Templates
from sqlalchemy import create_engine
from pydantic import BaseModel
from typing import List, Optional, Annotated

# Local application imports
# -------------------------

from rsptx.db.crud import (
    create_invoice_request,
    delete_lti_course,
    fetch_assignment_questions,
    fetch_assignments,
    fetch_problem_data,
    fetch_questions_by_search_criteria,
    fetch_question_count_per_subchapter,
    fetch_all_course_attributes,
    create_assignment_question,
    create_deadline_exception,
    create_question,
    delete_course_instructor,
    fetch_course,
    fetch_course_by_id,
    fetch_instructor_courses,
    fetch_users_for_course,
    fetch_subchapters,
    create_assignment,
    fetch_questions_for_chapter_subchapter,
    remove_assignment_questions,
    reorder_assignment_questions,
    update_assignment_question,
    update_multiple_assignment_questions,
    update_assignment_exercises,
    update_assignment,
    update_question,
    fetch_one_assignment,
    get_peer_votes,
    search_exercises,
    create_api_token,
)
from rsptx.db.crud.question import validate_question_name_unique, copy_question
from rsptx.db.crud.assignment import add_assignment_question, delete_assignment
from rsptx.auth.session import auth_manager, is_instructor
from rsptx.templates import template_folder
from rsptx.configuration import settings
from rsptx.response_helpers.core import (
    make_json_response,
    get_webpack_static_imports,
    get_react_imports,
    canonical_utcnow,
)
from rsptx.db.models import (
    AssignmentQuestionValidator,
    AssignmentValidator,
    QuestionValidator,
)
from rsptx.endpoint_validators import with_course, instructor_role_required
from rsptx.validation.schemas import (
    AssignmentIncoming,
    AssignmentQuestionIncoming,
    QuestionIncoming,
    SearchSpecification,
    UpdateAssignmentExercisesPayload,
    AssignmentQuestionUpdateDict,
    ExercisesSearchRequest,
    CreateExercisesPayload,
    ValidateQuestionNameRequest,
    CopyQuestionRequest,
)
from rsptx.logging import rslogger
from rsptx.analytics import log_this_function
from rsptx.data_types.which_to_grade import WhichToGradeOptions
from rsptx.data_types.autograde import AutogradeOptions
from rsptx.data_types.language import LanguageOptions
from rsptx.data_types.question_type import QuestionType

from .student import get_course_url

# Routing
# =======
# See `APIRouter config` for an explanation of this approach.
router = APIRouter(
    prefix="/instructor",
    tags=["instructor"],
)


@router.get("/reviewPeerAssignment")
async def review_peer_assignment(
    request: Request,
    assignment_id: Optional[int] = None,
    user=Depends(auth_manager),
):
    """
    This is the endpoint for reviewing a peer assignment. It is used by instructors to review peer assignments.
    """
    # Fetch the course
    course = await fetch_course(user.course_name)

    if assignment_id is None:
        rslogger.error("BAD ASSIGNMENT = %s assignment %s", course, assignment_id)
        return RedirectResponse("/runestone/peer/instructor.html")

    # Check if the user is an instructor
    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "not an instructor"},
        )

    # Fetch course attributes
    course_attrs = await fetch_all_course_attributes(course.id)
    course_origin = course_attrs.get("markup_system", "Runestone")

    # Fetch assignment details
    assignment = await fetch_one_assignment(assignment_id)

    if not assignment:
        rslogger.error(
            "NO ASSIGNMENT assign_id = %s course = %s user = %s",
            assignment_id,
            course,
            user.username,
        )
        return RedirectResponse("/runestone/peer/instructor.html")

    if (
        assignment.visible == "F"
        or assignment.visible is None
        or assignment.visible == False
    ):
        if not user_is_instructor:
            rslogger.error(
                f"Attempt to access invisible assignment {assignment_id} by {user.username}"
            )
            return RedirectResponse("/runestone/peer/instructor.html")

    # Fetch questions within the assignment
    questions = await fetch_assignment_questions(assignment_id)
    questions_list = []

    for q in questions:
        # Gathering information about each question
        answer = None
        feedback = None
        if q.Question.htmlsrc:
            # This replacement is to render images
            bts = q.Question.htmlsrc
            htmlsrc = bts.replace(
                'src="../_static/', 'src="' + get_course_url(course, "_static/")
            )
            htmlsrc = htmlsrc.replace("../_images", get_course_url(course, "_images"))

            # Rewrite xref links and knowls in fillintheblank questions
            if "fillintheblank" in htmlsrc:
                htmlsrc = htmlsrc.replace(
                    'href="', f'href="/ns/books/published/{course.base_course}/'
                )

            # Unescape contents of script tags in fitb questions.
            if "application/json" in htmlsrc:
                htmlsrc = htmlsrc.replace("&lt;", "<")
                htmlsrc = htmlsrc.replace("&gt;", ">")
                htmlsrc = htmlsrc.replace("&amp;", "&")

            if 'data-knowl="./' in htmlsrc:
                htmlsrc = htmlsrc.replace(
                    'data-knowl="./',
                    f'data-knowl="/ns/books/published/{course.base_course}/',
                )
        else:
            htmlsrc = None

        # Call the internal API to get the aggregate peer votes
        vote_1_results = await get_peer_votes(q.Question.name, course.course_name, 1)
        vote_2_results = await get_peer_votes(q.Question.name, course.course_name, 2)
        total_votes = {
            "vote_1": aggregate_peer_votes(vote_1_results["acts"]),
            "vote_2": aggregate_peer_votes(vote_2_results["acts"]),
        }

        question_info = {
            "id": q.Question.id,
            "name": q.Question.name,
            "chapter": q.Question.chapter,
            "subchapter": q.Question.subchapter,
            "htmlsrc": htmlsrc,
            "question_type": q.Question.question_type,
            "points": q.AssignmentQuestion.points,
            "activities_required": q.AssignmentQuestion.activities_required,
            "reading_assignment": q.AssignmentQuestion.reading_assignment,
            "total_votes": total_votes,
        }
        questions_list.append(question_info)

    # Context dictionary to send in the JSON response
    context = {
        "message": f"Reviewing assignment {assignment_id}",
        "course": course,
        "user": user,
        "is_instructor": user_is_instructor,
        "request": request,
        "assignment_details": {
            "id": assignment.id,
            "name": assignment.name,
            "due_date": assignment.duedate.strftime("%Y-%m-%d %H:%M:%S"),
            "visible": assignment.visible,
            "released": assignment.released,
            "description": assignment.description,
        },
        "origin": course_origin,
        "questions": questions_list,
        "ptx_js_version": course_attrs.get("ptx_js_version", "0.2"),
        "webwork_js_version": course_attrs.get("webwork_js_version", "2.17"),
        "latex_preamble": course_attrs.get("latex_macros", ""),
        "wp_imports": get_webpack_static_imports(course),
        "settings": settings,
    }

    templates = Jinja2Templates(directory=template_folder)
    response = templates.TemplateResponse(
        "assignment/instructor/reviewPeerAssignment.html", context
    )

    return response


def aggregate_peer_votes(votes: List[str]):
    """
    Aggregate the peer votes for a voting stage given a list of useinfo acts.
    """
    # Dictionary to hold the counts
    counts = {}
    # Count the occurrences of each unique entry
    for vote in votes:
        components = vote.split(":")
        choice = components[1]

        if choice in counts:
            counts[choice] += 1
        else:
            counts[choice] = 1

    return {"counts": counts}


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
    suser = students.username.to_dict()
    pt = df.pivot(index="sid", columns="assignment", values="score").rename(
        columns=aname
    )

    cols = pt.columns.to_list()
    pt["first_name"] = pt.index.map(sfirst)
    pt["last_name"] = pt.index.map(slast)
    pt["email"] = pt.index.map(semail)
    pt["username"] = pt.index.map(suser)
    pt = pt.sort_values(by=["last_name", "first_name"])
    pt = pt[["first_name", "last_name", "email", "username"] + cols]
    pt = pt.reset_index()
    pt = pt.drop(columns=["sid"], axis=1)
    pt.columns.name = None

    names = {}
    for ix, row in pt.iterrows():
        if type(row.first_name) is str and type(row.last_name) is str:
            names[row.username] = row.first_name + " " + row.last_name

    pt = pt.drop(columns=["username"], axis=1)
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
            "pt": names,
            "course": course,
            "user": user.username,
            "request": request,
            "is_instructor": user_is_instructor,
            "student_page": False,
        },
    )


@router.get("/assignments")
@instructor_role_required()
@with_course()
async def get_assignments(
    request: Request,
    course=None,
):
    # todo: update fetch to only get new style??
    assignments = await fetch_assignments(course.course_name, fetch_all=True)
    rslogger.debug(f"Got assignments: {assignments} for {course.course_name}")

    return make_json_response(
        status=status.HTTP_200_OK, detail={"assignments": assignments}
    )


@router.get("/assignments/{assignment_id}")
@instructor_role_required()
async def get_assignment(request: Request, assignment_id: int):
    # todo: update fetch to only get new style??
    assignment = await fetch_one_assignment(assignment_id)
    rslogger.debug(f"Got assignment: {assignment}")

    return make_json_response(
        status=status.HTTP_200_OK, detail={"assignment": assignment}
    )


@router.post("/assignments")
@instructor_role_required()
@with_course()
async def new_assignment(
    request_data: AssignmentIncoming,
    request: Request,
    course=None,
):
    if request_data.kind == "Timed":
        request_data.is_timed = True
    elif request_data.kind == "Peer":
        request_data.is_peer = True
        
    new_assignment = AssignmentValidator(
        **request_data.model_dump(),
        course=course.id,
        visible=False,
        released=False,
        from_source=False,
        is_peer=False,
        current_index=0,
        enforce_due=False,
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


@router.put("/assignments/{assignment_id}")
@instructor_role_required()
@with_course()
async def do_update_assignment(
    request: Request,
    request_data: AssignmentValidator,
    course=None,
):
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


@router.get("/sections_for_chapter/{chapter}")
@instructor_role_required()
@with_course()
async def get_sections_for_chapter(
    request: Request,
    chapter: str,
    user=Depends(auth_manager),
    course=None,
    response_class=JSONResponse,
):
    """
    Get sections for a specific chapter.
    Specifically the section title and section label
    """
    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED, detail="not an instructor"
        )

    sections = await fetch_subchapters(course.base_course, chapter)
    # make a list of dictionaries with section title and label
    sections = [
        {"title": section.sub_chapter_name, "label": section.sub_chapter_label}
        for section in sections
        if section.sub_chapter_name and section.sub_chapter_label
    ]
    return make_json_response(status=status.HTTP_200_OK, detail={"sections": sections})


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

    if request_data.author is None:
        request_data.author = user.first_name + " " + user.last_name

    if request_data.subchapter is None:
        request_data.subchapter = "Exercises"
    # First create the question
    new_question = QuestionValidator(
        **request_data.model_dump(),
        base_course=course.base_course,
        timestamp=canonical_utcnow(),
        is_private=False,
        practice=False,
        from_source=False,
        review_flag=False,
        owner=user.username,
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


@router.post("/update_question")
async def do_update_question(
    request: Request,
    request_data: QuestionIncoming,
    user=Depends(auth_manager),
    response_class=JSONResponse,
):
    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED, detail="not an instructor"
        )
    course = await fetch_course(user.course_name)
    rslogger.debug(f"Updating question: {request_data}")
    if request_data.author is None:
        request_data.author = user.first_name + " " + user.last_name
    if request_data.subchapter is None:
        request_data.subchapter = "Exercises"
    req = request_data.model_dump()
    req["question"] = req["source"]
    del req["source"]
    upd_question = QuestionValidator(
        **req,
        base_course=course.base_course,
        timestamp=canonical_utcnow(),
        is_private=False,
        practice=False,
        from_source=False,
        review_flag=False,
    )

    try:
        await update_question(upd_question)
    except Exception as e:
        rslogger.error(f"Error updating question: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error updating question: {str(e)}",
        )
    return make_json_response(
        status=status.HTTP_200_OK, detail={"status": "success", "id": upd_question.id}
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
            try:
                aq["numQuestions"] = countd[q["chapter"]][q["subchapter"]]
            except KeyError:
                aq["numQuestions"] = 0

        # augment the assignment question with additional question data
        aq["name"] = q["name"]
        aq["subchapter"] = q["subchapter"]
        aq["chapter"] = q["chapter"]
        aq["base_course"] = q["base_course"]
        aq["htmlsrc"] = q["htmlsrc"]
        aq["question_type"] = q["question_type"]
        aq["question_json"] = q["question_json"]
        aq["owner"] = q["owner"]
        aq["tags"] = q["tags"]
        aq["topic"] = q["topic"]
        aq["author"] = q["author"]
        aq["difficulty"] = q["difficulty"]
        aq["is_private"] = q["is_private"]
        qlist.append(aq)

    rslogger.debug(f"qlist: {qlist}")

    return make_json_response(status=status.HTTP_200_OK, detail={"exercises": qlist})


@router.put("/assignment_question/batch")
@instructor_role_required()
@with_course()
async def assignment_questions_batch(
    request: Request,
    request_data: list[AssignmentQuestionUpdateDict],
    user=Depends(auth_manager),
    response_class=JSONResponse,
    course=None,
):
    """
    Update multiple assignment questions and their associated questions in batch.
    The request_data is validated to ensure it contains required fields from both
    AssignmentQuestionValidator and QuestionValidator.
    """
    try:
        await update_multiple_assignment_questions(request_data)
    except Exception as e:
        rslogger.error(f"Error updating assignment questions: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error updating assignment questions: {str(e)}",
        )
    return make_json_response(status=status.HTTP_200_OK, detail={"status": "success"})


@router.put("/assignment_question")
@instructor_role_required()
@with_course()
async def up_assignment_question(
    request: Request,
    request_data: AssignmentQuestionValidator,
    user=Depends(auth_manager),
    response_class=JSONResponse,
    course=None,
):
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


@router.put("/assignment_exercises")
@instructor_role_required()
async def put_assignment_exercises(
    request: Request,
    request_data: UpdateAssignmentExercisesPayload,
):
    rslogger.debug(f"Received payload: {request_data.dict()}")
    try:
        exercises = await update_assignment_exercises(request_data)
        return make_json_response(
            status=status.HTTP_200_OK,
            detail={"status": "success", "exercises": exercises},
        )
    except Exception as e:
        rslogger.error(f"Error updating assignment exercises: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error updating assignment exercises: {str(e)}",
        )


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


@router.post("/exercises/search")
@instructor_role_required()
@with_course()
async def search_exercises_endpoint(
    request: Request,
    search_request: ExercisesSearchRequest,
    user=Depends(auth_manager),
    response_class=JSONResponse,
    course=None,
):
    """
    Smart search for exercises with pagination, filtering, and sorting.

    - Uses consolidated filters object for all filter types including text search
    - Supports base_course flag to automatically use the current course's base course
    - Flexible sorting options
    - Advanced pagination
    """
    # Set base course if flag is enabled
    if search_request.use_base_course:
        search_request.base_course = course.base_course

    # Perform exercise search
    result = await search_exercises(search_request)

    # Convert timestamps to strings for JSON
    exercises = []
    for exercise in result["exercises"]:
        exercise_dict = exercise.model_dump()
        if hasattr(exercise, "timestamp") and exercise.timestamp:
            exercise_dict["timestamp"] = exercise.timestamp.strftime(
                "%Y-%m-%d %H:%M:%S"
            )
        exercises.append(exercise_dict)

    return make_json_response(
        status=status.HTTP_200_OK,
        detail={"exercises": exercises, "pagination": result["pagination"]},
    )


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


@router.get("/builder")
@router.get("/builder/{path:path}")
async def get_builder(
    request: Request,
    path: str = "",
    user=Depends(auth_manager),
    response_class=HTMLResponse,
):
    # get the course
    course = await fetch_course(user.course_name)
    await log_this_function(user)
    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return RedirectResponse(url="/")

    reactdir = pathlib.Path(__file__).parent.parent / "react"
    templates = Jinja2Templates(directory=template_folder)
    wp_imports = get_webpack_static_imports(course)
    react_imports = get_react_imports(reactdir)
    course_attrs = await fetch_all_course_attributes(course.id)

    return templates.TemplateResponse(
        "assignment/instructor/builder.html",
        {
            "course": course,
            "request": request,
            "is_instructor": user_is_instructor,
            "student_page": False,
            "wp_imports": wp_imports,
            "react_imports": react_imports,
            "settings": settings,
            "latex_preamble": course_attrs.get("latex_macros", ""),
            "ptx_js_version": course_attrs.get("ptx_js_version", "0.2"),
            "webwork_js_version": course_attrs.get("webwork_js_version", "2.17"),
            "user": user,
        },
    )

    # with open(reactdir / "index.html") as f:
    #     content = f.read()
    # return HTMLResponse(content=content)


@router.get("/grader")
async def get_grader(
    request: Request, user=Depends(auth_manager), response_class=HTMLResponse
):
    return await get_builder(request, "/grader", user, response_class)


@router.get("/except")
async def get_except(
    request: Request, user=Depends(auth_manager), response_class=HTMLResponse
):
    return await get_builder(request, "/except", user, response_class)


@router.get("/admin")
async def get_admin(
    request: Request, user=Depends(auth_manager), response_class=HTMLResponse
):
    return await get_builder(request, "/admin", user, response_class)


@router.get("/cancel_lti")
async def cancel_lti(request: Request, user=Depends(auth_manager)):
    """
    Cancel the LTI 1.1 session.
    """
    # get the course
    course = await fetch_course(user.course_name)

    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return RedirectResponse(url="/")

    await delete_lti_course(course.id)

    return make_json_response(status=status.HTTP_200_OK, detail={"status": "success"})


@router.get("/invoice_request")
async def make_invoice_request(
    request: Request,
    user=Depends(auth_manager),
    response_class=HTMLResponse,
):
    """
    Process an invoice request.
    """
    # get the course
    course = await fetch_course(user.course_name)

    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED, detail="not an instructor"
        )
    num_students = await fetch_users_for_course(course.course_name)

    amount = len(num_students) * 10.0
    referer = request.headers.get("Referer")
    context = dict(
        email=user.email,
        amount=amount,
        num_students=len(num_students),
        course=course,
        course_name=course.course_name,
        user=user,
        request=request,
        is_instructor=user_is_instructor,
        referer=referer,
    )
    templates = Jinja2Templates(directory=template_folder)
    response = templates.TemplateResponse("assignment/instructor/invoice.html", context)

    return response


@router.post("/invoice")
async def process_invoice_request(
    request: Request,
    email: Annotated[str, Form(...)],
    course_name: Annotated[str, Form(...)],
    referer: Annotated[str, Form(...)],
    amount: Annotated[float, Form(...)] = None,
    user=Depends(auth_manager),
    response_class=JSONResponse,
):

    rslogger.debug(f"Processing invoice request: {email} {amount} {course_name}")

    res = await create_invoice_request(user.username, course_name, amount, user.email)

    if not res:
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail="Error creating invoice request",
        )

    if referer == "None" or "invoice_request" in referer:
        referer = f"/ns/books/published/{course_name}/index.html"

    # the referer is the page that the user was on when they clicked the invoice request
    # the status code 302 is a redirect and will ensure that a GET is used
    # otherwise FastAPI will use the method of the original request which is a POST
    # in this case
    return RedirectResponse(url=referer, status_code=status.HTTP_302_FOUND)


@router.get("/course_roster")
async def get_course_roster(
    request: Request, user=Depends(auth_manager), response_class=JSONResponse
):
    """
    Get the list of students in the course.
    """

    students = await fetch_users_for_course(user.course_name)
    students = [
        s.model_dump(
            exclude={
                "created_on",
                "modified_on",
                "password",
                "reset_password_key",
                "registration_key",
            }
        )
        for s in students
    ]

    return make_json_response(status=status.HTTP_200_OK, detail={"students": students})


@router.post("/save_exception")
async def save_exception(
    request: Request,
    request_data: dict,
    user=Depends(auth_manager),
    response_class=JSONResponse,
):
    """
    Save an exception to the database.
    """
    # get the course
    course = await fetch_course(user.course_name)

    user_is_instructor = await is_instructor(request, user=user)
    if not user_is_instructor:
        return make_json_response(
            status=status.HTTP_401_UNAUTHORIZED, detail="not an instructor"
        )

    # save the exception
    res = await create_deadline_exception(
        course.id,
        request_data["sid"],
        request_data["time_limit"],
        request_data["due_date"],
        request_data["visible"],
        request_data["assignment_id"],
    )

    if not res:
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail="Error saving exception",
        )
    else:
        return make_json_response(status=status.HTTP_200_OK, detail={"success": True})


@router.get("/which_to_grade_options")
@instructor_role_required()
async def get_which_to_grade_options(request: Request):
    options = [option.to_dict() for option in WhichToGradeOptions]
    return JSONResponse(content=options, status_code=status.HTTP_200_OK)


@router.get("/autograde_options")
@instructor_role_required()
async def get_autograde_options(request: Request):
    options = [option.to_dict() for option in AutogradeOptions]
    return JSONResponse(content=options, status_code=status.HTTP_200_OK)


@router.get("/language_options")
@instructor_role_required()
async def get_language_options(request: Request):
    options = [option.to_dict() for option in LanguageOptions]
    return JSONResponse(content=options, status_code=status.HTTP_200_OK)


@router.get("/question_type_options")
@instructor_role_required()
async def get_language_options(request: Request):
    options = [option.to_dict() for option in QuestionType]
    return JSONResponse(content=options, status_code=status.HTTP_200_OK)


@router.get("/download_assignment/{assignment_id}")
@instructor_role_required()
async def do_download_assignment(
    assignment_id: int,
    request: Request,
    user=Depends(auth_manager),
    RS_info: Optional[str] = Cookie(None),
):
    """
    Download the specified assignment.
    """

    rslogger.debug(f"Downloading assignment: {assignment_id}")
    course_name = user.course_name

    course = await fetch_course(course_name)

    assigns = await fetch_assignments(course.course_name)
    current_assignment = None
    for assign in assigns:
        if assign.id == assignment_id:
            current_assignment = assign
            break
    if current_assignment is None:
        return make_json_response(
            status=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment {assignment_id} not found",
        )

    res = await fetch_problem_data(assignment_id, course_name)
    aqs = await fetch_assignment_questions(assignment_id)
    if not aqs:
        return make_json_response(
            status=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment questions for {assignment_id} not found",
        )

    if RS_info:
        rslogger.debug(f"RS_info Cookie {RS_info}")
        # Note that to get to the value of the cookie you must use ``.value``
        try:
            parsed_js = json.loads(RS_info)
        except Exception:
            parsed_js = {}

    tzoffset = parsed_js.get("tz_offset", None)
    dd = datetime.timedelta(hours=int(tzoffset) if tzoffset is not None else 0)

    csv_buffer = io.StringIO()
    csv_writer = csv.writer(csv_buffer)
    csv_writer.writerow(["Timestamp", "SID", "Div ID", "Event", "Act"])
    for row in res:
        csv_row = [row.ts + dd, row.sid, row.name, row.event, row.act]
        csv_writer.writerow(csv_row)
    csv_buffer.seek(0)

    # send the csv file to the user
    response = StreamingResponse(
        csv_buffer,
        media_type="text/csv",
    )
    response.headers["Content-Disposition"] = (
        f"attachment; filename=assignment_{assignment_id}.csv"
    )

    return response


@router.get("/assignment_summary/{assignment_id}")
@instructor_role_required()
async def do_assignment_summary(
    assignment_id: int,
    request: Request,
    user=Depends(auth_manager),
    response_class=HTMLResponse,
):
    """
    Download the specified assignment.
    """

    course_name = user.course_name

    course = await fetch_course(course_name)
    context = {
        "course": course,
        "course_name": course.course_name,
        "base_course": course.base_course,
        "assignment_id": assignment_id,
        "course_id": course.id,
        "user": user,
        "request": request,
        "is_instructor": True,
        "student_page": False,
    }
    templates = Jinja2Templates(directory=template_folder)
    response = templates.TemplateResponse(
        "assignment/instructor/assignment_summary.html", context
    )

    return response


@router.get("/assignment_summary_data/{assignment_id}")
@instructor_role_required()
async def do_assignment_summary_data(
    assignment_id: int,
    request: Request,
    user=Depends(auth_manager),
    response_class=JSONResponse,
):
    course = await fetch_course(user.course_name)
    if settings.server_config == "development":
        dburl = settings.dev_dburl
    elif settings.server_config == "production":
        dburl = settings.dburl

    summary_data, question_metadata = create_assignment_summary(
        assignment_id, course, dburl
    )
    return make_json_response(
        status=status.HTTP_200_OK,
        detail={
            "assignment_summary": summary_data,
            "question_metadata": question_metadata,
        },
    )


@router.post("/question")
@instructor_role_required()
async def question_creation(
    request_data: CreateExercisesPayload, request: Request, user=Depends(auth_manager)
):

    if not request_data.author:
        request_data.author = user.first_name + " " + user.last_name

    course = await fetch_course(user.course_name)

    # Exclude assignment_id and is_reading parameters
    question_data = {
        key: value
        for key, value in request_data.model_dump().items()
        if key not in ("assignment_id", "is_reading")
    }

    try:
        question = await create_question(
            QuestionValidator(
                **question_data,
                base_course=course.base_course,
                timestamp=canonical_utcnow(),
                practice=False,
                from_source=False,
                review_flag=False,
                owner=user.username,
            )
        )

        await add_assignment_question(data=request_data, question=question)

    except Exception as e:
        rslogger.error(f"Error creating question: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST, detail=f"Error creating question: {e}"
        )

    return make_json_response(status=status.HTTP_201_CREATED)


class AddTokenRequest(BaseModel):
    provider: str
    tokens: List[str]


@router.post("/add_token")
@instructor_role_required()
@with_course()
async def add_api_token(
    request: Request,
    request_data: AddTokenRequest,
    course=None,
):
    """
    Add one or more API tokens for a given provider to the instructor's course.

    :param request_data: Contains provider name and list of tokens
    :param course: Course object from decorator
    :return: JSON response with success status
    """
    try:
        created_tokens = []
        for token in request_data.tokens:
            if token.strip():  # Only process non-empty tokens
                api_token = await create_api_token(
                    course_id=course.id,
                    provider=request_data.provider,
                    token=token.strip(),
                )
                created_tokens.append(api_token.id)

        return make_json_response(
            status=status.HTTP_201_CREATED,
            detail={
                "status": "success",
                "message": f"Added {len(created_tokens)} tokens for provider {request_data.provider}",
                "token_ids": created_tokens,
            },
        )
    except Exception as e:
        rslogger.error(f"Error adding API tokens: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error adding API tokens: {str(e)}",
        )


@router.get("/add_token")
@instructor_role_required()
@with_course()
async def get_add_token_page(
    request: Request,
    user=Depends(auth_manager),
    response_class=HTMLResponse,
    course=None,
):
    """
    Display the token management page for instructors.
    """
    templates = Jinja2Templates(directory=template_folder)
    context = {
        "course": course,
        "user": user,
        "request": request,
        "is_instructor": True,
        "student_page": False,
    }

    return templates.TemplateResponse("assignment/instructor/add_token.html", context)


@router.delete("/assignments/{assignment_id}")
@instructor_role_required()
async def remove_assignment(
    assignment_id: int,
    request: Request
):
    rslogger.debug(f"Attempting to delete assignment {assignment_id}")
    try:
        await delete_assignment(
            assignment_id=assignment_id
        )
        rslogger.debug(f"Successfully deleted assignment {assignment_id}")
    except Exception as e:
        rslogger.error(f"Error deleting assignment {assignment_id}: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error deleting assignment: {e}"
        )
    return make_json_response(
        status=status.HTTP_200_OK,
        detail={"status": "success", "message": f"Assignment {assignment_id} deleted successfully"}
    )


@router.post("/validate_question_name")
@instructor_role_required()
@with_course()
async def validate_question_name(
    request: Request,
    request_data: ValidateQuestionNameRequest,
    course=None
):
    """
    Validate if a question name is unique within the course's base course.
    """
    try:
        # Use base_course from course context instead of request data
        is_unique = await validate_question_name_unique(
            name=request_data.name,
            base_course=course.base_course
        )
        
        return make_json_response(
            status=status.HTTP_200_OK,
            detail={"is_unique": is_unique}
        )
    except Exception as e:
        rslogger.error(f"Error validating question name: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error validating question name: {str(e)}"
        )


@router.post("/copy_question")
@instructor_role_required()
async def copy_question_endpoint(
    request: Request,
    request_data: CopyQuestionRequest,
    user=Depends(auth_manager)
):
    """
    Copy a question with a new name and owner.
    Optionally copy it to an assignment as well.
    """
    try:
        assignment_id = None
        if request_data.copy_to_assignment and request_data.assignment_id:
            assignment_id = request_data.assignment_id
        
        new_question = await copy_question(
            original_question_id=request_data.original_question_id,
            new_name=request_data.new_name,
            new_owner=user.username,
            assignment_id=assignment_id
        )
        
        return make_json_response(
            status=status.HTTP_201_CREATED,
            detail={
                "status": "success", 
                "question_id": new_question.id,
                "message": "Question copied successfully"
            }
        )
    except Exception as e:
        rslogger.error(f"Error copying question: {e}")
        return make_json_response(
            status=status.HTTP_400_BAD_REQUEST,
            detail=f"Error copying question: {str(e)}"
        )
