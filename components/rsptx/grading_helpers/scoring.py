from typing import Optional, Union

from rsptx.logging import rslogger


PEER_CHAT_SENTINEL = "peer_chat"


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

    For ``peer_chat`` the score depends on whether the student sent chat
    messages, which requires a database lookup; this function returns the
    :data:`PEER_CHAT_SENTINEL` so the caller can resolve it.

    :param how_to_score: the assignment question ``autograde`` policy.
    :param max_score: the maximum points for the question.
    :param correct: whether the answer was fully correct.
    :param percent: partial-credit percentage (0-1, or 0-100 for unittest events).
    :param event: the originating event type; ``unittest`` rescales percent.
    :return: the score, or :data:`PEER_CHAT_SENTINEL` for peer_chat.
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
    elif how_to_score == "peer":
        return max_score
    elif how_to_score == "peer_chat":
        return PEER_CHAT_SENTINEL
    else:
        rslogger.debug(f"Unknown how_to_score {how_to_score}")
        return 0
