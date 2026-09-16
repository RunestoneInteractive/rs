"""The rules that decide who owns a ``question_grades`` row."""

from rsptx.grading_helpers.comments import (
    AUTOGRADE_COMMENT,
    MANUAL_COMMENT,
    display_comment,
    instructor_comment,
    is_autograder_comment,
    is_displayable_comment,
    is_hand_graded,
)


def test_autograder_placeholders_are_not_hand_graded():
    assert is_hand_graded(AUTOGRADE_COMMENT) is False
    assert is_hand_graded("ungraded") is False
    assert is_hand_graded("  Autograded  ") is False


def test_a_blank_comment_is_nobodys_grade():
    # Rows predate the marker, so blank must not claim to be hand graded...
    assert is_hand_graded("") is False
    assert is_hand_graded(None) is False
    # ...but it is not the autograder's word either, so the cautious callers
    # (the batch re-grade) still leave it alone.
    assert is_autograder_comment("") is False
    assert is_autograder_comment(None) is False


def test_instructor_words_and_the_marker_are_hand_graded():
    assert is_hand_graded("nice work") is True
    assert is_hand_graded(MANUAL_COMMENT) is True


def test_saving_by_hand_always_marks_the_row():
    # No comment, or the autograder's own placeholder typed back at us, still
    # has to leave the row protected from the next re-grade.
    assert instructor_comment("") == MANUAL_COMMENT
    assert instructor_comment(None) == MANUAL_COMMENT
    assert instructor_comment("   ") == MANUAL_COMMENT
    assert instructor_comment(AUTOGRADE_COMMENT) == MANUAL_COMMENT
    assert is_hand_graded(instructor_comment("")) is True


def test_saving_by_hand_keeps_what_the_instructor_typed():
    assert instructor_comment("  see me after class  ") == "see me after class"


def test_only_real_feedback_is_shown_to_a_reader():
    assert is_displayable_comment(AUTOGRADE_COMMENT) is False
    assert is_displayable_comment(MANUAL_COMMENT) is False
    # What the old multi-grade dialog wrote for the same purpose.
    assert is_displayable_comment("manual") is False
    assert display_comment(MANUAL_COMMENT) is None
    assert display_comment("check your loop bounds") == "check your loop bounds"
