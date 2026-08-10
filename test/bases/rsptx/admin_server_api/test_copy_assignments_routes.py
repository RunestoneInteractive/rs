"""
Routes behind the Copy Assignments page.

The page used to copy rows itself, from a dropdown limited to the instructor's
own courses on the same book. It now delegates to the shared ``import_assignment``
and can take from any course that shares something, so these cover the two
things that changed: which courses are on offer, and what copying actually does.
"""

import datetime
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.crud import (  # noqa: E402
    create_assignment,
    create_course,
    create_course_attribute,
    create_course_instructor,
    fetch_course,
)
from rsptx.db.models import AssignmentValidator, CoursesValidator  # noqa: E402

SOURCE_COURSE = "admin_copy_source"


async def _assignment(course_id, name, is_private=False, from_source=False):
    return await create_assignment(
        AssignmentValidator(
            course=course_id,
            name=name,
            points=10,
            released=False,
            description="copy route test assignment",
            duedate=datetime.datetime(2099, 1, 1),
            visible=True,
            from_source=from_source,
            is_peer=False,
            is_timed=False,
            current_index=0,
            peer_async_visible=False,
            kind="Regular",
            is_private=is_private,
        )
    )


@pytest.fixture(scope="session")
async def copy_source_course(admin_instructor_user):
    """A course the caller does not instruct, which has opted in to sharing."""
    existing = await fetch_course(SOURCE_COURSE)
    if existing:
        return existing

    await create_course(
        CoursesValidator(
            course_name=SOURCE_COURSE,
            base_course="overview",
            term_start_date=datetime.date(2026, 1, 12),
            login_required=False,
            allow_pairs=False,
            downloads_enabled=False,
            courselevel="",
            institution="Sharing University",
            new_server=True,
        )
    )
    course = await fetch_course(SOURCE_COURSE)
    await create_course_attribute(course.id, "share_assignments", "true")
    await _assignment(course.id, "copy_shared_one")
    await _assignment(course.id, "copy_shared_two")
    return course


@pytest.fixture(scope="session")
async def closed_source_course(admin_instructor_user):
    """A course that never opted in. Opting in covers a whole course, so the
    unshared case needs a course of its own."""
    existing = await fetch_course("admin_copy_closed")
    if existing:
        return existing

    await create_course(
        CoursesValidator(
            course_name="admin_copy_closed",
            base_course="overview",
            term_start_date=datetime.date(2026, 1, 12),
            login_required=False,
            allow_pairs=False,
            downloads_enabled=False,
            courselevel="",
            institution="Private University",
            new_server=True,
        )
    )
    course = await fetch_course("admin_copy_closed")
    await _assignment(course.id, "copy_secret", is_private=True)
    return course


@pytest.fixture(scope="session")
async def other_instructor_course(admin_instructor_user):
    """A second course the caller does instruct, for the "only mine" filter."""
    existing = await fetch_course("admin_copy_mine")
    if existing:
        return existing

    await create_course(
        CoursesValidator(
            course_name="admin_copy_mine",
            base_course="overview",
            term_start_date=datetime.date(2026, 1, 12),
            login_required=False,
            allow_pairs=False,
            downloads_enabled=False,
            courselevel="",
            institution="Copy Test University",
            new_server=True,
        )
    )
    course = await fetch_course("admin_copy_mine")
    await create_course_instructor(course.id, admin_instructor_user.id)
    await _assignment(course.id, "copy_my_own_hw", is_private=True)
    return course


# The source-course picker
# ------------------------


async def test_shareable_courses_lists_a_course_the_caller_does_not_teach(
    auth_admin_instructor_client, copy_source_course
):
    """The change that makes this page more than a re-run of last term.

    The old dropdown only offered the base course and the instructor's own
    courses on the same book.
    """
    resp = await auth_admin_instructor_client.get("/instructor/shareable_courses")
    assert resp.status_code == 200
    names = [c["course_name"] for c in resp.json()["courses"]]
    assert SOURCE_COURSE in names


async def test_shareable_courses_counts_only_shared_assignments(
    auth_admin_instructor_client, copy_source_course
):
    resp = await auth_admin_instructor_client.get("/instructor/shareable_courses")
    row = next(
        c for c in resp.json()["courses"] if c["course_name"] == SOURCE_COURSE
    )
    assert row["shareable_count"] == 2
    assert row["is_mine"] is False


async def test_shareable_courses_can_be_limited_to_my_own(
    auth_admin_instructor_client, copy_source_course, other_instructor_course
):
    resp = await auth_admin_instructor_client.get(
        "/instructor/shareable_courses", params={"only_my_courses": True}
    )
    assert resp.status_code == 200
    names = [c["course_name"] for c in resp.json()["courses"]]
    assert "admin_copy_mine" in names
    assert SOURCE_COURSE not in names


async def test_source_assignments_hides_a_course_that_has_not_opted_in(
    auth_admin_instructor_client, copy_source_course, closed_source_course
):
    """Same visibility rules as the assignment browser, so this page cannot be
    the softer way in."""
    resp = await auth_admin_instructor_client.get(
        "/instructor/source_assignments",
        params={"course_name": SOURCE_COURSE},
    )
    assert resp.status_code == 200
    names = [a["name"] for a in resp.json()["assignments"]]
    assert sorted(names) == ["copy_shared_one", "copy_shared_two"]

    closed = await auth_admin_instructor_client.get(
        "/instructor/source_assignments",
        params={"course_name": "admin_copy_closed"},
    )
    assert closed.json()["assignments"] == []


async def test_source_assignments_refuses_the_callers_own_course(
    auth_admin_instructor_client,
):
    resp = await auth_admin_instructor_client.get(
        "/instructor/source_assignments",
        params={"course_name": "admin_copy_target"},
    )
    assert resp.status_code == 400


# Copying
# -------


async def test_copy_all_takes_every_shared_assignment(
    auth_admin_instructor_client, copy_source_course
):
    resp = await auth_admin_instructor_client.post(
        "/instructor/copy_assignment",
        json={"source_course_id": copy_source_course.id},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success"] is True
    assert sorted(body["imported"]) == ["copy_shared_one", "copy_shared_two"]
    assert body["failed"] == []


async def test_copying_again_skips_what_is_already_there(
    auth_admin_instructor_client, copy_source_course
):
    """Runs after the bulk copy above, which is the point: a second pass over
    the same course should be a no-op rather than a duplicate set."""
    resp = await auth_admin_instructor_client.post(
        "/instructor/copy_assignment",
        json={"source_course_id": copy_source_course.id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["imported"] == []
    assert sorted(body["skipped_existing"]) == ["copy_shared_one", "copy_shared_two"]


async def test_source_assignments_marks_what_was_already_copied(
    auth_admin_instructor_client, copy_source_course
):
    resp = await auth_admin_instructor_client.get(
        "/instructor/source_assignments",
        params={"course_name": SOURCE_COURSE},
    )
    rows = resp.json()["assignments"]
    assert all(row["already_imported"] for row in rows)
    assert all(row["imported_as"] for row in rows)


async def test_copying_from_a_course_that_has_not_opted_in_is_refused(
    auth_admin_instructor_client, closed_source_course
):
    """The old endpoint checked instructor access on the course; this one goes
    through import_assignment, which asks whether the course shares at all."""
    from rsptx.db.crud import fetch_assignments

    assignments = await fetch_assignments("admin_copy_closed", fetch_all=True)
    private = next(a for a in assignments if a.name == "copy_secret")

    resp = await auth_admin_instructor_client.post(
        "/instructor/copy_assignment",
        json={"source_course_id": closed_source_course.id, "assignment_id": private.id},
    )
    # 404 rather than 403, so the response does not confirm it exists.
    assert resp.status_code == 404
    assert resp.json()["success"] is False
