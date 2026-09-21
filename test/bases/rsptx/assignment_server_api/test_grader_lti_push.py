"""Does a grade an instructor enters by hand reach the LMS?

``POST /instructor/grader/grade`` writes one ``question_grades`` row, rolls it
up into the student's ``grades`` row, and hands the new total to whichever LTI
service the course is linked to. These tests walk that whole path for LTI 1.1
and 1.3, and check the release gate that holds a grade back.

The LTI rows are torn down after each test: ``fetch_lti_version`` answers "1.1"
for any course with a ``course_lti_map`` row, so leaving one behind would make
every other grader test in the session start attempting passback.
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture
async def lti1p1_course(init_test_db):
    """Link ``test_course_1`` to an LTI 1.1 consumer, and unlink it afterwards."""
    from sqlalchemy import delete
    from rsptx.db.crud import create_lti1p1_config, fetch_course
    from rsptx.db.models import CourseLtiMap, LtiKey
    from rsptx.db.async_session import async_session

    course = await fetch_course("test_course_1")
    key = await create_lti1p1_config(course.course_name, course.id)
    yield course, key
    async with async_session.begin() as session:
        await session.execute(delete(CourseLtiMap).where(CourseLtiMap.lti_id == key.id))
        await session.execute(delete(LtiKey).where(LtiKey.id == key.id))


async def _create_assignment(client, name, released=True):
    payload = {
        "name": name,
        "description": "lti passback test",
        "duedate": "2099-01-01T00:00:00",
        "points": 10,
        "kind": "Regular",
        "visible": True,
        "peer_async_visible": False,
    }
    resp = await client.post("/instructor/assignments", json=payload)
    assert resp.status_code == 201
    assignment_id = resp.json()["detail"]["id"]
    # POST /instructor/assignments creates assignments already released, so the
    # unreleased case has to be set explicitly rather than just left alone.
    resp = await client.post(
        "/instructor/grader/release",
        json={"assignment_id": assignment_id, "released": released},
    )
    assert resp.status_code == 200
    return assignment_id


async def _assignment_with_question(client, name, div_id, points=10, released=True):
    from rsptx.db.crud import create_assignment_question, create_question, fetch_course
    from rsptx.db.models import AssignmentQuestionValidator, QuestionValidator
    from rsptx.response_helpers.core import canonical_utcnow

    course = await fetch_course("test_course_1")
    assignment_id = await _create_assignment(client, name, released=released)
    question = await create_question(
        QuestionValidator(
            base_course=course.base_course,
            name=div_id,
            chapter="ch1",
            subchapter="sub1",
            author="test_instructor",
            question="lti passback test question?",
            timestamp=canonical_utcnow(),
            question_type="mchoice",
            is_private=False,
            from_source=False,
            review_flag=False,
        )
    )
    await create_assignment_question(
        AssignmentQuestionValidator(
            assignment_id=assignment_id,
            question_id=question.id,
            points=points,
            activities_required=0,
            reading_assignment=False,
            sorting_priority=0,
            which_to_grade="best_answer",
            autograde="pct_correct",
        )
    )
    return assignment_id, question


async def _enroll_student(sid, course_name):
    from rsptx.db.crud import (
        create_user_course_entry,
        fetch_course,
        fetch_user,
        fetch_users_for_course,
    )

    course = await fetch_course(course_name)
    enrolled = {u.username for u in await fetch_users_for_course(course_name)}
    user = await fetch_user(sid)
    if sid not in enrolled:
        await create_user_course_entry(user.id, course.id)
    return user


def _key_of(lti1p1_course):
    """The LtiKey half of the ``lti1p1_course`` fixture's (course, key) pair."""
    return lti1p1_course[1]


async def _make_student(sid, course_name):
    """An enrolled student who has never submitted anything."""
    import datetime

    from rsptx.db.crud import create_user, fetch_course, fetch_user
    from rsptx.db.models import AuthUserValidator

    existing = await fetch_user(sid)
    if existing:
        return await _enroll_student(sid, course_name)

    course = await fetch_course(course_name)
    await create_user(
        AuthUserValidator(
            username=sid,
            first_name="Never",
            last_name="Submitted",
            password="xxx",
            email=f"{sid}@example.com",
            course_name=course_name,
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
    return await _enroll_student(sid, course_name)


async def _grade(client, sid, div_id, score, assignment_id, comment=""):
    return await client.post(
        "/instructor/grader/grade",
        json={
            "sid": sid,
            "div_id": div_id,
            "score": score,
            "comment": comment,
            "assignment_id": assignment_id,
        },
    )


async def test_manual_grade_dispatches_to_lti1p1(auth_instructor_client, lti1p1_course):
    """A 1.1-linked course sends the rolled-up total over the outcomes service."""
    from rsptx.grading_helpers import lti_push

    course, _key = lti1p1_course
    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id, _q = await _assignment_with_question(
        auth_instructor_client, "lti11_manual_push", "lti11_push_q1"
    )

    with (
        patch.object(lti_push, "attempt_lti1p1_score_updates", AsyncMock()) as push11,
        patch.object(
            lti_push, "attempt_lti1p3_score_updates_for", AsyncMock()
        ) as push13,
    ):
        resp = await _grade(
            auth_instructor_client, "testuser1", "lti11_push_q1", 6, assignment_id
        )

    assert resp.status_code == 200
    push13.assert_not_awaited()
    push11.assert_awaited_once()
    sent_assignment, sent_course_id, updates = push11.await_args.args
    assert sent_assignment.id == assignment_id
    assert sent_course_id == course.id
    assert updates == [(student.id, 6)]


async def test_manual_grade_dispatches_to_lti1p3(auth_instructor_client):
    """A 1.3-linked course gets the same total through the AGS batch call."""
    from rsptx.grading_helpers import lti_push

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id, _q = await _assignment_with_question(
        auth_instructor_client, "lti13_manual_push", "lti13_push_q1"
    )

    with (
        patch.object(lti_push, "fetch_lti_version", AsyncMock(return_value="1.3")),
        patch.object(lti_push, "attempt_lti1p1_score_updates", AsyncMock()) as push11,
        patch.object(
            lti_push, "attempt_lti1p3_score_updates_for", AsyncMock()
        ) as push13,
    ):
        resp = await _grade(
            auth_instructor_client, "testuser1", "lti13_push_q1", 9, assignment_id
        )

    assert resp.status_code == 200
    push11.assert_not_awaited()
    push13.assert_awaited_once()
    assert push13.await_args.args[0] == assignment_id
    assert push13.await_args.args[1] == [(student.id, 9)]
    # An instructor's grade must not be reported to the LMS as a late submission.
    assert push13.await_args.kwargs.get("instructor_triggered") is True


async def test_manual_grade_reaches_the_lti1p1_outcomes_service(
    auth_instructor_client, lti1p1_course
):
    """End to end: the signed ``replaceResult`` POST carries the new total.

    Nothing is mocked short of the outbound HTTP call itself, so this also
    covers the passback identifiers recorded at launch and the score-to-fraction
    conversion the outcomes service requires.
    """
    from rsptx.db.crud import upsert_lti1p1_grade_link
    from rsptx.lti1p1 import core as lti1p1_core

    _course, key = lti1p1_course
    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id, _q = await _assignment_with_question(
        auth_instructor_client, "lti11_outcome_push", "lti11_push_q3"
    )
    # Recorded when the student launches the assignment from the LMS.
    await upsert_lti1p1_grade_link(
        student.id, assignment_id, "sourcedid-abc", "https://lms.test/outcomes"
    )

    with patch.object(lti1p1_core, "send_lti1p1_grade", MagicMock()) as sender:
        resp = await _grade(
            auth_instructor_client, "testuser1", "lti11_push_q3", 7, assignment_id
        )

    assert resp.status_code == 200
    sender.assert_called_once_with(
        10,  # assignment.points
        7,  # the new total
        key.consumer,
        key.secret,
        "https://lms.test/outcomes",
        "sourcedid-abc",
    )


async def test_manual_grade_on_an_unreleased_assignment_is_held_back(
    auth_instructor_client, lti1p1_course
):
    """Grades are not pushed until the instructor releases the assignment."""
    from rsptx.db.crud import fetch_grade, upsert_lti1p1_grade_link
    from rsptx.lti1p1 import core as lti1p1_core

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id, _q = await _assignment_with_question(
        auth_instructor_client,
        "lti11_unreleased_push",
        "lti11_push_q4",
        released=False,
    )
    await upsert_lti1p1_grade_link(
        student.id, assignment_id, "sourcedid-held", "https://lms.test/outcomes"
    )

    with patch.object(lti1p1_core, "send_lti1p1_grade", MagicMock()) as sender:
        resp = await _grade(
            auth_instructor_client, "testuser1", "lti11_push_q4", 5, assignment_id
        )

    assert resp.status_code == 200
    sender.assert_not_called()
    # The grade is still recorded in Runestone -- only the passback waits.
    grade = await fetch_grade(student.id, assignment_id)
    assert grade.score == 5


async def test_releasing_flushes_grades_held_back_while_hidden(
    auth_instructor_client, lti1p1_course
):
    """Releasing sends totals the release gate dropped while grades were hidden.

    Hiding grades to mark a batch of work is the toggle's main use, and it is
    also what stops passback. Nothing else resends those grades: by the time
    they are released the totals are already correct in Runestone, so a plain
    recompute sees no change and skips them.
    """
    from rsptx.db.crud import upsert_lti1p1_grade_link
    from rsptx.lti1p1 import core as lti1p1_core

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id, _q = await _assignment_with_question(
        auth_instructor_client,
        "lti11_release_flush",
        "lti11_push_q5",
        released=False,
    )
    await upsert_lti1p1_grade_link(
        student.id, assignment_id, "sourcedid-rel", "https://lms.test/outcomes"
    )

    with patch.object(lti1p1_core, "send_lti1p1_grade", MagicMock()) as sender:
        resp = await _grade(
            auth_instructor_client, "testuser1", "lti11_push_q5", 7, assignment_id
        )
        assert resp.status_code == 200
        sender.assert_not_called()

        resp = await auth_instructor_client.post(
            "/instructor/grader/release",
            json={"assignment_id": assignment_id, "released": True},
        )

    assert resp.status_code == 200
    assert resp.json()["detail"]["lms_pushed"] >= 1
    sender.assert_any_call(
        10,  # assignment.points
        7,  # the total held back while hidden
        _key_of(lti1p1_course).consumer,
        _key_of(lti1p1_course).secret,
        "https://lms.test/outcomes",
        "sourcedid-rel",
    )


async def test_releasing_an_already_released_assignment_pushes_nothing(
    auth_instructor_client, lti1p1_course
):
    """Only the false->true edge flushes; re-asserting released is a no-op.

    Without the edge check every save of the grader's release switch would fan
    a roster-sized batch of blocking LMS calls out of one idempotent request.
    """
    from rsptx.db.crud import upsert_lti1p1_grade_link
    from rsptx.lti1p1 import core as lti1p1_core

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id, _q = await _assignment_with_question(
        auth_instructor_client, "lti11_release_noop", "lti11_push_q6", released=True
    )
    await upsert_lti1p1_grade_link(
        student.id, assignment_id, "sourcedid-noop", "https://lms.test/outcomes"
    )
    with patch.object(lti1p1_core, "send_lti1p1_grade", MagicMock()):
        await _grade(
            auth_instructor_client, "testuser1", "lti11_push_q6", 4, assignment_id
        )

    with patch.object(lti1p1_core, "send_lti1p1_grade", MagicMock()) as sender:
        resp = await auth_instructor_client.post(
            "/instructor/grader/release",
            json={"assignment_id": assignment_id, "released": True},
        )

    assert resp.status_code == 200
    assert resp.json()["detail"]["lms_pushed"] == 0
    sender.assert_not_called()


async def test_hiding_grades_pushes_nothing(auth_instructor_client, lti1p1_course):
    """LTI has no way to retract a grade, and hiding scores from students says
    nothing about the LMS gradebook -- so true->false stays a pure flag flip."""
    from rsptx.db.crud import upsert_lti1p1_grade_link
    from rsptx.lti1p1 import core as lti1p1_core

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id, _q = await _assignment_with_question(
        auth_instructor_client, "lti11_hide_noop", "lti11_push_q7", released=True
    )
    await upsert_lti1p1_grade_link(
        student.id, assignment_id, "sourcedid-hide", "https://lms.test/outcomes"
    )
    with patch.object(lti1p1_core, "send_lti1p1_grade", MagicMock()):
        await _grade(
            auth_instructor_client, "testuser1", "lti11_push_q7", 4, assignment_id
        )

    with patch.object(lti1p1_core, "send_lti1p1_grade", MagicMock()) as sender:
        resp = await auth_instructor_client.post(
            "/instructor/grader/release",
            json={"assignment_id": assignment_id, "released": False},
        )

    assert resp.status_code == 200
    assert resp.json()["detail"]["lms_pushed"] == 0
    sender.assert_not_called()


async def test_releasing_does_not_invent_zeros_for_students_who_never_submitted(
    auth_instructor_client, lti1p1_course
):
    """``only_existing`` keeps the flush from materialising a zero -- and
    pushing it -- for a student with no grades row."""
    from rsptx.db.crud import fetch_grade
    from rsptx.lti1p1 import core as lti1p1_core

    await _enroll_student("testuser1", "test_course_1")
    ungraded = await _make_student("never_submitted", "test_course_1")
    assignment_id, _q = await _assignment_with_question(
        auth_instructor_client, "lti11_release_zeros", "lti11_push_q8", released=False
    )

    with patch.object(lti1p1_core, "send_lti1p1_grade", MagicMock()):
        resp = await auth_instructor_client.post(
            "/instructor/grader/release",
            json={"assignment_id": assignment_id, "released": True},
        )

    assert resp.status_code == 200
    # Guard against a vacuous pass: the student must really be on the roster
    # the flush walks.
    from rsptx.db.crud import fetch_users_for_course

    roster = {u.username for u in await fetch_users_for_course("test_course_1")}
    assert "never_submitted" in roster
    assert await fetch_grade(ungraded.id, assignment_id) is None


async def test_release_survives_an_lms_that_is_down(
    auth_instructor_client, lti1p1_course
):
    """A failing passback must not leave the assignment unreleased in Runestone."""
    from rsptx.db.crud import fetch_one_assignment, upsert_lti1p1_grade_link
    from rsptx.lti1p1 import core as lti1p1_core

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id, _q = await _assignment_with_question(
        auth_instructor_client, "lti11_release_down", "lti11_push_q9", released=False
    )
    await upsert_lti1p1_grade_link(
        student.id, assignment_id, "sourcedid-down", "https://lms.test/outcomes"
    )
    with patch.object(lti1p1_core, "send_lti1p1_grade", MagicMock()):
        await _grade(
            auth_instructor_client, "testuser1", "lti11_push_q9", 6, assignment_id
        )

    boom = MagicMock(side_effect=RuntimeError("LMS unreachable"))
    with patch.object(lti1p1_core, "send_lti1p1_grade", boom):
        resp = await auth_instructor_client.post(
            "/instructor/grader/release",
            json={"assignment_id": assignment_id, "released": True},
        )

    assert resp.status_code == 200
    assignment = await fetch_one_assignment(assignment_id)
    assert assignment.released
