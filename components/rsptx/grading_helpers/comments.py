"""Policy for the ``comment`` column of ``question_grades``.

The comment column does double duty: it holds whatever an instructor typed for
the student, and -- when nobody has typed anything -- a bookkeeping word that
records who set the score.  Every grader keys off that word: the autograder and
the batch re-grade will only touch a row they wrote themselves, so a row that
says anything else is the instructor's and is left alone.

That protection used to be impossible to get from the grading page.  The
comment box came up pre-filled with ``autograded``, so an instructor who
changed a score without also rewriting the comment saved a row that still
looked auto-graded, and the next submission or re-grade wiped the new score.
Saving a grade by hand now stamps :data:`MANUAL_COMMENT` on the row instead.
"""

from typing import Optional

#: Written by the autograder and the batch re-grade for every score they set.
AUTOGRADE_COMMENT = "autograded"

#: Stands in for a question that has no ``question_grades`` row at all.
UNGRADED_COMMENT = "ungraded"

#: Written when an instructor saves a score without words of their own. It
#: marks the row as hand graded so no grader overwrites it later.
MANUAL_COMMENT = "manually graded"

#: The words the graders write among themselves. Anything else is a real
#: comment, meant for the student.  ``manual`` is what an older version of the
#: multi-grade dialog wrote for the same purpose as MANUAL_COMMENT.
BOOKKEEPING_COMMENTS = frozenset(
    {AUTOGRADE_COMMENT, UNGRADED_COMMENT, MANUAL_COMMENT, "manual"}
)

#: Bookkeeping words that mean "no human has set this score".
_AUTOGRADER_COMMENTS = frozenset({AUTOGRADE_COMMENT, UNGRADED_COMMENT})


def _normalized(comment: Optional[str]) -> str:
    return (comment or "").strip().lower()


def is_hand_graded(comment: Optional[str]) -> bool:
    """True when a human, not a grader, last set this score.

    A blank comment is not enough to claim a human wrote it: rows predate the
    marker, so blank stays fair game for the autograder.
    """
    text = _normalized(comment)
    return bool(text) and text not in _AUTOGRADER_COMMENTS


def is_autograder_comment(comment: Optional[str]) -> bool:
    """True when the row carries a word the autograder itself wrote.

    The mirror image of :func:`is_hand_graded` for blank comments: a blank one
    is neither, so ``not is_autograder_comment()`` is the cautious test (a
    blank row is somebody's hand grade and is protected) and
    :func:`is_hand_graded` is the permissive one (a blank row may be re-scored).
    """
    return _normalized(comment) in _AUTOGRADER_COMMENTS


def is_displayable_comment(comment: Optional[str]) -> bool:
    """True when the comment is words for the student rather than bookkeeping."""
    text = _normalized(comment)
    return bool(text) and text not in BOOKKEEPING_COMMENTS


def display_comment(comment: Optional[str]) -> Optional[str]:
    """The comment to show a reader, or None when there is nothing to show."""
    return comment if is_displayable_comment(comment) else None


def instructor_comment(comment: Optional[str]) -> str:
    """What to store when an instructor saves a grade by hand.

    Their own words when they wrote any; otherwise the marker that keeps the
    autograder and the batch re-grade off the row.
    """
    text = (comment or "").strip()
    if not text or text.lower() in _AUTOGRADER_COMMENTS:
        return MANUAL_COMMENT
    return text
