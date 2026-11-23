from rsptx.auth.grader_tokens import (
    resolve_student_grading_token,
    student_grading_token,
)


def test_student_grading_token_is_stable_and_assignment_scoped():
    token = student_grading_token(course_id=1, assignment_id=10, sid="student-1")

    assert token == student_grading_token(
        course_id=1, assignment_id=10, sid="student-1"
    )
    assert token != student_grading_token(
        course_id=1, assignment_id=11, sid="student-1"
    )
    assert token != student_grading_token(
        course_id=1, assignment_id=10, sid="student-2"
    )
    assert "student-1" not in token


def test_student_grading_token_resolves_only_in_supplied_assignment_roster():
    token = student_grading_token(course_id=1, assignment_id=10, sid="student-1")

    assert (
        resolve_student_grading_token(
            course_id=1,
            assignment_id=10,
            token=token,
            candidate_sids=["student-2", "student-1"],
        )
        == "student-1"
    )
    assert (
        resolve_student_grading_token(
            course_id=1,
            assignment_id=11,
            token=token,
            candidate_sids=["student-1"],
        )
        is None
    )
