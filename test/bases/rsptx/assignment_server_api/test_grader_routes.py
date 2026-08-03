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
