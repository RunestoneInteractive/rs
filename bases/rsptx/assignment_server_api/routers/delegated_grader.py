"""Assignment-scoped, identity-safe APIs for delegated grading."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict

from rsptx.auth.grader_permissions import (
    GraderCapabilities,
    GraderRole,
    resolve_grader_capabilities,
)
from rsptx.auth.grader_tokens import (
    resolve_student_grading_token,
    student_grading_token,
)
from rsptx.auth.session import auth_manager
from rsptx.db.crud import fetch_course
from rsptx.db.models import AuthUserValidator

from .grader import (
    GradeUpdatePayload,
    GraderAnswerHistoryItem,
    load_question_answers,
    load_student_answer_history,
    save_question_grade,
)

router = APIRouter(
    prefix="/grader",
    tags=["delegated-grader"],
)


class AssignmentGraderCapabilitiesResponse(BaseModel):
    """Public, identity-free grading capabilities for one assignment."""

    model_config = ConfigDict(extra="forbid")

    role: GraderRole
    can_grade: bool
    can_view_student_identities: bool
    assignment_blind_grading: bool


class AssignmentGraderCapabilitiesEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    detail: AssignmentGraderCapabilitiesResponse


class AnonymousQuestionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    name: str
    question_type: str
    htmlsrc: Optional[str] = None
    max_points: int


class AnonymousStudentAnswerResponse(BaseModel):
    """A grader answer with no username, name, or email fields."""

    model_config = ConfigDict(extra="forbid")

    student_token: str
    student_label: str
    answer: Optional[str] = None
    correct: Optional[bool] = None
    percent: Optional[float] = None
    timestamp: Optional[str] = None
    attempts: int = 0
    score: Optional[float] = None
    comment: Optional[str] = None
    hand_graded: bool = False
    max_points: int = 0
    selected_div_id: Optional[str] = None
    selected_question_type: Optional[str] = None
    selected_htmlsrc: Optional[str] = None


class AnonymousQuestionAnswersResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: AnonymousQuestionResponse
    answers: list[AnonymousStudentAnswerResponse]


class AnonymousQuestionAnswersEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    detail: AnonymousQuestionAnswersResponse


class AnonymousGradeUpdatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    student_token: str
    score: float
    comment: Optional[str] = ""


class AnonymousGradeUpdateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    student_token: str
    score: float
    comment: str
    recomputed_assignments: list[int]
    totals: dict[int, Optional[float]]


class AnonymousGradeUpdateEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    detail: AnonymousGradeUpdateResponse


class AnonymousUseinfoItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    timestamp: Optional[str] = None
    event: Optional[str] = None
    act: Optional[str] = None


class AnonymousQuestionHistoryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    student_token: str
    history: list[GraderAnswerHistoryItem]
    useinfo: list[AnonymousUseinfoItem]


class AnonymousQuestionHistoryEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    detail: AnonymousQuestionHistoryResponse


async def require_assignment_grader(
    assignment_id: int,
    user: AuthUserValidator = Depends(auth_manager),
) -> GraderCapabilities:
    """Return effective capabilities or fail without revealing the assignment."""

    if not user.id or not user.course_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user or missing course",
        )

    capabilities = await resolve_grader_capabilities(
        user_id=user.id,
        course_id=user.course_id,
        assignment_id=assignment_id,
    )
    if not capabilities.can_grade:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Grading access denied",
        )
    return capabilities


async def _resolve_anonymous_student(
    *, course, assignment_id: int, question_id: int, student_token: str
):
    """Resolve a token only among students visible for this assignment question."""

    question_answers = await load_question_answers(course, assignment_id, question_id)
    sid = resolve_student_grading_token(
        course_id=course.id,
        assignment_id=assignment_id,
        token=student_token,
        candidate_sids=(answer.sid for answer in question_answers["answers"]),
    )
    if sid is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grading target not found",
        )
    return sid, question_answers


@router.get(
    "/assignments/{assignment_id}/capabilities",
    response_model=AssignmentGraderCapabilitiesEnvelope,
)
async def get_assignment_grader_capabilities(
    capabilities: GraderCapabilities = Depends(require_assignment_grader),
):
    """Return the identity policy the server will enforce for this grader."""

    return {
        "detail": AssignmentGraderCapabilitiesResponse(
            role=capabilities.role,
            can_grade=capabilities.can_grade,
            can_view_student_identities=capabilities.can_view_student_identities,
            assignment_blind_grading=capabilities.assignment_blind_grading,
        )
    }


@router.get(
    "/assignments/{assignment_id}/questions/{question_id}/answers",
    response_model=AnonymousQuestionAnswersEnvelope,
)
async def get_anonymous_question_answers(
    assignment_id: int,
    question_id: int,
    user: AuthUserValidator = Depends(auth_manager),
    _capabilities: GraderCapabilities = Depends(require_assignment_grader),
):
    """Return answer data with server-generated, assignment-scoped identities."""

    course = await fetch_course(user.course_name)
    detail = await load_question_answers(course, assignment_id, question_id)

    tokenized = [
        (
            student_grading_token(
                course_id=course.id,
                assignment_id=assignment_id,
                sid=answer.sid,
            ),
            answer,
        )
        for answer in detail["answers"]
    ]
    tokenized.sort(key=lambda item: item[0])
    answers = [
        AnonymousStudentAnswerResponse(
            student_token=token,
            student_label=f"Student {token[:8]}",
            answer=answer.answer,
            correct=answer.correct,
            percent=answer.percent,
            timestamp=answer.timestamp,
            attempts=answer.attempts,
            score=answer.score,
            comment=answer.comment,
            hand_graded=answer.hand_graded,
            max_points=answer.max_points,
            selected_div_id=answer.selected_div_id,
            selected_question_type=answer.selected_question_type,
            selected_htmlsrc=answer.selected_htmlsrc,
        )
        for token, answer in tokenized
    ]
    return {
        "detail": AnonymousQuestionAnswersResponse(
            question=AnonymousQuestionResponse(**detail["question"]),
            answers=answers,
        )
    }


@router.post(
    "/assignments/{assignment_id}/questions/{question_id}/grade",
    response_model=AnonymousGradeUpdateEnvelope,
)
async def update_anonymous_question_grade(
    assignment_id: int,
    question_id: int,
    payload: AnonymousGradeUpdatePayload,
    user: AuthUserValidator = Depends(auth_manager),
    _capabilities: GraderCapabilities = Depends(require_assignment_grader),
):
    """Save a grade without accepting or returning a student username."""

    course = await fetch_course(user.course_name)
    sid, question_answers = await _resolve_anonymous_student(
        course=course,
        assignment_id=assignment_id,
        question_id=question_id,
        student_token=payload.student_token,
    )

    saved = await save_question_grade(
        course,
        GradeUpdatePayload(
            sid=sid,
            div_id=question_answers["question"]["name"],
            score=payload.score,
            comment=payload.comment,
            assignment_id=assignment_id,
        ),
    )
    return {
        "detail": AnonymousGradeUpdateResponse(
            student_token=payload.student_token,
            score=saved["score"],
            comment=saved["comment"],
            recomputed_assignments=saved["recomputed_assignments"],
            totals=saved["totals"],
        )
    }


@router.get(
    "/assignments/{assignment_id}/questions/{question_id}/history",
    response_model=AnonymousQuestionHistoryEnvelope,
)
async def get_anonymous_question_history(
    assignment_id: int,
    question_id: int,
    student_token: str,
    user: AuthUserValidator = Depends(auth_manager),
    _capabilities: GraderCapabilities = Depends(require_assignment_grader),
):
    """Return attempt history without accepting or returning a username."""

    course = await fetch_course(user.course_name)
    sid, _question_answers = await _resolve_anonymous_student(
        course=course,
        assignment_id=assignment_id,
        question_id=question_id,
        student_token=student_token,
    )
    history = await load_student_answer_history(course, assignment_id, question_id, sid)
    return {
        "detail": AnonymousQuestionHistoryResponse(
            student_token=student_token,
            history=history["history"],
            useinfo=history["useinfo"],
        )
    }
