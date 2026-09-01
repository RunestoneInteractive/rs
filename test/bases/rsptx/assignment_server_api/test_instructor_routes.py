"""
Functional tests for instructor routes in the assignment server.

Routes decorated with @instructor_role_required() call auth_manager() directly
inside the decorator — not via FastAPI's Depends() — so they are tested via
the ``auth_instructor_client`` fixture, which patches auth_manager at the
endpoint_validators module level and uses a real instructor DB user.

Tests are async functions sharing the session event loop with the asyncpg
connection pool.
"""

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


# ---------------------------------------------------------------------------
# GET /instructor/assignments
# ---------------------------------------------------------------------------


async def test_get_assignments(auth_instructor_client):
    """Instructor can list assignments for their course."""
    resp = await auth_instructor_client.get("/instructor/assignments")
    assert resp.status_code == 200
    data = resp.json()
    assert "detail" in data
    assert "assignments" in data["detail"]


# ---------------------------------------------------------------------------
# POST /instructor/assignments
# ---------------------------------------------------------------------------


async def test_create_assignment(auth_instructor_client):
    """Instructor can create a new assignment."""
    payload = {
        "name": "route_test_assignment",
        "description": "Created by route test",
        "duedate": "2099-01-01T00:00:00",
        "points": 10,
        "kind": "Regular",
        "visible": True,
        "peer_async_visible": False,
    }
    resp = await auth_instructor_client.post("/instructor/assignments", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["detail"]["status"] == "success"
    assert "id" in data["detail"]


# ---------------------------------------------------------------------------
# GET /instructor/assignments/{id}
# ---------------------------------------------------------------------------


async def test_get_assignment_by_id(auth_instructor_client):
    """Instructor can fetch a specific assignment by id after creating one."""
    payload = {
        "name": "route_test_assignment_for_get",
        "description": "For GET by id test",
        "duedate": "2099-01-01T00:00:00",
        "points": 5,
        "kind": "Regular",
        "visible": True,
        "peer_async_visible": False,
    }
    create_resp = await auth_instructor_client.post(
        "/instructor/assignments", json=payload
    )
    assert create_resp.status_code == 201
    assignment_id = create_resp.json()["detail"]["id"]

    get_resp = await auth_instructor_client.get(
        f"/instructor/assignments/{assignment_id}"
    )
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert "assignment" in data["detail"]
    assert data["detail"]["assignment"]["id"] == assignment_id


# ---------------------------------------------------------------------------
# GET /instructor/course_roster
# ---------------------------------------------------------------------------


async def test_course_roster(auth_instructor_client):
    """Instructor can retrieve the course roster with a students list."""
    resp = await auth_instructor_client.get("/instructor/course_roster")
    assert resp.status_code == 200
    data = resp.json()
    assert "students" in data["detail"]
    assert isinstance(data["detail"]["students"], list)


async def test_course_roster_rejects_non_instructor(auth_student_client):
    """A non-instructor (student) is rejected by @instructor_role_required()."""
    resp = await auth_student_client.get("/instructor/course_roster")
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# GET /instructor/assignments/{id}/late_students
# ---------------------------------------------------------------------------

import csv  # noqa: E402
import datetime  # noqa: E402
import io  # noqa: E402
import json  # noqa: E402

from rsptx.db.crud import (  # noqa: E402
    create_assignment,
    create_assignment_question,
    create_question,
    create_useinfo_entry,
    fetch_course,
)
from rsptx.db.models import (  # noqa: E402
    AssignmentQuestionValidator,
    AssignmentValidator,
    QuestionValidator,
    UseinfoValidation,
)
from rsptx.response_helpers.core import canonical_utcnow  # noqa: E402

LATE_COURSE = "test_course_1"
# Enforced assignments use a due date in the past so we can record submissions
# on either side of it.
LATE_DUEDATE = datetime.datetime(2020, 1, 1)
BEFORE_DUE = datetime.datetime(2019, 6, 1)
AFTER_DUE = datetime.datetime(2020, 6, 1)


async def _add_question(name, qnumber=None):
    return await create_question(
        QuestionValidator(
            base_course=LATE_COURSE,
            name=name,
            qnumber=qnumber,
            chapter="ch1",
            subchapter="sub1",
            author="test_instructor",
            question="late route test question?",
            timestamp=canonical_utcnow(),
            question_type="mchoice",
            is_private=False,
            from_source=False,
            review_flag=False,
        )
    )


async def _add_assignment(course_id, name, enforce_due):
    assignment = await create_assignment(
        AssignmentValidator(
            course=course_id,
            name=name,
            points=10,
            released=False,
            description="late route test assignment",
            duedate=LATE_DUEDATE,
            visible=True,
            from_source=False,
            is_peer=False,
            current_index=0,
            peer_async_visible=False,
            enforce_due=enforce_due,
        )
    )
    return assignment


async def _link_question(assignment_id, question_id):
    await create_assignment_question(
        AssignmentQuestionValidator(
            assignment_id=assignment_id,
            question_id=question_id,
            points=10,
            activities_required=0,
            reading_assignment=False,
            sorting_priority=0,
            which_to_grade="best_answer",
            autograde="pct_correct",
        )
    )


async def _add_useinfo(sid, div_id, timestamp):
    await create_useinfo_entry(
        UseinfoValidation(
            timestamp=timestamp,
            sid=sid,
            event="mChoice",
            act="answer:1",
            div_id=div_id,
            course_id=LATE_COURSE,
        )
    )


@pytest.fixture(scope="session")
async def late_work_assignment(instructor_user):
    """An enforced assignment with one late and one on-time submission."""
    course = await fetch_course(LATE_COURSE)
    q = await _add_question("late_route_q1")
    assignment = await _add_assignment(course.id, "late_route_assignment", True)
    await _link_question(assignment.id, q.id)
    # testuser1 submitted after the deadline -> late.
    await _add_useinfo("testuser1", "late_route_q1", AFTER_DUE)
    # ontime_student submitted before the deadline -> not late.
    await _add_useinfo("ontime_student", "late_route_q1", BEFORE_DUE)
    return assignment


@pytest.fixture(scope="session")
async def non_enforced_assignment(instructor_user):
    """An assignment that does not enforce its due date, with a late submission."""
    course = await fetch_course(LATE_COURSE)
    q = await _add_question("late_route_q2")
    assignment = await _add_assignment(course.id, "non_enforced_assignment", False)
    await _link_question(assignment.id, q.id)
    await _add_useinfo("testuser1", "late_route_q2", AFTER_DUE)
    return assignment


@pytest.fixture(scope="session")
async def other_course_assignment(instructor_user):
    """An enforced assignment that lives in a different course (overview)."""
    course = await fetch_course("overview")
    assignment = await _add_assignment(course.id, "other_course_late_assignment", True)
    return assignment


async def test_late_students_lists_late_student(
    auth_instructor_client, late_work_assignment
):
    """Only the student who submitted after the deadline is reported."""
    resp = await auth_instructor_client.get(
        f"/instructor/assignments/{late_work_assignment.id}/late_students"
    )
    assert resp.status_code == 200
    detail = resp.json()["detail"]
    assert detail["assignment_id"] == late_work_assignment.id
    assert detail["enforce_due"] is True

    usernames = [s["username"] for s in detail["students"]]
    assert "testuser1" in usernames
    assert "ontime_student" not in usernames

    late = next(s for s in detail["students"] if s["username"] == "testuser1")
    assert late["name"]  # a display name is always provided


async def test_late_students_not_enforced_is_empty(
    auth_instructor_client, non_enforced_assignment
):
    """When the due date is not enforced no work is counted as late."""
    resp = await auth_instructor_client.get(
        f"/instructor/assignments/{non_enforced_assignment.id}/late_students"
    )
    assert resp.status_code == 200
    detail = resp.json()["detail"]
    assert detail["enforce_due"] is False
    assert detail["students"] == []


async def test_late_students_other_course_forbidden(
    auth_instructor_client, other_course_assignment
):
    """An instructor cannot read late work for an assignment in another course."""
    resp = await auth_instructor_client.get(
        f"/instructor/assignments/{other_course_assignment.id}/late_students"
    )
    assert resp.status_code == 404


async def test_late_students_rejects_non_instructor(
    auth_student_client, late_work_assignment
):
    """A non-instructor (student) is rejected by @instructor_role_required()."""
    resp = await auth_student_client.get(
        f"/instructor/assignments/{late_work_assignment.id}/late_students"
    )
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# GET /instructor/assignments/{id}/student_scores
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
async def scored_student(instructor_user):
    """A student actually enrolled in the instructor's course."""
    from rsptx.db.crud import create_user, create_user_course_entry, fetch_user
    from rsptx.db.models import AuthUserValidator

    course = await fetch_course(LATE_COURSE)
    existing = await fetch_user("scored_student")
    if existing:
        return existing

    user = await create_user(
        AuthUserValidator(
            username="scored_student",
            first_name="Scored",
            last_name="Student",
            password="xxx",
            email="scored_student@example.com",
            course_name=LATE_COURSE,
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
    await create_user_course_entry(user.id, course.id)
    return user


@pytest.fixture(scope="session")
async def scored_assignment(scored_student):
    """An assignment with two questions, only one of which the student has a
    score for."""
    from rsptx.db.crud import create_question_grade_entry

    course = await fetch_course(LATE_COURSE)
    assignment = await _add_assignment(course.id, "scored_route_assignment", True)
    q1 = await _add_question("scored_route_q1", qnumber="Q3.4.1")
    # No qnumber: the popup falls back to the question name for this one.
    q2 = await _add_question("scored_route_q2")
    await _link_question(assignment.id, q1.id)
    await _link_question(assignment.id, q2.id)
    await create_question_grade_entry(
        "scored_student", LATE_COURSE, "scored_route_q1", 7
    )
    # The question ids ride along; the popup posts them to /grader/regrade.
    return assignment, {"scored_route_q1": q1.id, "scored_route_q2": q2.id}


async def test_student_scores_lists_every_question(
    auth_instructor_client, scored_assignment
):
    """Every question is listed, scored or not, with the score when there is one."""
    assignment, question_ids = scored_assignment
    resp = await auth_instructor_client.get(
        f"/instructor/assignments/{assignment.id}/student_scores",
        params={"username": "scored_student"},
    )
    assert resp.status_code == 200
    detail = resp.json()["detail"]
    assert detail["assignment_id"] == assignment.id
    assert detail["username"] == "scored_student"
    assert detail["student_name"]

    by_name = {q["name"]: q for q in detail["questions"]}
    assert by_name["scored_route_q1"]["score"] == 7
    assert by_name["scored_route_q1"]["points"] == 10
    # The popup labels questions by qnumber when there is one.
    assert by_name["scored_route_q1"]["qnumber"] == "Q3.4.1"
    # The ids are what the popup's regrade button posts to /grader/regrade.
    assert by_name["scored_route_q1"]["id"] == question_ids["scored_route_q1"]
    assert by_name["scored_route_q2"]["id"] == question_ids["scored_route_q2"]
    # Unanswered questions still show up, with no score.
    assert by_name["scored_route_q2"]["score"] is None
    assert by_name["scored_route_q2"]["qnumber"] is None
    # The popup uses this to explain a stored total that disagrees with the
    # question scores; there is no Grade row here, so it is the default.
    assert detail["manual_total"] is False
    assert detail["total_score"] is None


async def test_student_scores_unknown_student_404(
    auth_instructor_client, scored_assignment
):
    """A student who is not in the instructor's course is not reported on."""
    assignment, _ = scored_assignment
    resp = await auth_instructor_client.get(
        f"/instructor/assignments/{assignment.id}/student_scores",
        params={"username": "no_such_student_at_all"},
    )
    assert resp.status_code == 404


async def test_student_scores_other_course_forbidden(
    auth_instructor_client, other_course_assignment
):
    """An instructor cannot read scores for an assignment in another course."""
    resp = await auth_instructor_client.get(
        f"/instructor/assignments/{other_course_assignment.id}/student_scores",
        params={"username": "scored_student"},
    )
    assert resp.status_code == 404


async def test_student_scores_rejects_non_instructor(
    auth_student_client, scored_assignment
):
    """A non-instructor (student) is rejected by @instructor_role_required()."""
    assignment, _ = scored_assignment
    resp = await auth_student_client.get(
        f"/instructor/assignments/{assignment.id}/student_scores",
        params={"username": "scored_student"},
    )
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Cross-course assignment sharing and import
# ---------------------------------------------------------------------------


async def _add_shareable_assignment(course_id, name, is_private):
    return await create_assignment(
        AssignmentValidator(
            course=course_id,
            name=name,
            points=10,
            released=False,
            description="sharing route test assignment",
            duedate=datetime.datetime(2099, 1, 1),
            visible=True,
            from_source=False,
            is_peer=False,
            current_index=0,
            peer_async_visible=False,
            kind="Regular",
            is_private=is_private,
        )
    )


@pytest.fixture(scope="session")
async def foreign_course(instructor_user):
    """A course the caller does not instruct, derived from a book.

    Deliberately not a base course: assignments that live directly on a book
    row have always been copyable by anyone, so one of those would pass the
    authorization check for a reason unrelated to the sharing flag.
    """
    from rsptx.db.crud import create_course, create_course_attribute
    from rsptx.db.models import CoursesValidator

    existing = await fetch_course("route_foreign_course")
    if existing:
        return existing

    await create_course(
        CoursesValidator(
            course_name="route_foreign_course",
            base_course="overview",
            term_start_date=datetime.date(2026, 1, 1),
            login_required=False,
            allow_pairs=False,
            downloads_enabled=False,
            courselevel="",
            institution="Other University",
            new_server=True,
        )
    )
    course = await fetch_course("route_foreign_course")
    await create_course_attribute(course.id, "share_assignments", "true")
    return course


@pytest.fixture(scope="session")
async def foreign_shared_assignment(foreign_course):
    """A shareable assignment in a course the caller does not instruct."""
    return await _add_shareable_assignment(foreign_course.id, "route_shared_hw", False)


@pytest.fixture(scope="session")
async def closed_foreign_course(instructor_user):
    """A foreign course that never opted in to sharing."""
    from rsptx.db.crud import create_course
    from rsptx.db.models import CoursesValidator

    existing = await fetch_course("route_closed_course")
    if existing:
        return existing

    await create_course(
        CoursesValidator(
            course_name="route_closed_course",
            base_course="overview",
            term_start_date=datetime.date(2026, 1, 1),
            login_required=False,
            allow_pairs=False,
            downloads_enabled=False,
            courselevel="",
            institution="Other University",
            new_server=True,
        )
    )
    return await fetch_course("route_closed_course")


@pytest.fixture(scope="session")
async def foreign_private_assignment(closed_foreign_course):
    """An assignment in a course that has not opted in to sharing.

    Its own course rather than the shared one: opting in covers every assignment
    in a course, so a single course cannot hold both cases.
    """
    return await _add_shareable_assignment(
        closed_foreign_course.id, "route_private_hw", True
    )


@pytest.fixture(scope="session")
async def base_course_private_assignment(instructor_user):
    """A private assignment sitting directly on a book row."""
    course = await fetch_course("overview")
    return await _add_shareable_assignment(course.id, "route_book_private_hw", True)


async def test_search_lists_a_shared_foreign_assignment(
    auth_instructor_client, foreign_shared_assignment
):
    resp = await auth_instructor_client.post(
        "/instructor/assignments/search", json={"page": 0, "limit": 50}
    )
    assert resp.status_code == 200
    names = [a["name"] for a in resp.json()["detail"]["assignments"]]
    assert "route_shared_hw" in names


async def test_search_omits_a_course_that_has_not_opted_in(
    auth_instructor_client, foreign_private_assignment
):
    """Sharing is off until a course turns it on."""
    resp = await auth_instructor_client.post(
        "/instructor/assignments/search", json={"page": 0, "limit": 50}
    )
    assert resp.status_code == 200
    names = [a["name"] for a in resp.json()["detail"]["assignments"]]
    assert "route_private_hw" not in names


async def test_search_can_be_limited_to_the_callers_own_courses(
    auth_instructor_client, foreign_shared_assignment
):
    """test_instructor teaches only the course being imported into.

    Search already leaves that one out, so narrowing to their own courses has
    to leave nothing -- and in particular must not fall back to showing
    everything, which is how an empty "my courses" list could go wrong.
    """
    wide = await auth_instructor_client.post(
        "/instructor/assignments/search", json={"page": 0, "limit": 50}
    )
    assert "route_shared_hw" in [a["name"] for a in wide.json()["detail"]["assignments"]]

    narrowed = await auth_instructor_client.post(
        "/instructor/assignments/search",
        json={"page": 0, "limit": 50, "only_my_courses": True},
    )
    assert narrowed.status_code == 200
    assert narrowed.json()["detail"]["assignments"] == []


async def test_search_marks_an_assignment_the_caller_already_imported(
    auth_instructor_client, foreign_course
):
    """Its own assignment, not the shared fixture, so test order cannot decide
    whether the "before" case has already been imported."""
    assignment = await _add_shareable_assignment(
        foreign_course.id, "route_reimport_hw", False
    )

    async def search_row():
        resp = await auth_instructor_client.post(
            "/instructor/assignments/search",
            json={
                "page": 0,
                "limit": 50,
                "filters": {
                    "name": {"value": "route_reimport_hw", "matchMode": "equals"}
                },
            },
        )
        assert resp.status_code == 200
        return resp.json()["detail"]["assignments"][0]

    assert (await search_row())["already_imported"] is False

    imported = await auth_instructor_client.post(
        f"/instructor/assignments/{assignment.id}/import"
    )
    assert imported.status_code == 201

    row = await search_row()
    assert row["already_imported"] is True
    assert row["imported_as"] == imported.json()["detail"]["name"]


async def test_search_lists_a_books_own_assignment(
    auth_instructor_client, base_course_private_assignment
):
    """Official material needs no sharing flag, and says so in the row."""
    resp = await auth_instructor_client.post(
        "/instructor/assignments/search",
        json={
            "page": 0,
            "limit": 50,
            "filters": {
                "name": {"value": "route_book_private_hw", "matchMode": "equals"}
            },
        },
    )
    assert resp.status_code == 200
    rows = resp.json()["detail"]["assignments"]
    assert [r["name"] for r in rows] == ["route_book_private_hw"]
    assert rows[0]["is_official"] is True


async def test_shareable_courses_lists_a_course_with_shared_assignments(
    auth_instructor_client, foreign_shared_assignment
):
    resp = await auth_instructor_client.get("/instructor/shareable_courses")
    assert resp.status_code == 200
    detail = resp.json()["detail"]
    names = [c["course_name"] for c in detail["courses"]]
    assert "route_foreign_course" in names
    assert detail["pagination"]["total"] >= 1


async def test_shareable_tree_nests_assignments_under_their_course(
    auth_instructor_client, foreign_shared_assignment
):
    """Exercises the real route, not just the query behind it.

    Regression: this lived at /assignments/shareable_tree, which Starlette
    matched against the much earlier /assignments/{assignment_id} and rejected
    in int coercion. A CRUD-only test cannot see that.
    """
    resp = await auth_instructor_client.get("/instructor/shareable_tree")
    assert resp.status_code == 200, resp.text

    courses = resp.json()["detail"]["courses"]
    source = next(c for c in courses if c["course_name"] == "route_foreign_course")
    assert "route_shared_hw" in [a["name"] for a in source["assignments"]]


async def test_shareable_tree_can_be_limited_to_this_book(
    auth_instructor_client, foreign_shared_assignment
):
    """The caller's book is test_course_1; the shared course is on overview."""
    resp = await auth_instructor_client.get(
        "/instructor/shareable_tree", params={"use_base_course": True}
    )
    assert resp.status_code == 200
    names = [c["course_name"] for c in resp.json()["detail"]["courses"]]
    assert "route_foreign_course" not in names

    wide = await auth_instructor_client.get("/instructor/shareable_tree")
    assert "route_foreign_course" in [
        c["course_name"] for c in wide.json()["detail"]["courses"]
    ]


async def test_import_course_takes_a_whole_courses_assignments(
    auth_instructor_client, foreign_course
):
    """Bulk import, with its own course so the counts do not depend on which
    other tests have already copied from the shared fixture."""
    from rsptx.db.crud import fetch_course

    source = await fetch_course("route_foreign_course")
    await _add_shareable_assignment(source.id, "route_bulk_one", False)

    resp = await auth_instructor_client.post(
        "/instructor/assignments/import_course",
        json={"source_course_id": source.id},
    )
    assert resp.status_code == 201, resp.text
    detail = resp.json()["detail"]
    assert "route_bulk_one" in detail["imported"]
    assert detail["failed"] == []

    # A second pass finds nothing new.
    again = await auth_instructor_client.post(
        "/instructor/assignments/import_course",
        json={"source_course_id": source.id},
    )
    assert again.status_code == 201
    assert again.json()["detail"]["imported"] == []
    assert "route_bulk_one" in again.json()["detail"]["skipped_existing"]


async def test_import_course_refuses_the_callers_own_course(
    auth_instructor_client, instructor_user
):
    course = await fetch_course(instructor_user.course_name)
    resp = await auth_instructor_client.post(
        "/instructor/assignments/import_course",
        json={"source_course_id": course.id},
    )
    assert resp.status_code == 400


async def test_preview_of_a_shared_assignment_is_allowed(
    auth_instructor_client, foreign_shared_assignment
):
    resp = await auth_instructor_client.get(
        f"/instructor/assignments/{foreign_shared_assignment.id}/preview"
    )
    assert resp.status_code == 200
    assert resp.json()["detail"]["name"] == "route_shared_hw"


async def test_preview_of_a_private_foreign_assignment_is_refused(
    auth_instructor_client, foreign_private_assignment
):
    resp = await auth_instructor_client.get(
        f"/instructor/assignments/{foreign_private_assignment.id}/preview"
    )
    assert resp.status_code == 404


async def test_import_of_a_shared_assignment_succeeds(
    auth_instructor_client, foreign_shared_assignment
):
    resp = await auth_instructor_client.post(
        f"/instructor/assignments/{foreign_shared_assignment.id}/import"
    )
    assert resp.status_code == 201
    detail = resp.json()["detail"]
    assert detail["status"] == "success"
    # The client tells the instructor what was left behind, so the count is
    # part of the response even when nothing was.
    assert detail["skipped_readings"] == 0


async def test_import_of_a_private_foreign_assignment_is_refused(
    auth_instructor_client, foreign_private_assignment
):
    resp = await auth_instructor_client.post(
        f"/instructor/assignments/{foreign_private_assignment.id}/import"
    )
    assert resp.status_code == 404


async def test_duplicate_refuses_an_assignment_from_another_course(
    auth_instructor_client, foreign_private_assignment
):
    """Duplicate is a within-course operation.

    Without this check it would copy any assignment by id, which is a way
    around the sharing rules the import endpoint enforces -- and the import
    browser now puts foreign ids in front of the caller.
    """
    resp = await auth_instructor_client.post(
        f"/instructor/assignments/{foreign_private_assignment.id}/duplicate"
    )
    assert resp.status_code == 404


async def test_delete_refuses_an_assignment_from_another_course(
    auth_instructor_client, foreign_shared_assignment
):
    """Deleting keys off the id alone, so it has to be scoped to the course."""
    resp = await auth_instructor_client.delete(
        f"/instructor/assignments/{foreign_shared_assignment.id}"
    )
    assert resp.status_code == 404

    # Still there.
    still_there = await auth_instructor_client.get(
        f"/instructor/assignments/{foreign_shared_assignment.id}/preview"
    )
    assert still_there.status_code == 200


async def test_a_private_assignment_on_a_book_is_still_importable(
    auth_instructor_client, base_course_private_assignment
):
    """Assignments that live directly on a book row stay copyable by anyone.

    That is what the older Copy Assignments page has always allowed, so the
    sharing flag does not take it away. Search agrees: a book's assignments are
    listed without anyone opting in, since no book author has a UI for the flag
    and requiring one would hide every official assignment there is.
    """
    resp = await auth_instructor_client.post(
        f"/instructor/assignments/{base_course_private_assignment.id}/import"
    )
    assert resp.status_code == 201


# ---------------------------------------------------------------------------
# GET /instructor/download_assignment/{id}
# ---------------------------------------------------------------------------

# useinfo timestamps are naive UTC (canonical_utcnow), and the RS_info cookie's
# ``tz_offset`` is UTC minus local time in hours, the way bookfuncs.js sends it
# (Date.getTimezoneOffset() / 60: +5 for US Eastern, -5.5 for India). So the
# instructor's local time is the stored timestamp minus the offset.
DOWNLOAD_UTC_TS = datetime.datetime(2026, 3, 10, 2, 0, 0)


@pytest.fixture(scope="session")
async def download_assignment(instructor_user):
    """An assignment with a single submission logged at a known UTC time."""
    course = await fetch_course(LATE_COURSE)
    q = await _add_question("download_route_q1")
    assignment = await _add_assignment(course.id, "download_route_assignment", False)
    await _link_question(assignment.id, q.id)
    await _add_useinfo("download_student", "download_route_q1", DOWNLOAD_UTC_TS)
    return assignment


async def _download_rows(client, assignment_id, rs_info=None):
    headers = {"Cookie": f"RS_info={rs_info}"} if rs_info is not None else {}
    resp = await client.get(
        f"/instructor/download_assignment/{assignment_id}", headers=headers
    )
    assert resp.status_code == 200
    rows = list(csv.DictReader(io.StringIO(resp.text)))
    return [r for r in rows if r["SID"] == "download_student"]


@pytest.mark.parametrize(
    "tz_offset,expected_local",
    [
        # US Eastern, UTC-5: 02:00 UTC is 21:00 the previous day.
        (5.0, "2026-03-09 21:00:00"),
        # India, UTC+5:30: 02:00 UTC is 07:30 the same day. Half-hour zones only
        # come out right if the offset keeps its fractional part.
        (-5.5, "2026-03-10 07:30:00"),
        # UTC instructor: unchanged.
        (0, "2026-03-10 02:00:00"),
    ],
)
async def test_download_assignment_reports_the_instructors_local_time(
    auth_instructor_client, download_assignment, tz_offset, expected_local
):
    """The CSV shows local time, matching what the analytics reports show.

    Reported by instructors as downloaded logfiles disagreeing with the
    on-screen reports for the same submissions.
    """
    rows = await _download_rows(
        auth_instructor_client,
        download_assignment.id,
        json.dumps({"tz_offset": tz_offset, "timezone": "test"}),
    )
    assert len(rows) == 1
    assert rows[0]["Timestamp"] == expected_local


async def test_download_assignment_without_an_rs_info_cookie(
    auth_instructor_client, download_assignment
):
    """An instructor who never loaded a book page has no RS_info cookie.

    The offset is then unknown, so the stored UTC timestamp is reported as-is
    rather than the request failing.
    """
    rows = await _download_rows(auth_instructor_client, download_assignment.id)
    assert len(rows) == 1
    assert rows[0]["Timestamp"] == "2026-03-10 02:00:00"
