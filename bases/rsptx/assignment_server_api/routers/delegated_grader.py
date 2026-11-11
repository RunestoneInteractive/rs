"""Assignment-scoped access contract for delegated grading."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict

from rsptx.auth.grader_permissions import (
    GraderCapabilities,
    GraderRole,
    resolve_grader_capabilities,
)
from rsptx.auth.session import auth_manager
from rsptx.db.models import AuthUserValidator


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
