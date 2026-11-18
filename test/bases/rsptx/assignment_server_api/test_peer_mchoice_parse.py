"""
Unit tests for ``parse_mchoice_htmlsrc``.

Options and their feedback are sibling ``<li>`` elements, so the pairing is
positional: each feedback belongs to the answer before it. If that slips,
nothing errors -- the LLM peer just gets one option's explanation while the
student picked another, and aims at the wrong misconception.
"""

from rsptx.assignment_server_api.routers.peer import parse_mchoice_htmlsrc

ANSWER = '<li data-component="answer" {attrs}id="q_opt_{i}">{text}</li>'
FEEDBACK = '<li data-component="feedback">{text}</li>'


def build(*parts, stem="<p>Q-1: what prints?</p>"):
    return f'<div><ul data-component="multiplechoice" id="q">{stem}{"".join(parts)}</ul></div>'


def answer(i, text, correct=False):
    return ANSWER.format(attrs="data-correct='yes' " if correct else "", i=i, text=text)


def test_each_feedback_belongs_to_the_answer_before_it():
    html = build(
        answer(0, "x = f1()", correct=True),
        FEEDBACK.format(text="Correct! f1 returns 5."),
        answer(1, "x = f2()"),
        FEEDBACK.format(text="Try again. f2 only prints."),
    )
    _stem, choices, correct, feedback = parse_mchoice_htmlsrc(html)

    assert choices == ["A. x = f1()", "B. x = f2()"]
    assert correct == ["A"]
    assert feedback == {
        "A": "Correct! f1 returns 5.",
        "B": "Try again. f2 only prints.",
    }


def test_an_option_without_feedback_does_not_borrow_the_next_one():
    html = build(
        answer(0, "first"),
        answer(1, "second", correct=True),
        FEEDBACK.format(text="belongs to B"),
    )
    _stem, _choices, correct, feedback = parse_mchoice_htmlsrc(html)

    assert correct == ["B"]
    assert feedback == {"B": "belongs to B"}


def test_feedback_before_any_answer_is_ignored():
    # A stray feedback element must not become option A's explanation.
    html = build(
        FEEDBACK.format(text="orphan"),
        answer(0, "first"),
        FEEDBACK.format(text="belongs to A"),
    )
    _stem, _choices, _correct, feedback = parse_mchoice_htmlsrc(html)

    assert feedback == {"A": "belongs to A"}
