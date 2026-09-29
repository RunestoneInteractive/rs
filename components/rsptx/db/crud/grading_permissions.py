"""Persistence helpers for delegated grading and blind-grading policy.

This module deliberately contains no routes. The role and assignment flag are
dark infrastructure until the anonymous backend contract and React workflow
are ready to ship together.
"""

from typing import NamedTuple, Optional

from sqlalchemy import delete, select, update

from ..async_session import async_session
from ..models import Assignment, CourseGrader, CourseGraderValidator


class AssignmentGradingPolicy(NamedTuple):
    """The course boundary and effective blind-grading state for an assignment."""

    course_id: int
    blind_grading: bool


async def grant_course_grader(course_id: int, user_id: int) -> CourseGraderValidator:
    """Grant restricted grader membership, returning the existing row if any."""

    async with async_session.begin() as session:
        result = await session.execute(
            select(CourseGrader).where(
                (CourseGrader.course_id == course_id)
                & (CourseGrader.user_id == user_id)
            )
        )
        membership = result.scalar_one_or_none()
        if membership is None:
            membership = CourseGrader(course_id=course_id, user_id=user_id)
            session.add(membership)
            await session.flush()
        return CourseGraderValidator.from_orm(membership)


async def revoke_course_grader(course_id: int, user_id: int) -> bool:
    """Revoke restricted grader membership; return whether a row was removed."""

    async with async_session.begin() as session:
        result = await session.execute(
            delete(CourseGrader).where(
                (CourseGrader.course_id == course_id)
                & (CourseGrader.user_id == user_id)
            )
        )
        return bool(result.rowcount)


async def fetch_course_grader(
    course_id: int, user_id: int
) -> Optional[CourseGraderValidator]:
    """Return one restricted grader membership, scoped to its course."""

    async with async_session() as session:
        result = await session.execute(
            select(CourseGrader).where(
                (CourseGrader.course_id == course_id)
                & (CourseGrader.user_id == user_id)
            )
        )
        membership = result.scalar_one_or_none()
        return (
            CourseGraderValidator.from_orm(membership)
            if membership is not None
            else None
        )


async def fetch_course_graders(course_id: int) -> list[CourseGraderValidator]:
    """Return every restricted grader membership for a course."""

    async with async_session() as session:
        result = await session.execute(
            select(CourseGrader)
            .where(CourseGrader.course_id == course_id)
            .order_by(CourseGrader.id)
        )
        return [CourseGraderValidator.from_orm(row) for row in result.scalars()]


async def is_course_grader(course_id: int, user_id: int) -> bool:
    """Return whether a user has restricted grader membership in a course."""

    return await fetch_course_grader(course_id, user_id) is not None


async def fetch_assignment_grading_policy(
    assignment_id: int,
) -> Optional[AssignmentGradingPolicy]:
    """Return an assignment's course and effective blind-grading setting."""

    async with async_session() as session:
        result = await session.execute(
            select(Assignment.course, Assignment.blind_grading).where(
                Assignment.id == assignment_id
            )
        )
        row = result.one_or_none()
        if row is None:
            return None
        return AssignmentGradingPolicy(
            course_id=row.course,
            blind_grading=bool(row.blind_grading),
        )


async def set_assignment_blind_grading(assignment_id: int, enabled: bool) -> bool:
    """Persist blind-grading policy; return whether the assignment existed."""

    async with async_session.begin() as session:
        result = await session.execute(
            update(Assignment)
            .where(Assignment.id == assignment_id)
            .values(blind_grading=enabled)
        )
        return bool(result.rowcount)
