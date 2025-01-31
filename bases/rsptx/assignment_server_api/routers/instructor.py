import pathlib
import pandas as pd

from fastapi import APIRouter, HTTPException, Depends, Request, status, Form
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
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
    fetch_questions_by_search_criteria,
    fetch_question_count_per_subchapter,
    fetch_all_course_attributes,
    create_assignment_question,
    create_deadline_exception,
    create_question,
    fetch_course,
    fetch_users_for_course,
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
)
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

    # First create the question
    new_question = QuestionValidator(
        **request_data.model_dump(),
        base_course=course.base_course,
        subchapter="Exercises",
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
    req = request_data.model_dump()
    req["question"] = req["source"]
    del req["source"]
    upd_question = QuestionValidator(
        **req,
        base_course=course.base_course,
        subchapter="Exercises",
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
        qlist.append(aq)

    rslogger.debug(f"qlist: {qlist}")

    return make_json_response(status=status.HTTP_200_OK, detail={"exercises": qlist})

@router.put("/assignment_question/batch")
@instructor_role_required()
@with_course()
async def assignment_questions_batch(
    request: Request,
    request_data: list[AssignmentQuestionValidator],
    user=Depends(auth_manager),
    response_class=JSONResponse,
    course = None,
):
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


@router.get("/builder")
async def get_builder(
    request: Request, user=Depends(auth_manager), response_class=HTMLResponse
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
            "user": user.username,
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
    return await get_builder(request, user, response_class)


@router.get("/builderV2")
async def get_builderV2(
    request: Request, user=Depends(auth_manager), response_class=HTMLResponse
):
    await log_this_function(user)
    return await get_builder(request, user, response_class)


@router.get("/except")
async def get_except(
    request: Request, user=Depends(auth_manager), response_class=HTMLResponse
):
    return await get_builder(request, user, response_class)


@router.get("/admin")
async def get_admin(
    request: Request, user=Depends(auth_manager), response_class=HTMLResponse
):
    return await get_builder(request, user, response_class)


@router.get("/cancel_lti")
async def cancel_lti(request: Request, user=Depends(auth_manager)):
    """
    Cancel the LTI session.
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
