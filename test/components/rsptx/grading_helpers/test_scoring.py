from rsptx.grading_helpers.scoring import (
    PEER_SCORE_SENTINEL,
    score_answer_values,
    score_peer_values,
)


def test_pct_correct_full_when_correct():
    assert score_answer_values("pct_correct", 10, correct=True, percent=None) == 10


def test_pct_correct_unittest_rescales_percent():
    assert score_answer_values(
        "pct_correct", 10, correct=False, percent=50, event="unittest"
    ) == 5.0


def test_pct_correct_partial_uses_percent_fraction():
    assert score_answer_values("pct_correct", 10, correct=False, percent=0.5) == 5.0


def test_pct_correct_zero_without_percent():
    assert score_answer_values("pct_correct", 10, correct=False, percent=None) == 0


def test_all_or_nothing():
    assert score_answer_values("all_or_nothing", 8, correct=True, percent=None) == 8
    assert score_answer_values("all_or_nothing", 8, correct=False, percent=None) == 0


def test_interact_and_interaction_award_full():
    assert score_answer_values("interact", 4, correct=False, percent=None) == 4
    assert score_answer_values("interaction", 4, correct=False, percent=None) == 4


def test_peer_questions_return_sentinel():
    assert score_answer_values("peer", 5, correct=True, percent=None) == PEER_SCORE_SENTINEL
    assert (
        score_answer_values("peer_chat", 5, correct=True, percent=None)
        == PEER_SCORE_SENTINEL
    )


def test_unknown_policy_scores_zero():
    assert score_answer_values("mystery", 5, correct=True, percent=None) == 0


def test_peer_chat_awards_full_for_both_votes_and_message():
    assert score_peer_values("peer_chat", 9, True, True, True) == 9.0


def test_peer_chat_partial_for_votes_only():
    assert score_peer_values("peer_chat", 9, True, True, False) == 6.0


def test_peer_full_credit_for_both_votes():
    assert score_peer_values("peer", 10, True, True, False) == 10.0


def test_peer_half_credit_for_single_vote():
    assert score_peer_values("peer", 10, True, False, False) == 5.0


def test_peer_caps_at_full_credit():
    assert score_peer_values("peer", 10, True, True, True) == 10.0


def test_peer_zero_without_activity():
    assert score_peer_values("peer", 10, False, False, False) == 0.0
