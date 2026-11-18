"""
Tests for ``classify``, the pure half of question outcome scoring.
"""

import pandas as pd

from rsptx.question_outcomes import QuestionRef, ReadingRef, classify, classify_readings

ATTEMPT_COLS = ["sid", "div_id", "first_correct", "ever_correct"]


def test_classify_with_no_attempts():
    qs = [QuestionRef("a", "mchoice", "Q-1", True)]
    df = classify(qs, ["s1", "s2"], pd.DataFrame(columns=ATTEMPT_COLS))
    assert df.iloc[0].not_tried == 2
    assert df.iloc[0].students == 2


def test_classify_best_outcome_wins_for_duplicate_rows():
    qs = [QuestionRef("a", "mchoice", "Q-1", True)]
    attempts = pd.DataFrame(
        [("s1", "a", False, False), ("s1", "a", True, True)], columns=ATTEMPT_COLS
    )
    df = classify(qs, ["s1"], attempts)
    assert df.iloc[0].first_try == 1
    assert df.iloc[0].never_correct == 0


def test_classify_ignores_students_not_on_the_roster():
    qs = [QuestionRef("a", "mchoice", "Q-1", True)]
    attempts = pd.DataFrame([("ghost", "a", True, True)], columns=ATTEMPT_COLS)
    df = classify(qs, ["s1"], attempts)
    assert df.iloc[0].first_try == 0
    assert df.iloc[0].not_tried == 1


def test_classify_readings_needs_at_least_the_page_view():
    reading = ReadingRef("p", "c", "s", "Page", "thinkcspy", activities_required=0)
    df = classify_readings([reading], ["a", "b"], {("a", "p"): 1})
    row = df.iloc[0]
    assert (row.required, row.completed, row.not_started) == (1, 1, 1)
