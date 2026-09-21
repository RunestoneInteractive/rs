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
    assert set(detail.keys()) == {
        "assignments",
        "students",
        "cells",
        "averages",
        "show_points",
    }
    # Courses show percentages unless they opt into points.
    assert detail["show_points"] is False
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
            "kind",
        }
        assert assignment["kind"] in ("assignment", "practice")
    for student in detail["students"]:
        assert set(student.keys()) == {"sid", "name", "sort_name", "email"}
    for cell in detail["cells"]:
        assert set(cell.keys()) == {
            "sid",
            "assignment_id",
            "score",
            "released",
            "manual_total",
        }
    assignment_ids = {str(assignment["id"]) for assignment in detail["assignments"]}
    assert set(detail["averages"]) == assignment_ids


async def test_gradebook_includes_capped_spaced_practice(auth_instructor_client):
    """Practice mirrors the legacy day-based calculation and is exposed as a
    non-assignment gradebook column with the reserved id zero."""
    import datetime

    from sqlalchemy import delete

    from rsptx.db.async_session import async_session
    from rsptx.db.models import CoursePractice, UserTopicPracticeCompletion

    student = await _enroll_student("testuser1", "test_course_1")
    async with async_session() as session:
        practice = CoursePractice(
            auth_user_id=student.id,
            course_name="test_course_1",
            start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 12, 31),
            max_practice_days=3,
            max_practice_questions=0,
            day_points=2,
            question_points=0,
            graded=1,
            spacing=1,
        )
        completions = [
            UserTopicPracticeCompletion(
                user_id=student.id,
                course_name="test_course_1",
                practice_completion_date=datetime.date(2026, 1, day),
            )
            for day in range(1, 5)
        ]
        session.add(practice)
        session.add_all(completions)
        await session.commit()
        practice_id = practice.id
        completion_ids = [completion.id for completion in completions]

    try:
        resp = await auth_instructor_client.get("/instructor/grader/gradebook/data")
        assert resp.status_code == 200
        detail = resp.json()["detail"]
        practice_column = next(
            assignment
            for assignment in detail["assignments"]
            if assignment["kind"] == "practice"
        )
        assert practice_column == {
            "id": 0,
            "name": "Practice",
            "points": 6.0,
            "duedate": None,
            "released": True,
            "kind": "practice",
        }
        practice_cell = next(
            cell
            for cell in detail["cells"]
            if cell["assignment_id"] == 0 and cell["sid"] == "testuser1"
        )
        # Four completion rows are capped at the configured three days.
        assert practice_cell["score"] == 6.0
        assert detail["averages"]["0"] == 6.0
    finally:
        async with async_session() as session:
            await session.execute(
                delete(UserTopicPracticeCompletion).where(
                    UserTopicPracticeCompletion.id.in_(completion_ids)
                )
            )
            await session.execute(
                delete(CoursePractice).where(CoursePractice.id == practice_id)
            )
            await session.commit()


async def test_gradebook_rejects_non_instructor(auth_student_client):
    """A non-instructor (student) is rejected by @instructor_role_required()."""
    resp = await auth_student_client.get("/instructor/grader/gradebook/data")
    assert resp.status_code in (401, 403)


async def test_gradebook_rejects_editor_without_instructor_role(auth_editor_client):
    """Base-course editor permission does not grant access to student grades."""
    resp = await auth_editor_client.get("/instructor/grader/gradebook/data")
    assert resp.status_code in (401, 403)


async def test_gradebook_is_isolated_to_the_instructors_current_course(
    auth_instructor_client,
):
    """An instructor cannot see assignments belonging to another course."""
    import datetime

    from rsptx.db.crud import create_assignment, fetch_course
    from rsptx.db.crud.assignment import delete_assignment
    from rsptx.db.models import AssignmentValidator

    other_course = await fetch_course("overview")
    foreign_assignment = await create_assignment(
        AssignmentValidator(
            course=other_course.id,
            name="foreign_gradebook_assignment",
            points=10,
            released=False,
            description="course isolation regression test",
            duedate=datetime.datetime(2099, 1, 1),
            visible=True,
            from_source=False,
            is_peer=False,
            current_index=0,
            peer_async_visible=False,
            enforce_due=False,
        )
    )

    try:
        resp = await auth_instructor_client.get("/instructor/grader/gradebook/data")
        assert resp.status_code == 200
        assignment_ids = {
            assignment["id"] for assignment in resp.json()["detail"]["assignments"]
        }
        assert foreign_assignment.id not in assignment_ids
    finally:
        await delete_assignment(foreign_assignment.id)


async def test_gradebook_csv_is_text_csv(auth_instructor_client):
    """The CSV export streams with a text/csv content type and a header row."""
    await _create_assignment(auth_instructor_client, "gradebook_csv_test")

    resp = await auth_instructor_client.get("/instructor/grader/gradebook.csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment" in resp.headers.get("content-disposition", "")
    first_line = resp.text.splitlines()[0]
    assert first_line.startswith("Username,Student,Email")
    # Percentages are the default, and the header says so.
    assert first_line.rstrip().endswith("Total (%)")
    assert "gradebook_csv_test (%)" in first_line


async def test_gradebook_units_toggle_persists_the_course_attribute(
    auth_instructor_client,
):
    """The gradebook's units toggle writes the same show_points course attribute the
    course settings page edits, and the gradebook reads it back."""
    from rsptx.db.crud import fetch_all_course_attributes, fetch_course

    async def units():
        resp = await auth_instructor_client.get("/instructor/grader/gradebook/data")
        assert resp.status_code == 200
        return resp.json()["detail"]["show_points"]

    original = await units()
    try:
        for show_points in (True, False):
            resp = await auth_instructor_client.post(
                "/instructor/grader/gradebook/units",
                json={"show_points": show_points},
            )
            assert resp.status_code == 200
            assert resp.json()["detail"]["show_points"] is show_points
            assert await units() is show_points

            # The attribute itself, not just what the gradebook reports.
            course = await fetch_course("test_course_1")
            attrs = await fetch_all_course_attributes(course.id)
            assert attrs["show_points"] == str(show_points).lower()
    finally:
        await auth_instructor_client.post(
            "/instructor/grader/gradebook/units", json={"show_points": original}
        )


async def test_gradebook_units_rejects_non_instructor(auth_student_client):
    """A student cannot change how the course reports grades."""
    resp = await auth_student_client.post(
        "/instructor/grader/gradebook/units", json={"show_points": True}
    )
    assert resp.status_code in (401, 403)


async def test_gradebook_units_requires_a_boolean(auth_instructor_client):
    """A missing or non-boolean show_points is a validation error, not a silent
    write of some coerced value."""
    resp = await auth_instructor_client.post(
        "/instructor/grader/gradebook/units", json={}
    )
    assert resp.status_code == 422


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


def _csv_fixture(show_points):
    return {
        "assignments": [
            {"id": 1, "name": "Quiz 1", "points": 10},
            {"id": 2, "name": "Homework 2", "points": 5},
        ],
        "students": [
            {"sid": "ada", "name": "Ada Lovelace", "email": "ada@example.com"},
            {"sid": "alan", "name": "Alan Turing", "email": "alan@example.com"},
            {"sid": "grace", "name": "Grace Hopper", "email": "grace@example.com"},
        ],
        "cells": [
            {"sid": "ada", "assignment_id": 1, "score": 8},
            {"sid": "ada", "assignment_id": 2, "score": 5},
            {"sid": "alan", "assignment_id": 1, "score": 6},
            {"sid": "alan", "assignment_id": 2, "score": None},
        ],
        "show_points": show_points,
    }


async def test_gradebook_csv_writes_percentages_by_default():
    """Without the show_points course attribute every score is a percent of what
    the assignment was worth, and a student's total is a percent of only the
    assignments they were graded on."""
    from rsptx.assignment_server_api.routers.grader import _gradebook_to_csv

    rows = _gradebook_to_csv(_csv_fixture(False)).splitlines()

    assert rows[0] == "Username,Student,Email,Quiz 1 (%),Homework 2 (%),Total (%)"
    assert rows[1] == "ada,Ada Lovelace,ada@example.com,80,100,86.67"
    # Alan's ungraded homework is left out of the denominator, not scored as zero.
    assert rows[2] == "alan,Alan Turing,alan@example.com,60,,60"
    # A student with nothing graded has no total at all.
    assert rows[3] == "grace,Grace Hopper,grace@example.com,,,"


async def test_gradebook_csv_writes_points_when_course_asks():
    """With show_points set the CSV carries raw points and names how much each
    assignment was worth."""
    from rsptx.assignment_server_api.routers.grader import _gradebook_to_csv

    rows = _gradebook_to_csv(_csv_fixture(True)).splitlines()

    assert rows[0] == "Username,Student,Email,Quiz 1 (10 pts),Homework 2 (5 pts),Total"
    assert rows[1] == "ada,Ada Lovelace,ada@example.com,8,5,13"
    assert rows[2] == "alan,Alan Turing,alan@example.com,6,,6"


async def test_gradebook_csv_percent_of_a_zero_point_assignment_is_the_raw_score():
    """An assignment worth nothing has no meaningful percent, so its score is
    reported as-is rather than as a division by zero."""
    from rsptx.assignment_server_api.routers.grader import _gradebook_to_csv

    data = _csv_fixture(False)
    data["assignments"] = [{"id": 1, "name": "Ungraded", "points": 0}]
    data["cells"] = [{"sid": "ada", "assignment_id": 1, "score": 3}]

    rows = _gradebook_to_csv(data).splitlines()

    assert rows[1] == "ada,Ada Lovelace,ada@example.com,3,3"


async def _add_reading_question(
    assignment_id,
    chapter,
    subchapter,
    points=5,
    activities_required=2,
    activity_names=(),
):
    """Seed a reading: the page's own question row, the activities on that page,
    and the assignment_question that assigns it. Returns the page question id."""
    import datetime

    from rsptx.db.async_session import async_session
    from rsptx.db.models import AssignmentQuestion, Question

    page_name = f"{chapter}/{subchapter}"
    async with async_session.begin() as session:
        page = Question(
            base_course=COURSE_NAME,
            name=page_name,
            chapter=chapter,
            subchapter=subchapter,
            question_type="page",
            timestamp=datetime.datetime(2024, 1, 1),
            from_source=True,
        )
        session.add(page)
        for name in activity_names:
            session.add(
                Question(
                    base_course=COURSE_NAME,
                    name=name,
                    chapter=chapter,
                    subchapter=subchapter,
                    question_type="mchoice",
                    timestamp=datetime.datetime(2024, 1, 1),
                    from_source=True,
                    optional=False,
                )
            )
        await session.flush()
        session.add(
            AssignmentQuestion(
                assignment_id=assignment_id,
                question_id=page.id,
                points=points,
                autograde="interaction",
                which_to_grade="best_answer",
                reading_assignment=True,
                activities_required=activities_required,
                sorting_priority=1,
            )
        )
        return page.id


async def _set_duedate(assignment_id, duedate):
    from sqlalchemy import update as sa_update

    from rsptx.db.async_session import async_session
    from rsptx.db.models import Assignment

    async with async_session.begin() as session:
        await session.execute(
            sa_update(Assignment)
            .where(Assignment.id == assignment_id)
            .values(duedate=duedate)
        )


async def test_regrade_scores_a_reading_from_the_pages_activity(
    auth_instructor_client,
):
    """Issue #1493: a reading is a page, not a question, so the re-grader used
    to skip it with "no_table" and offer to set the whole class back to no
    score. It now scores the page the way the progress bar does."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(auth_instructor_client, "regrade_reading")
    question_id = await _add_reading_question(
        assignment_id,
        "read_ch",
        "read_sub",
        points=5,
        activities_required=2,
        activity_names=["read_q1", "read_q2"],
    )

    # Opening the page is one activity; answering a question on it is another.
    await _log_useinfo("testuser1", "read_ch/read_sub.html", "page", "view")
    await _log_useinfo("testuser1", "read_q1", "mChoice", "answer:1:correct")

    resp = await auth_instructor_client.post(
        "/instructor/grader/regrade",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question_id],
            "sids": ["testuser1"],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["detail"]["items"][0]["new_score"] == 5
    grade = await _grade_for("testuser1", "read_ch/read_sub")
    assert grade is not None
    assert grade.score == 5


async def test_regrade_reading_scores_zero_without_enough_activities(
    auth_instructor_client,
):
    """Opening the page is one activity; a reading that asks for three is not
    earned by opening it alone."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(
        auth_instructor_client, "regrade_reading_short"
    )
    question_id = await _add_reading_question(
        assignment_id,
        "short_ch",
        "short_sub",
        points=5,
        activities_required=3,
        activity_names=["short_q1", "short_q2", "short_q3"],
    )
    await _log_useinfo("testuser1", "short_ch/short_sub.html", "page", "view")

    resp = await auth_instructor_client.post(
        "/instructor/grader/regrade",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question_id],
            "sids": ["testuser1"],
        },
    )
    assert resp.json()["detail"]["items"][0]["new_score"] == 0
    assert (await _grade_for("testuser1", "short_ch/short_sub")).score == 0


async def test_regrade_reading_leaves_a_student_who_never_opened_it_alone(
    auth_instructor_client,
):
    """No activity at all is "no submission", not a zero: the re-grade must not
    manufacture a grade for a student who was never there."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(
        auth_instructor_client, "regrade_reading_absent"
    )
    question_id = await _add_reading_question(
        assignment_id, "absent_ch", "absent_sub", activity_names=["absent_q1"]
    )

    resp = await auth_instructor_client.post(
        "/instructor/grader/regrade",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question_id],
            "sids": ["testuser1"],
        },
    )
    assert resp.json()["detail"]["items"][0]["skipped"] == "no_submission"
    assert await _grade_for("testuser1", "absent_ch/absent_sub") is None


async def test_regrade_reading_can_award_late_work(auth_instructor_client):
    """The case from issue #1493: the browser refuses to score a reading done
    after the deadline, so the instructor needs the re-grade to give the points
    -- which only works with the deadline enforcement turned off."""
    import datetime

    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(auth_instructor_client, "regrade_late")
    question_id = await _add_reading_question(
        assignment_id,
        "late_ch",
        "late_sub",
        points=5,
        activities_required=1,
        activity_names=["late_q1"],
    )
    await _set_duedate(assignment_id, datetime.datetime(2024, 5, 1, 0, 0, 0))
    # ...and the student read it a month after that.
    await _log_useinfo(
        "testuser1",
        "late_ch/late_sub.html",
        "page",
        "view",
        when=datetime.datetime(2024, 6, 1, 12, 0, 0),
    )

    on_time = await auth_instructor_client.post(
        "/instructor/grader/regrade",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question_id],
            "sids": ["testuser1"],
        },
    )
    assert on_time.json()["detail"]["items"][0]["skipped"] == "no_submission"

    late = await auth_instructor_client.post(
        "/instructor/grader/regrade",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question_id],
            "sids": ["testuser1"],
            "enforce_deadline": False,
        },
    )
    assert late.json()["detail"]["items"][0]["new_score"] == 5
    assert (await _grade_for("testuser1", "late_ch/late_sub")).score == 5


async def test_question_stats_count_readers_of_a_reading(auth_instructor_client):
    """A reading has no answers, so the question list counts the students who
    opened the page instead of reporting 0 for every reading."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(auth_instructor_client, "stats_reading")
    await _add_reading_question(
        assignment_id, "stats_ch", "stats_sub", activity_names=["stats_q1"]
    )
    await _log_useinfo("testuser1", "stats_ch/stats_sub.html", "page", "view")

    resp = await auth_instructor_client.get(
        f"/instructor/grader/assignments/{assignment_id}/questions"
    )
    assert resp.status_code == 200
    stat = [
        q
        for q in resp.json()["detail"]["questions"]
        if q["name"] == "stats_ch/stats_sub"
    ][0]
    assert stat["answered_count"] == 1


async def test_saving_a_grade_without_a_comment_marks_it_hand_graded(
    auth_instructor_client,
):
    """Issue #1515: the grading page saved the autograder's own "autograded"
    placeholder back, so a hand-entered score was not protected from the next
    re-grade. A save now stamps the row as hand graded whatever was typed."""
    from rsptx.grading_helpers.comments import MANUAL_COMMENT

    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id, question = await _assignment_with_question(
        auth_instructor_client, "hand_grade_marker", "hand_grade_marker_q"
    )

    resp = await auth_instructor_client.post(
        "/instructor/grader/grade",
        json={
            "sid": "testuser1",
            "div_id": "hand_grade_marker_q",
            "score": 7,
            "comment": "autograded",
            "assignment_id": assignment_id,
        },
    )
    assert resp.status_code == 200
    # Nothing worth showing a reader, so the response carries no comment...
    assert resp.json()["detail"]["comment"] == ""

    # ...but the row itself is marked, which is what protects the score.
    grade = await _grade_for("testuser1", "hand_grade_marker_q")
    assert grade.comment == MANUAL_COMMENT
    assert grade.score == 7

    # The grading page sees a hand grade with no comment to put in its box.
    answers = await auth_instructor_client.get(
        "/instructor/grader/questions/answers",
        params={"assignment_id": assignment_id, "question_id": question.id},
    )
    mine = [a for a in answers.json()["detail"]["answers"] if a["sid"] == "testuser1"][
        0
    ]
    assert mine["comment"] is None
    assert mine["hand_graded"] is True

    # And a re-grade leaves it alone instead of scoring the question again.
    regrade = await auth_instructor_client.post(
        "/instructor/grader/regrade",
        json={
            "assignment_id": assignment_id,
            "question_ids": [question.id],
            "sids": ["testuser1"],
            "enforce_deadline": False,
        },
    )
    assert regrade.json()["detail"]["items"][0]["skipped"] == "manual"
    assert (await _grade_for("testuser1", "hand_grade_marker_q")).score == 7


async def test_an_autograded_row_is_not_reported_as_hand_graded(
    auth_instructor_client,
):
    """A score the autograder wrote stays available for re-grading, and its
    bookkeeping comment never reaches the instructor's comment box."""
    from rsptx.db.crud import create_question_grade_entry

    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id, question = await _assignment_with_question(
        auth_instructor_client, "auto_grade_marker", "auto_grade_marker_q"
    )
    await create_question_grade_entry(
        "testuser1", COURSE_NAME, "auto_grade_marker_q", 4
    )

    answers = await auth_instructor_client.get(
        "/instructor/grader/questions/answers",
        params={"assignment_id": assignment_id, "question_id": question.id},
    )
    mine = [a for a in answers.json()["detail"]["answers"] if a["sid"] == "testuser1"][
        0
    ]
    assert mine["comment"] is None
    assert mine["hand_graded"] is False


async def _add_select_question(
    assignment_id, selector_div_id, served_div_id, points=5, autograde="pct_correct"
):
    """Seed a ``selectquestion`` wrapper plus the question it stands in for.

    Returns ``(selector_question_id, served_question_id)``.
    """
    import datetime

    from rsptx.db.async_session import async_session
    from rsptx.db.models import AssignmentQuestion, Question

    async with async_session.begin() as session:
        selector = Question(
            base_course=COURSE_NAME,
            name=selector_div_id,
            chapter="ch1",
            subchapter="sub1",
            question_type="selectquestion",
            timestamp=datetime.datetime(2024, 1, 1),
            from_source=False,
        )
        served = Question(
            base_course=COURSE_NAME,
            name=served_div_id,
            chapter="ch1",
            subchapter="sub1",
            question_type="mchoice",
            htmlsrc="<div>the real question</div>",
            timestamp=datetime.datetime(2024, 1, 1),
            from_source=False,
        )
        session.add_all([selector, served])
        await session.flush()
        session.add(
            AssignmentQuestion(
                assignment_id=assignment_id,
                question_id=selector.id,
                points=points,
                autograde=autograde,
                which_to_grade="best_answer",
                reading_assignment=False,
                sorting_priority=1,
            )
        )
        return selector.id, served.id


async def _serve_selected_question(sid, selector_div_id, served_div_id):
    from rsptx.db.crud import create_selected_question

    await create_selected_question(sid, selector_div_id, served_div_id)


async def _log_mchoice_answer(sid, div_id, answer, correct=True, when=None):
    import datetime

    from rsptx.db.async_session import async_session
    from rsptx.db.models import MchoiceAnswers

    async with async_session.begin() as session:
        session.add(
            MchoiceAnswers(
                timestamp=when or datetime.datetime(2024, 6, 1, 12, 0, 0),
                sid=sid,
                div_id=div_id,
                course_name=COURSE_NAME,
                answer=answer,
                correct=correct,
                percent=1.0 if correct else 0.0,
            )
        )


async def test_answers_list_resolves_selectquestion(auth_instructor_client):
    """A selectquestion shows the work the student actually did.

    Regression for issue #1481: the grade is filed under the wrapper but the
    answer is filed under the question the student was served, so reading the
    wrapper's own div_id reported "No submission" for a whole class that had
    already been graded.
    """
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(auth_instructor_client, "answers_selectq")
    selector_id, _served_qid = await _add_select_question(
        assignment_id, "answers_selectq_wrapper", "answers_selectq_real"
    )
    await _serve_selected_question(
        "testuser1", "answers_selectq_wrapper", "answers_selectq_real"
    )
    await _log_mchoice_answer("testuser1", "answers_selectq_real", "0", correct=True)

    resp = await auth_instructor_client.get(
        "/instructor/grader/questions/answers",
        params={"assignment_id": assignment_id, "question_id": selector_id},
    )
    assert resp.status_code == 200
    mine = [a for a in resp.json()["detail"]["answers"] if a["sid"] == "testuser1"]
    assert len(mine) == 1
    assert mine[0]["attempts"] == 1
    assert mine[0]["answer"] == "0"
    assert mine[0]["correct"] is True
    # The preview has to render the served question, not the wrapper.
    assert mine[0]["selected_div_id"] == "answers_selectq_real"
    assert mine[0]["selected_question_type"] == "mchoice"
    assert mine[0]["selected_htmlsrc"] == "<div>the real question</div>"


async def test_answers_list_selectquestion_without_selection(auth_instructor_client):
    """A student the selectquestion was never served to still reads as
    "No submission".

    Without a ``selected_questions`` row there is nothing tying that student to
    the question, so an answer sitting under it is somebody else's business --
    the same call the re-grader makes.
    """
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(
        auth_instructor_client, "answers_selectq_none"
    )
    selector_id, _served_qid = await _add_select_question(
        assignment_id, "answers_selectq_none_wrapper", "answers_selectq_none_real"
    )
    await _log_mchoice_answer("testuser1", "answers_selectq_none_real", "1")

    resp = await auth_instructor_client.get(
        "/instructor/grader/questions/answers",
        params={"assignment_id": assignment_id, "question_id": selector_id},
    )
    assert resp.status_code == 200
    mine = [a for a in resp.json()["detail"]["answers"] if a["sid"] == "testuser1"]
    assert len(mine) == 1
    assert mine[0]["attempts"] == 0
    assert mine[0]["answer"] is None
    assert mine[0]["selected_div_id"] is None


async def test_question_stats_count_selectquestion_answers(auth_instructor_client):
    """The question list counts a selectquestion as answered."""
    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(auth_instructor_client, "stats_selectq")
    selector_id, _served_qid = await _add_select_question(
        assignment_id, "stats_selectq_wrapper", "stats_selectq_real"
    )
    await _serve_selected_question(
        "testuser1", "stats_selectq_wrapper", "stats_selectq_real"
    )
    await _log_mchoice_answer("testuser1", "stats_selectq_real", "2")

    resp = await auth_instructor_client.get(
        f"/instructor/grader/assignments/{assignment_id}/questions"
    )
    assert resp.status_code == 200
    stats = {q["id"]: q for q in resp.json()["detail"]["questions"]}
    assert stats[selector_id]["answered_count"] == 1


async def test_answer_history_resolves_selectquestion(auth_instructor_client):
    """Every attempt on the served question shows in the wrapper's history."""
    import datetime

    await _enroll_student("testuser1", COURSE_NAME)
    assignment_id = await _create_assignment(auth_instructor_client, "history_selectq")
    selector_id, _served_qid = await _add_select_question(
        assignment_id, "history_selectq_wrapper", "history_selectq_real"
    )
    await _serve_selected_question(
        "testuser1", "history_selectq_wrapper", "history_selectq_real"
    )
    await _log_mchoice_answer(
        "testuser1",
        "history_selectq_real",
        "0",
        correct=False,
        when=datetime.datetime(2024, 6, 1, 12, 0, 0),
    )
    await _log_mchoice_answer(
        "testuser1",
        "history_selectq_real",
        "2",
        correct=True,
        when=datetime.datetime(2024, 6, 1, 12, 5, 0),
    )

    resp = await auth_instructor_client.get(
        "/instructor/grader/questions/history",
        params={
            "assignment_id": assignment_id,
            "question_id": selector_id,
            "sid": "testuser1",
        },
    )
    assert resp.status_code == 200
    history = resp.json()["detail"]["history"]
    assert [h["answer"] for h in history] == ["0", "2"]
    assert history[-1]["correct"] is True
