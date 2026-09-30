"""The shared outcome chart."""

import pandas as pd

from rsptx.dash_server_api.figures import _axis_labels, _short_label, outcome_figure
from rsptx.question_outcomes import QuestionRef, classify


def test_short_label_keeps_short_labels():
    assert _short_label("Q-3") == "Q-3"


def test_short_label_drops_a_pretext_title():
    label = "Exercise 5.9.1 Multiple-Choice, Not Randomized, One Answer."
    assert _short_label(label) == "Exercise 5.9.1"


def test_short_label_truncates_when_there_is_no_number():
    label = "a_very_long_div_id_with_no_number_in_it"
    assert _short_label(label) == "a_very_long_div_id_with…"


def test_axis_labels_are_unique():
    outcomes = pd.DataFrame(
        {"label": ["ActiveCode", "ActiveCode", "Q-1"], "name": ["ac1", "ac2", "q1"]}
    )
    assert _axis_labels(outcomes) == ["ActiveCode (ac1)", "ActiveCode (ac2)", "Q-1"]


def test_figure_has_a_trace_per_bucket_in_use():
    questions = [
        QuestionRef("a", "mchoice", "Q-1", True),
        QuestionRef("b", "poll", "Q-2", False),
    ]
    attempts = pd.DataFrame(
        [("s1", "a", True, True), ("s2", "b", None, None)],
        columns=["sid", "div_id", "first_correct", "ever_correct"],
    )
    fig = outcome_figure(classify(questions, ["s1", "s2"], attempts))
    assert [t.name for t in fig.data] == [
        "Correct on first try",
        "Tried (not auto-graded)",
        "Never tried",
    ]
    # page order reads top to bottom
    assert fig.layout.yaxis.autorange == "reversed"
