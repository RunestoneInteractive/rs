"""
editor.py - Editorial endpoints for the admin server.

Ports ``manage_exercises`` (the "Editorial Page") from the old web2py
``controllers/admin.py``.  Readers can flag a question for review from inside a
book; this page is where an editor of that book triages the flagged questions.

Access is restricted to members of the ``editor`` group -- the same gate the
web2py version used -- and an editor only ever sees questions from the base
courses listed for them in ``editor_basecourse``.
"""

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

from rsptx.auth.session import auth_manager
from rsptx.configuration import settings
from rsptx.db.crud import (
    delete_question_by_name,
    fetch_all_course_attributes,
    fetch_course,
    fetch_editor_basecourses,
    fetch_flagged_questions,
    fetch_question,
    get_book_chapters,
    update_question,
)
from rsptx.endpoint_validators import editor_role_required
from rsptx.logging import rslogger
from rsptx.response_helpers.core import get_webpack_static_imports, make_json_response
from rsptx.templates import get_shared_templates

router = APIRouter(
    prefix="/editor",
    tags=["editor"],
)


def _safe_webpack_imports(course) -> dict:
    """Locate the book's webpack assets, which the page needs in order to turn
    each question's stored HTML into a live Runestone component.

    An editor's current course may point at a base course that is not built on
    this machine (common in development).  The rest of the page is still useful
    in that case, so fall back to no assets rather than failing the request.
    """
    try:
        return get_webpack_static_imports(course)
    except Exception as e:
        rslogger.warning(
            f"No webpack assets for {course.base_course}: {e} -- "
            "questions will render unstyled."
        )
        return {"css": [], "js": []}


@router.get("/manage_exercises", response_class=HTMLResponse)
@editor_role_required()
async def manage_exercises(
    request: Request,
    user=Depends(auth_manager),
):
    """
    Display every question flagged for review in the base courses this user
    edits, with controls to delete a question or clear its flag.
    """
    course = await fetch_course(user.course_name)
    base_courses = await fetch_editor_basecourses(user.id)

    questions = []
    # Chapter labels are what the questions table stores; map them to the
    # human-readable chapter titles, per base course.
    chapter_titles = {}
    for base_course in base_courses:
        chapter_titles[base_course] = {
            chapter.chapter_label: chapter.chapter_name
            for chapter in await get_book_chapters(base_course)
        }
        for q in await fetch_flagged_questions(base_course):
            questions.append(
                {
                    "name": q.name,
                    "base_course": q.base_course,
                    "chapter": q.chapter,
                    "chapter_title": chapter_titles[base_course].get(q.chapter, ""),
                    "subchapter": q.subchapter,
                    "difficulty": q.difficulty,
                    "question_type": q.question_type,
                    "htmlsrc": q.htmlsrc,
                }
            )

    course_attrs = await fetch_all_course_attributes(course.id)
    templates = get_shared_templates()
    context = {
        "request": request,
        "user": user,
        "course": course,
        "is_instructor": True,
        "student_page": False,
        "base_courses": base_courses,
        "questions": questions,
        "wp_imports": _safe_webpack_imports(course),
        "course_attrs": course_attrs,
        "latex_preamble": course_attrs.get("latex_macros", ""),
        "webwork_js_version": course_attrs.get("webwork_js_version", "2.20"),
        "settings": settings,
    }
    return templates.TemplateResponse("admin/editor/manage_exercises.html", context)


class QuestionRequest(BaseModel):
    name: str
    base_course: str


async def _editable_question(user, body: QuestionRequest):
    """Resolve the question named in a request, but only if the caller edits the
    base course it belongs to.  Returns ``(question, error_response)``.
    """
    base_courses = await fetch_editor_basecourses(user.id)
    if body.base_course not in base_courses:
        rslogger.error(
            f"{user.username} tried to modify {body.name} in {body.base_course}, "
            "which they do not edit"
        )
        return None, make_json_response(
            status=status.HTTP_403_FORBIDDEN,
            detail={"status": "Error", "message": "You do not edit that base course."},
        )

    question = await fetch_question(body.name, basecourse=body.base_course)
    if not question:
        return None, make_json_response(
            status=status.HTTP_404_NOT_FOUND,
            detail={"status": "Error", "message": "Question not found."},
        )
    return question, None


@router.post("/delete_question", response_class=JSONResponse)
@editor_role_required()
async def delete_question(
    request: Request,
    body: QuestionRequest,
    user=Depends(auth_manager),
):
    """Permanently remove a flagged question from the questions table."""
    question, err = await _editable_question(user, body)
    if err:
        return err

    try:
        await delete_question_by_name(body.name, body.base_course)
    except Exception as e:
        rslogger.error(f"Error deleting question {body.name}: {e}")
        return make_json_response(
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"status": "Error", "message": f"Failed to delete: {e}"},
        )

    return make_json_response(detail={"status": "Success"})


@router.post("/clear_flag", response_class=JSONResponse)
@editor_role_required()
async def clear_flag(
    request: Request,
    body: QuestionRequest,
    user=Depends(auth_manager),
):
    """Clear the review flag, leaving the question in place."""
    question, err = await _editable_question(user, body)
    if err:
        return err

    question.review_flag = False
    try:
        await update_question(question)
    except Exception as e:
        rslogger.error(f"Error clearing flag on {body.name}: {e}")
        return make_json_response(
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"status": "Error", "message": f"Failed to clear flag: {e}"},
        )

    return make_json_response(detail={"status": "Success"})
