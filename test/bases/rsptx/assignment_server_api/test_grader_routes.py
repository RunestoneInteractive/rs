"""
Functional tests for grader routes in the assignment server.

Routes are decorated with @instructor_role_required(); they are exercised via
the ``auth_instructor_client`` fixture (real instructor DB user) and rejected
via ``auth_student_client`` (a non-instructor). Release state is asserted by
reading the Assignment back through crud, not just the response body.
"""

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _create_assignment(client, name):
    payload = {
        "name": name,
        "description": "Created by grader route test",
        "duedate": "2099-01-01T00:00:00",
        "points": 10,
        "kind": "Regular",
        "visible": True,
        "peer_async_visible": False,
    }
    resp = await client.post("/instructor/assignments", json=payload)
    assert resp.status_code == 201
    return resp.json()["detail"]["id"]


async def test_release_flips_released_flag(auth_instructor_client):
    """Instructor releasing then hiding grades flips Assignment.released and the
    change is persisted (read back through crud)."""
    from rsptx.db.crud import fetch_one_assignment

    assignment_id = await _create_assignment(
        auth_instructor_client, "grader_release_test"
    )

    release_resp = await auth_instructor_client.post(
        "/instructor/grader/release",
        json={"assignment_id": assignment_id, "released": True},
    )
    assert release_resp.status_code == 200
    assert release_resp.json()["detail"]["released"] is True
    refreshed = await fetch_one_assignment(assignment_id)
    assert refreshed.released is True

    hide_resp = await auth_instructor_client.post(
        "/instructor/grader/release",
        json={"assignment_id": assignment_id, "released": False},
    )
    assert hide_resp.status_code == 200
    assert hide_resp.json()["detail"]["released"] is False
    refreshed = await fetch_one_assignment(assignment_id)
    assert refreshed.released is False


async def test_release_rejects_non_instructor(auth_student_client):
    """A non-instructor (student) is rejected by @instructor_role_required()."""
    resp = await auth_student_client.post(
        "/instructor/grader/release",
        json={"assignment_id": 1, "released": True},
    )
    assert resp.status_code in (401, 403)


async def test_release_unknown_assignment_returns_404(auth_instructor_client):
    """Releasing an assignment that does not belong to the course returns 404."""
    resp = await auth_instructor_client.post(
        "/instructor/grader/release",
        json={"assignment_id": 999999, "released": True},
    )
    assert resp.status_code == 404


async def test_gradebook_returns_matrix_shape(auth_instructor_client):
    """The gradebook endpoint returns the assignments / students / cells /
    averages matrix for an instructor."""
    await _create_assignment(auth_instructor_client, "gradebook_shape_test")

    resp = await auth_instructor_client.get("/instructor/grader/gradebook/data")
    assert resp.status_code == 200
    detail = resp.json()["detail"]
    assert set(detail.keys()) == {"assignments", "students", "cells", "averages"}
    assert isinstance(detail["assignments"], list)
    assert isinstance(detail["students"], list)
    assert isinstance(detail["cells"], list)
    assert isinstance(detail["averages"], dict)
    assert any(a["name"] == "gradebook_shape_test" for a in detail["assignments"])
    for assignment in detail["assignments"]:
        assert set(assignment.keys()) == {
            "id",
            "name",
            "points",
            "duedate",
            "released",
        }


async def test_gradebook_rejects_non_instructor(auth_student_client):
    """A non-instructor (student) is rejected by @instructor_role_required()."""
    resp = await auth_student_client.get("/instructor/grader/gradebook/data")
    assert resp.status_code in (401, 403)


async def test_gradebook_csv_is_text_csv(auth_instructor_client):
    """The CSV export streams with a text/csv content type and a header row."""
    await _create_assignment(auth_instructor_client, "gradebook_csv_test")

    resp = await auth_instructor_client.get("/instructor/grader/gradebook.csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment" in resp.headers.get("content-disposition", "")
    first_line = resp.text.splitlines()[0]
    assert first_line.startswith("Student")
    assert first_line.rstrip().endswith("Total")


async def test_gradebook_csv_rejects_non_instructor(auth_student_client):
    """The CSV export is also gated by @instructor_role_required()."""
    resp = await auth_student_client.get("/instructor/grader/gradebook.csv")
    assert resp.status_code in (401, 403)


async def _enroll_student(sid, course_name):
    from rsptx.db.crud import (
        fetch_user,
        fetch_course,
        fetch_users_for_course,
        create_user_course_entry,
    )

    course = await fetch_course(course_name)
    enrolled = {u.username for u in await fetch_users_for_course(course_name)}
    user = await fetch_user(sid)
    if sid not in enrolled:
        await create_user_course_entry(user.id, course.id)
    return user


async def test_manual_total_survives_recompute(auth_instructor_client):
    """A manually pinned total is preserved when recompute_totals_for runs — the
    additive skip guard fires only for manual_total rows."""
    from rsptx.db.crud import fetch_grade

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id = await _create_assignment(
        auth_instructor_client, "manual_total_survive_test"
    )

    set_resp = await auth_instructor_client.post(
        "/instructor/grader/manual_total",
        json={
            "assignment_id": assignment_id,
            "sid": "testuser1",
            "score": 7,
            "manual": True,
        },
    )
    assert set_resp.status_code == 200
    detail = set_resp.json()["detail"]
    assert detail["manual_total"] is True
    assert detail["score"] == 7

    grade = await fetch_grade(student.id, assignment_id)
    assert grade.manual_total
    assert grade.score == 7

    recompute_resp = await auth_instructor_client.post(
        "/instructor/grader/recompute_totals",
        json={"assignment_id": assignment_id, "sids": ["testuser1"]},
    )
    assert recompute_resp.status_code == 200

    grade = await fetch_grade(student.id, assignment_id)
    assert grade.manual_total
    assert grade.score == 7


async def test_manual_total_revert_recomputes(auth_instructor_client):
    """Reverting clears the manual flag and recomputes the total from the
    per-question grades (here zero, since none exist)."""
    from rsptx.db.crud import fetch_grade

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id = await _create_assignment(
        auth_instructor_client, "manual_total_revert_test"
    )

    await auth_instructor_client.post(
        "/instructor/grader/manual_total",
        json={
            "assignment_id": assignment_id,
            "sid": "testuser1",
            "score": 9,
            "manual": True,
        },
    )

    revert_resp = await auth_instructor_client.post(
        "/instructor/grader/manual_total",
        json={"assignment_id": assignment_id, "sid": "testuser1", "manual": False},
    )
    assert revert_resp.status_code == 200
    assert revert_resp.json()["detail"]["manual_total"] is False

    grade = await fetch_grade(student.id, assignment_id)
    assert not grade.manual_total
    assert grade.score == 0


async def test_recompute_unchanged_when_manual_total_unset(auth_instructor_client):
    """Regression: for a grade never marked manual, recompute_totals_for writes
    the computed total normally and is idempotent — the guard is inert."""
    from rsptx.db.crud import fetch_grade

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id = await _create_assignment(
        auth_instructor_client, "manual_total_unset_test"
    )

    first = await auth_instructor_client.post(
        "/instructor/grader/recompute_totals",
        json={"assignment_id": assignment_id, "sids": ["testuser1"]},
    )
    assert first.status_code == 200
    grade = await fetch_grade(student.id, assignment_id)
    assert not grade.manual_total
    assert grade.score == 0

    second = await auth_instructor_client.post(
        "/instructor/grader/recompute_totals",
        json={"assignment_id": assignment_id, "sids": ["testuser1"]},
    )
    assert second.status_code == 200
    grade = await fetch_grade(student.id, assignment_id)
    assert not grade.manual_total
    assert grade.score == 0


async def test_manual_total_rejects_non_instructor(auth_student_client):
    """A non-instructor (student) is rejected by @instructor_role_required()."""
    resp = await auth_student_client.post(
        "/instructor/grader/manual_total",
        json={
            "assignment_id": 1,
            "sid": "testuser1",
            "score": 5,
            "manual": True,
        },
    )
    assert resp.status_code in (401, 403)


async def test_manual_total_unknown_assignment_returns_404(auth_instructor_client):
    """Setting a manual total for an assignment outside the course returns 404."""
    resp = await auth_instructor_client.post(
        "/instructor/grader/manual_total",
        json={
            "assignment_id": 999999,
            "sid": "testuser1",
            "score": 5,
            "manual": True,
        },
    )
    assert resp.status_code == 404


async def test_manual_total_requires_score_when_manual(auth_instructor_client):
    """A manual override without a score is rejected with 422."""
    assignment_id = await _create_assignment(
        auth_instructor_client, "manual_total_noscore_test"
    )
    resp = await auth_instructor_client.post(
        "/instructor/grader/manual_total",
        json={"assignment_id": assignment_id, "sid": "testuser1", "manual": True},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /grade -- manual grading must roll the assignment total up
# ---------------------------------------------------------------------------


async def _assignment_with_question(client, name, div_id, points=10):
    """Create an assignment in the instructor's course with one linked question."""
    from rsptx.db.crud import create_assignment_question, create_question, fetch_course
    from rsptx.db.models import AssignmentQuestionValidator, QuestionValidator
    from rsptx.response_helpers.core import canonical_utcnow

    course = await fetch_course("test_course_1")
    assignment_id = await _create_assignment(client, name)
    question = await create_question(
        QuestionValidator(
            base_course=course.base_course,
            name=div_id,
            chapter="ch1",
            subchapter="sub1",
            author="test_instructor",
            question="grade rollup test question?",
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


async def test_save_grade_updates_assignment_total(auth_instructor_client):
    """Regression: saving a single manual grade must roll up into ``grades``.

    POST /grade used to write only the question_grades row, leaving grades.score
    stale, so the gradebook and the LMS kept showing the pre-grading total.
    """
    from rsptx.db.crud import fetch_grade

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id, _q = await _assignment_with_question(
        auth_instructor_client, "grade_rollup_test", "grade_rollup_q1"
    )

    resp = await auth_instructor_client.post(
        "/instructor/grader/grade",
        json={
            "sid": "testuser1",
            "div_id": "grade_rollup_q1",
            "score": 6,
            "comment": "partial credit",
            "assignment_id": assignment_id,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["detail"]["recomputed_assignments"] == [assignment_id]

    grade = await fetch_grade(student.id, assignment_id)
    assert grade is not None
    assert grade.score == 6


async def test_save_grade_rolls_up_without_assignment_id(auth_instructor_client):
    """Older clients omit assignment_id; the assignment is resolved from div_id."""
    from rsptx.db.crud import fetch_grade

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id, _q = await _assignment_with_question(
        auth_instructor_client, "grade_rollup_fallback_test", "grade_rollup_q2"
    )

    resp = await auth_instructor_client.post(
        "/instructor/grader/grade",
        json={"sid": "testuser1", "div_id": "grade_rollup_q2", "score": 4},
    )
    assert resp.status_code == 200
    assert assignment_id in resp.json()["detail"]["recomputed_assignments"]

    grade = await fetch_grade(student.id, assignment_id)
    assert grade is not None
    assert grade.score == 4


async def test_save_grade_edit_updates_total(auth_instructor_client):
    """Editing an existing (e.g. autograded) score moves the total with it."""
    from rsptx.db.crud import fetch_grade

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id, _q = await _assignment_with_question(
        auth_instructor_client, "grade_edit_rollup_test", "grade_rollup_q3"
    )

    for score in (8, 3):
        resp = await auth_instructor_client.post(
            "/instructor/grader/grade",
            json={
                "sid": "testuser1",
                "div_id": "grade_rollup_q3",
                "score": score,
                "assignment_id": assignment_id,
            },
        )
        assert resp.status_code == 200
        grade = await fetch_grade(student.id, assignment_id)
        assert grade.score == score


async def test_save_grade_respects_pinned_manual_total(auth_instructor_client):
    """A total pinned with /manual_total is not clobbered by the roll-up."""
    from rsptx.db.crud import fetch_grade

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id, _q = await _assignment_with_question(
        auth_instructor_client, "grade_rollup_manual_test", "grade_rollup_q4"
    )

    await auth_instructor_client.post(
        "/instructor/grader/manual_total",
        json={
            "assignment_id": assignment_id,
            "sid": "testuser1",
            "score": 7,
            "manual": True,
        },
    )

    resp = await auth_instructor_client.post(
        "/instructor/grader/grade",
        json={
            "sid": "testuser1",
            "div_id": "grade_rollup_q4",
            "score": 2,
            "assignment_id": assignment_id,
        },
    )
    assert resp.status_code == 200

    grade = await fetch_grade(student.id, assignment_id)
    assert grade.manual_total
    assert grade.score == 7


async def test_save_grade_rejects_non_instructor(auth_student_client):
    """A non-instructor (student) is rejected by @instructor_role_required()."""
    resp = await auth_student_client.post(
        "/instructor/grader/grade",
        json={"sid": "testuser1", "div_id": "q1", "score": 10},
    )
    assert resp.status_code in (401, 403)


async def test_threshold_set_and_clear_persists(auth_instructor_client):
    """Setting a threshold persists threshold_pct on the assignment; clearing it
    (null) resets the field. Read back through crud."""
    from rsptx.db.crud import fetch_one_assignment

    assignment_id = await _create_assignment(
        auth_instructor_client, "threshold_set_test"
    )

    set_resp = await auth_instructor_client.post(
        "/instructor/grader/threshold",
        json={"assignment_id": assignment_id, "threshold_pct": 0.9},
    )
    assert set_resp.status_code == 200
    assert set_resp.json()["detail"]["threshold_pct"] == 0.9
    refreshed = await fetch_one_assignment(assignment_id)
    assert refreshed.threshold_pct == 0.9

    clear_resp = await auth_instructor_client.post(
        "/instructor/grader/threshold",
        json={"assignment_id": assignment_id, "threshold_pct": None},
    )
    assert clear_resp.status_code == 200
    assert clear_resp.json()["detail"]["threshold_pct"] is None
    refreshed = await fetch_one_assignment(assignment_id)
    assert refreshed.threshold_pct is None


async def test_threshold_recompute_no_false_bump_on_zero(auth_instructor_client):
    """Regression: with a threshold set but no per-question grades, recompute does
    not inflate the zero total — 0/points never exceeds a positive threshold."""
    from rsptx.db.crud import fetch_grade

    student = await _enroll_student("testuser1", "test_course_1")
    assignment_id = await _create_assignment(
        auth_instructor_client, "threshold_zero_test"
    )

    await auth_instructor_client.post(
        "/instructor/grader/threshold",
        json={"assignment_id": assignment_id, "threshold_pct": 0.5},
    )

    recompute = await auth_instructor_client.post(
        "/instructor/grader/recompute_totals",
        json={"assignment_id": assignment_id, "sids": ["testuser1"]},
    )
    assert recompute.status_code == 200
    grade = await fetch_grade(student.id, assignment_id)
    assert grade.score == 0


async def test_threshold_out_of_range_returns_422(auth_instructor_client):
    """A threshold outside the 0..1 fraction range is rejected with 422."""
    assignment_id = await _create_assignment(
        auth_instructor_client, "threshold_range_test"
    )
    resp = await auth_instructor_client.post(
        "/instructor/grader/threshold",
        json={"assignment_id": assignment_id, "threshold_pct": 90},
    )
    assert resp.status_code == 422


async def test_threshold_rejects_non_instructor(auth_student_client):
    """A non-instructor (student) is rejected by @instructor_role_required()."""
    resp = await auth_student_client.post(
        "/instructor/grader/threshold",
        json={"assignment_id": 1, "threshold_pct": 0.8},
    )
    assert resp.status_code in (401, 403)


async def test_threshold_unknown_assignment_returns_404(auth_instructor_client):
    """Setting a threshold for an assignment outside the course returns 404."""
    resp = await auth_instructor_client.post(
        "/instructor/grader/threshold",
        json={"assignment_id": 999999, "threshold_pct": 0.8},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# interaction-only questions (video, poll) in the grader
#
# These have no answer table, so the re-grader used to skip them with
# "no_table" and the grading page showed 0 answered / no students.  Their
# submissions are useinfo rows, which is also what makes a re-grade able to
# recover scores for students who watched before the scoring bug was fixed.
# ---------------------------------------------------------------------------

COURSE_NAME = "test_course_1"


async def _add_interaction_question(
    assignment_id, div_id, question_type="youtube", points=5, autograde="interact"
):
    """Seed a video/poll question and attach it to an assignment. Returns the
    question id."""
    import datetime

    from rsptx.db.async_session import async_session
    from rsptx.db.models import AssignmentQuestion, Question

    async with async_session.begin() as session:
        question = Question(
            base_course=COURSE_NAME,
            name=div_id,
            chapter="ch1",
            subchapter="sub1",
            question_type=question_type,
            timestamp=datetime.datetime(2024, 1, 1),
            from_source=False,
        )
        session.add(question)
        await session.flush()
        session.add(
            AssignmentQuestion(
                assignment_id=assignment_id,
                question_id=question.id,
                points=points,
                autograde=autograde,
                which_to_grade="best_answer",
                reading_assignment=False,
                sorting_priority=1,
            )
        )
        return question.id


async def _log_useinfo(sid, div_id, event, act, when=None):
    """Write a useinfo row directly, standing in for interactions students
    logged before the scoring bug was fixed."""
    import datetime

    from rsptx.db.async_session import async_session
    from rsptx.db.models import Useinfo

    async with async_session.begin() as session:
        session.add(
            Useinfo(
                timestamp=when or datetime.datetime(2024, 6, 1, 12, 0, 0),
                sid=sid,
                event=event,
                act=act,
                div_id=div_id,
                course_id=COURSE_NAME,
            )
        )


async def _grade_for(sid, div_id):
    from rsptx.db.crud import fetch_question_grade

    return await fetch_question_grade(sid, COURSE_NAME, div_id)


async def test_regrade_scores_video_from_useinfo(auth_instructor_client):
    """The re-grader recovers a score for a video from the useinfo rows.

    Regression test for videos being skipped with "no_table": QTYPE_TO_TABLE has
    no entry for youtube, so regrade_one used to bail out before scoring."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(auth_instructor_client, "regrade_video")
    div_id = "regrade_video_q"
    question_id = await _add_interaction_question(assignment_id, div_id, points=5)
    await _log_useinfo("testuser1", div_id, "video", "play:42.5")

    resp = await auth_instructor_client.post(
        "/instructor/grader/regrade",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question_id],
            "sids": ["testuser1"],
        },
    )
    assert resp.status_code == 200
    report = resp.json()["detail"]
    assert report["total"] == 1
    assert not any(i.get("skipped") == "no_table" for i in report["items"])

    grade = await _grade_for("testuser1", div_id)
    assert grade is not None
    assert grade.score == 5


async def test_regrade_preview_does_not_write_video_grade(auth_instructor_client):
    """The dry run reports the score it would give without persisting it."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(
        auth_instructor_client, "regrade_video_preview"
    )
    div_id = "regrade_video_preview_q"
    question_id = await _add_interaction_question(assignment_id, div_id, points=4)
    await _log_useinfo("testuser1", div_id, "video", "complete")

    resp = await auth_instructor_client.post(
        "/instructor/grader/regrade/preview",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question_id],
            "sids": ["testuser1"],
        },
    )
    assert resp.status_code == 200
    items = resp.json()["detail"]["items"]
    assert items[0]["new_score"] == 4
    assert await _grade_for("testuser1", div_id) is None


async def test_regrade_ignores_ready_only_video(auth_instructor_client):
    """A student whose only useinfo row is "ready" never touched the video --
    the player logs that as soon as it is built -- so a re-grade must not turn
    those pre-existing rows into credit."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(
        auth_instructor_client, "regrade_video_ready"
    )
    div_id = "regrade_video_ready_q"
    question_id = await _add_interaction_question(assignment_id, div_id)
    await _log_useinfo("testuser1", div_id, "video", "ready")

    resp = await auth_instructor_client.post(
        "/instructor/grader/regrade",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question_id],
            "sids": ["testuser1"],
        },
    )
    assert resp.status_code == 200
    items = resp.json()["detail"]["items"]
    assert items[0]["skipped"] == "no_submission"
    assert await _grade_for("testuser1", div_id) is None


async def test_regrade_video_enforces_deadline(auth_instructor_client):
    """Interactions after the due date are excluded when the deadline is
    enforced, the same as answers in an answer table."""
    import datetime

    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(
        auth_instructor_client, "regrade_video_late"
    )
    # Move the due date into the past so the interaction below counts as late.
    from rsptx.db.async_session import async_session
    from rsptx.db.models import Assignment
    from sqlalchemy import update

    async with async_session.begin() as session:
        await session.execute(
            update(Assignment)
            .where(Assignment.id == assignment_id)
            .values(duedate=datetime.datetime(2024, 1, 1))
        )

    div_id = "regrade_video_late_q"
    question_id = await _add_interaction_question(assignment_id, div_id)
    await _log_useinfo(
        "testuser1", div_id, "video", "play:5", when=datetime.datetime(2024, 6, 1)
    )

    late_resp = await auth_instructor_client.post(
        "/instructor/grader/regrade",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question_id],
            "sids": ["testuser1"],
            "enforce_deadline": True,
        },
    )
    assert late_resp.json()["detail"]["items"][0]["skipped"] == "no_submission"
    assert await _grade_for("testuser1", div_id) is None

    # Without deadline enforcement the same interaction scores.
    ok_resp = await auth_instructor_client.post(
        "/instructor/grader/regrade",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question_id],
            "sids": ["testuser1"],
            "enforce_deadline": False,
        },
    )
    assert ok_resp.status_code == 200
    grade = await _grade_for("testuser1", div_id)
    assert grade is not None
    assert grade.score == 5


async def test_regrade_video_preserves_manual_grade(auth_instructor_client):
    """A hand-entered grade on a video is protected unless the instructor asks
    to overwrite manual grades."""
    from sqlalchemy import update as sa_update

    from rsptx.db.async_session import async_session
    from rsptx.db.crud import create_question_grade_entry
    from rsptx.db.models import QuestionGrade

    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(
        auth_instructor_client, "regrade_video_manual"
    )
    div_id = "regrade_video_manual_q"
    question_id = await _add_interaction_question(assignment_id, div_id, points=5)
    await _log_useinfo("testuser1", div_id, "video", "play:1")

    # A hand-entered grade is one whose comment is not "autograded".
    created = await create_question_grade_entry("testuser1", COURSE_NAME, div_id, 2)
    async with async_session.begin() as session:
        await session.execute(
            sa_update(QuestionGrade)
            .where(QuestionGrade.id == created.id)
            .values(comment="graded by hand")
        )

    resp = await auth_instructor_client.post(
        "/instructor/grader/regrade",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question_id],
            "sids": ["testuser1"],
        },
    )
    assert resp.json()["detail"]["items"][0]["skipped"] == "manual"
    grade = await _grade_for("testuser1", div_id)
    assert grade.score == 2

    # ...unless the instructor explicitly overwrites manual grades.
    resp = await auth_instructor_client.post(
        "/instructor/grader/regrade",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question_id],
            "sids": ["testuser1"],
            "overwrite_manual": True,
        },
    )
    assert resp.status_code == 200
    grade = await _grade_for("testuser1", div_id)
    assert grade.score == 5


async def test_regrade_scores_poll_from_useinfo(auth_instructor_client):
    """Polls take the same path as videos."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(auth_instructor_client, "regrade_poll")
    div_id = "regrade_poll_q"
    question_id = await _add_interaction_question(
        assignment_id, div_id, question_type="poll", points=3
    )
    await _log_useinfo("testuser1", div_id, "poll", "2")

    resp = await auth_instructor_client.post(
        "/instructor/grader/regrade",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question_id],
            "sids": ["testuser1"],
        },
    )
    assert resp.status_code == 200
    grade = await _grade_for("testuser1", div_id)
    assert grade is not None
    assert grade.score == 3


async def test_question_stats_count_video_interactions(auth_instructor_client):
    """The grading page counts a video as answered when the student interacted,
    instead of reporting 0 answered for the whole class."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(auth_instructor_client, "stats_video")
    div_id = "stats_video_q"
    question_id = await _add_interaction_question(assignment_id, div_id)
    await _log_useinfo("testuser1", div_id, "video", "play:7")

    resp = await auth_instructor_client.get(
        f"/instructor/grader/assignments/{assignment_id}/questions"
    )
    assert resp.status_code == 200
    stats = {q["id"]: q for q in resp.json()["detail"]["questions"]}
    assert stats[question_id]["answered_count"] == 1


async def test_question_stats_ignore_ready_only_video(auth_instructor_client):
    """A player that was merely built does not count as the student answering."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(
        auth_instructor_client, "stats_video_ready"
    )
    div_id = "stats_video_ready_q"
    question_id = await _add_interaction_question(assignment_id, div_id)
    await _log_useinfo("testuser1", div_id, "video", "ready")

    resp = await auth_instructor_client.get(
        f"/instructor/grader/assignments/{assignment_id}/questions"
    )
    stats = {q["id"]: q for q in resp.json()["detail"]["questions"]}
    assert stats[question_id]["answered_count"] == 0


async def test_answers_list_shows_video_interaction(auth_instructor_client):
    """The per-question answer list shows the student and what they did, rather
    than being empty because there is no answer table."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(auth_instructor_client, "answers_video")
    div_id = "answers_video_q"
    question_id = await _add_interaction_question(assignment_id, div_id)
    await _log_useinfo("testuser1", div_id, "video", "play:5")
    await _log_useinfo("testuser1", div_id, "video", "pause:125.5")

    resp = await auth_instructor_client.get(
        "/instructor/grader/questions/answers",
        params={"assignment_id": assignment_id, "question_id": question_id},
    )
    assert resp.status_code == 200
    answers = resp.json()["detail"]["answers"]
    mine = [a for a in answers if a["sid"] == "testuser1"]
    assert len(mine) == 1
    # The latest interaction is shown, and both count as attempts.
    assert mine[0]["answer"] == "Paused at 2:05"
    assert mine[0]["attempts"] == 2


async def test_answers_list_includes_students_who_did_not_submit(
    auth_instructor_client,
):
    """Every enrolled student is listed, so an instructor can see who skipped the
    question and record a zero instead of the class looking smaller than it is."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id, question = await _assignment_with_question(
        auth_instructor_client, "answers_roster", "answers_roster_q"
    )

    resp = await auth_instructor_client.get(
        "/instructor/grader/questions/answers",
        params={"assignment_id": assignment_id, "question_id": question.id},
    )
    assert resp.status_code == 200
    answers = resp.json()["detail"]["answers"]
    mine = [a for a in answers if a["sid"] == "testuser1"]
    assert len(mine) == 1
    # 0 attempts and no answer is what marks the student as never having submitted.
    assert mine[0]["attempts"] == 0
    assert mine[0]["answer"] is None
    assert mine[0]["timestamp"] is None
    assert mine[0]["score"] is None


async def test_answers_list_keeps_grade_without_submission(auth_instructor_client):
    """A student graded by hand keeps that score in the list even though they
    never submitted an answer."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id, question = await _assignment_with_question(
        auth_instructor_client, "answers_roster_graded", "answers_roster_graded_q"
    )

    grade_resp = await auth_instructor_client.post(
        "/instructor/grader/grade",
        json={
            "sid": "testuser1",
            "div_id": "answers_roster_graded_q",
            "score": 4,
            "comment": "credit for the write-up",
            "assignment_id": assignment_id,
        },
    )
    assert grade_resp.status_code == 200

    resp = await auth_instructor_client.get(
        "/instructor/grader/questions/answers",
        params={"assignment_id": assignment_id, "question_id": question.id},
    )
    mine = [a for a in resp.json()["detail"]["answers"] if a["sid"] == "testuser1"]
    assert len(mine) == 1
    assert mine[0]["attempts"] == 0
    assert mine[0]["score"] == 4
    assert mine[0]["comment"] == "credit for the write-up"


async def test_answer_history_shows_video_timeline(auth_instructor_client):
    """The per-student history is built from useinfo for interaction-only
    questions."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(auth_instructor_client, "history_video")
    div_id = "history_video_q"
    question_id = await _add_interaction_question(assignment_id, div_id)
    await _log_useinfo("testuser1", div_id, "video", "play:0")
    await _log_useinfo("testuser1", div_id, "video", "complete")
    await _log_useinfo("testuser1", div_id, "video", "ready")

    resp = await auth_instructor_client.get(
        "/instructor/grader/questions/history",
        params={
            "assignment_id": assignment_id,
            "question_id": question_id,
            "sid": "testuser1",
        },
    )
    assert resp.status_code == 200
    history = resp.json()["detail"]["history"]
    descriptions = [h["answer"] for h in history]
    assert "Played at 0:00" in descriptions
    assert "Watched to the end" in descriptions
    assert all(h["source"] == "useinfo" for h in history)
    # "ready" is not a student interaction and stays out of the timeline.
    assert len(history) == 2
