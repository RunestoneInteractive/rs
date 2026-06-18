from typing import Optional, Union

from rsptx.logging import rslogger


PEER_SCORE_SENTINEL = "__peer_needs_useinfo__"


def score_answer_values(
    how_to_score: Optional[str],
    max_score: Union[int, float],
    correct: Optional[Union[bool, int]],
    percent: Optional[float],
    event: Optional[str] = None,
) -> Union[int, float, str]:
    """
    Compute the numeric score for a single answer using the authoritative
    Runestone scoring formulas. This pure helper is shared by the real-time
    scorer (``grade_submission``) and the batch re-grade service so the
    formulas are defined in exactly one place.

    Peer-instruction scoring depends on the student's ``useinfo`` activity
    (vote1, vote2 and, for ``peer_chat``, sending a message), which requires a
    database lookup; for ``peer`` and ``peer_chat`` this function returns the
    :data:`PEER_SCORE_SENTINEL` so the caller can resolve it via
    :func:`score_peer_values`.

    :param how_to_score: the assignment question ``autograde`` policy.
    :param max_score: the maximum points for the question.
    :param correct: whether the answer was fully correct.
    :param percent: partial-credit percentage (0-1, or 0-100 for unittest events).
    :param event: the originating event type; ``unittest`` rescales percent.
    :return: the score, or :data:`PEER_SCORE_SENTINEL` for peer questions.
    """
    if how_to_score == "pct_correct":
        if correct:
            return max_score
        if percent:
            if event == "unittest":
                return (percent / 100.0) * max_score
            return percent * max_score
        return 0
    elif how_to_score == "all_or_nothing":
        return max_score if correct else 0
    elif how_to_score in ("interact", "interaction"):
        return max_score
    elif how_to_score in ("peer", "peer_chat"):
        return PEER_SCORE_SENTINEL
    else:
        rslogger.debug(f"Unknown how_to_score {how_to_score}")
        return 0


def score_peer_values(
    how_to_score: Optional[str],
    max_score: Union[int, float],
    has_vote1: bool,
    has_vote2: bool,
    sent_message: bool,
) -> Union[int, float]:
    """
    Compute the peer-instruction score from a student's ``useinfo`` activity.

    Mirrors web2py's ``_score_peer_instruction``: award points for vote1,
    vote2 and (for ``peer_chat``) sending a message. ``peer_chat`` divides by
    three (both votes plus a message), while plain ``peer`` divides by two and
    caps at full credit.

    :param how_to_score: ``peer`` or ``peer_chat``.
    :param max_score: the maximum points for the question.
    :param has_vote1: whether the student cast the first vote.
    :param has_vote2: whether the student cast the second vote.
    :param sent_message: whether the student sent a chat message.
    :return: the numeric peer score.
    """
    tot = int(bool(has_vote1)) + int(bool(has_vote2)) + int(bool(sent_message))
    if how_to_score == "peer_chat":
        return (tot / 3) * max_score
    return min(1.0, tot / 2) * max_score
