from rsptx.grading_helpers.regrade import apply_threshold_score


def test_no_threshold_returns_raw_total():
    assert apply_threshold_score(7, 10, None) == 7
    assert apply_threshold_score(7, 10, 0) == 7


def test_above_threshold_awards_full_points():
    assert apply_threshold_score(9, 10, 0.8) == 10


def test_at_or_below_threshold_returns_raw_total():
    assert apply_threshold_score(8, 10, 0.8) == 8
    assert apply_threshold_score(5, 10, 0.8) == 5


def test_zero_points_is_a_no_op():
    assert apply_threshold_score(0, 0, 0.8) == 0
    assert apply_threshold_score(3, None, 0.8) == 3
