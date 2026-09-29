"""Resolve grading capabilities without granting instructor access."""

from dataclasses import dataclass
from enum import StrEnum

from rsptx.db.crud import (
    fetch_assignment_grading_policy,
    fetch_instructor_courses,
    is_course_grader,
)


class GraderRole(StrEnum):
    NONE = "none"
    INSTRUCTOR = "instructor"
    DELEGATED_GRADER = "delegated_grader"


@dataclass(frozen=True)
class GraderCapabilities:
    """Effective permissions for one user and assignment."""

    role: GraderRole
    can_grade: bool
    can_view_student_identities: bool
    assignment_blind_grading: bool


NO_GRADER_CAPABILITIES = GraderCapabilities(
    role=GraderRole.NONE,
    can_grade=False,
    can_view_student_identities=False,
    assignment_blind_grading=False,
)


async def resolve_grader_capabilities(
    *, user_id: int, course_id: int, assignment_id: int
) -> GraderCapabilities:
    """Resolve grading access without broadening existing instructor access.

    A full instructor always wins over delegated membership and retains student
    identities. A delegated grader can grade only when the assignment belongs
    to the requested course and has explicitly enabled blind grading.
    """

    policy = await fetch_assignment_grading_policy(assignment_id)
    if policy is None or policy.course_id != course_id:
        return NO_GRADER_CAPABILITIES

    if await fetch_instructor_courses(user_id, course_id):
        return GraderCapabilities(
            role=GraderRole.INSTRUCTOR,
            can_grade=True,
            can_view_student_identities=True,
            assignment_blind_grading=policy.blind_grading,
        )

    if policy.blind_grading and await is_course_grader(course_id, user_id):
        return GraderCapabilities(
            role=GraderRole.DELEGATED_GRADER,
            can_grade=True,
            can_view_student_identities=False,
            assignment_blind_grading=True,
        )

    return NO_GRADER_CAPABILITIES
