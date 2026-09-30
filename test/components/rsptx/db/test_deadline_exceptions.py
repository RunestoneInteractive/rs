"""
fetch_deadline_exception: merging a student's exception for one assignment with
their exception for every assignment.

The every-assignment kind (no ``assignment_id``) is what the accommodations
editor creates for "all assignments"; it must reach grading, which always asks
about one assignment.
"""

import datetime

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.async_session import async_session  # noqa: E402
from rsptx.db.crud import fetch_course, fetch_deadline_exception  # noqa: E402
from rsptx.db.crud.user import create_user  # noqa: E402
from rsptx.db.models import (  # noqa: E402
    Assignment,
    AuthUserValidator,
    DeadlineException,
)

COURSE = "overview"


async def _student(username, course):
    await create_user(
        AuthUserValidator(
            username=username,
            first_name="test",
            last_name=username,
            password="xxx",
            email=f"{username}@example.com",
            course_name=course.course_name,
            course_id=course.id,
            donated=True,
            active=True,
            accept_tcp=True,
            created_on=datetime.datetime(2020, 1, 1),
            modified_on=datetime.datetime(2020, 1, 1),
            registration_key="",
            registration_id="",
            reset_password_key="",
        )
    )
    return username


@pytest.fixture(scope="session")
async def setup(init_test_db):
    """Two assignments and a student per scenario, with their exceptions."""
    course = await fetch_course(COURSE)
    names = [
        "de_all_only",
        "de_both",
        "de_visible_only",
        "de_all_visible",
        "de_newest",
        "de_none",
    ]
    for name in names:
        await _student(name, course)
    async with async_session() as session:
        a1, a2 = (
            Assignment(
                course=course.id,
                name=f"de assignment {i}",
                points=1,
                released=False,
                duedate=datetime.datetime(2026, 9, 1),
                visible=True,
                from_source=False,
            )
            for i in (1, 2)
        )
        session.add_all([a1, a2])
        await session.flush()

        def exc(sid, assignment=None, **kw):
            return DeadlineException(
                course_id=course.id,
                sid=sid,
                assignment_id=assignment.id if assignment else None,
                **kw,
            )

        # Added one at a time so ids, and therefore "newest", are in order.
        for row in [
            exc("de_all_only", duedate=2, time_limit=1.5),
            exc("de_both", duedate=5),
            exc("de_both", a1, duedate=1),
            exc("de_visible_only", duedate=5, time_limit=2.0),
            exc("de_visible_only", a1, visible=True),
            exc("de_all_visible", visible=True, allowLink=True, duedate=3),
            exc("de_newest", duedate=2),
            exc("de_newest", duedate=4),
        ]:
            session.add(row)
            await session.flush()
        await session.commit()
    return course.id, a1.id, a2.id


async def test_every_assignment_extension_reaches_one_assignment(setup):
    course_id, a1, _ = setup
    exc = await fetch_deadline_exception(course_id, "de_all_only", a1)
    assert (exc.duedate, exc.time_limit) == (2, 1.5)


async def test_assignment_exception_wins(setup):
    course_id, a1, a2 = setup
    assert (await fetch_deadline_exception(course_id, "de_both", a1)).duedate == 1
    # ... but only for its own assignment
    assert (await fetch_deadline_exception(course_id, "de_both", a2)).duedate == 5


async def test_visibility_only_exception_keeps_the_extension(setup):
    course_id, a1, _ = setup
    exc = await fetch_deadline_exception(course_id, "de_visible_only", a1)
    assert exc.visible is True
    assert (exc.duedate, exc.time_limit) == (5, 2.0)


async def test_visibility_is_not_inherited(setup):
    course_id, a1, _ = setup
    exc = await fetch_deadline_exception(course_id, "de_all_visible", a1)
    assert exc.duedate == 3
    assert not exc.visible
    assert not exc.allowLink


async def test_newest_every_assignment_exception_wins(setup):
    course_id, a1, _ = setup
    assert (await fetch_deadline_exception(course_id, "de_newest")).duedate == 4
    assert (await fetch_deadline_exception(course_id, "de_newest", a1)).duedate == 4


async def test_no_exception(setup):
    course_id, a1, _ = setup
    exc = await fetch_deadline_exception(course_id, "de_none", a1)
    assert exc.duedate is None and exc.time_limit is None and not exc.visible


async def test_fetch_all_is_unmerged(setup):
    course_id, _, _ = setup
    rows = await fetch_deadline_exception(course_id, "de_both", fetch_all=True)
    assert sorted(r.duedate for r in rows) == [1, 5]
