"""
Tests for interaction-only events -- videos and polls.

These have no answer table: the ``useinfo`` row written when the student
interacts is the whole submission, so the scorer has to recognise them
separately from the events listed in ``EVENT2TABLE``.
"""

from rsptx.data_types.autograde import (
    INTERACTION_ONLY_QUESTION_TYPES,
    AutogradeOptions,
    default_autograde_for,
)
from rsptx.data_types.question_type import QuestionType
from rsptx.db.crud import (
    EVENT2TABLE,
    INTERACTION_ONLY_EVENTS,
    is_interaction_event,
)


# ---------------------------------------------------------------------------
# is_interaction_event
# ---------------------------------------------------------------------------


def test_video_and_poll_are_interaction_only():
    assert INTERACTION_ONLY_EVENTS == {"video", "poll"}


def test_interaction_only_events_have_no_answer_table():
    """The two sets are disjoint by construction; an event in EVENT2TABLE has
    somewhere to store an answer and must not take the interaction path."""
    assert not INTERACTION_ONLY_EVENTS & set(EVENT2TABLE)


def test_video_play_counts_as_interaction():
    assert is_interaction_event("video", "play:42.5")


def test_video_pause_counts_as_interaction():
    assert is_interaction_event("video", "pause:3")


def test_video_complete_counts_as_interaction():
    assert is_interaction_event("video", "complete")


def test_video_ready_is_not_an_interaction():
    """The YouTube player fires onStateChange with unstarted/cued as soon as it
    is built, which the component logs as "ready".  Scoring that would award
    full credit for loading the page without touching the video."""
    assert not is_interaction_event("video", "ready")


def test_any_poll_act_counts_as_interaction():
    assert is_interaction_event("poll", "0")
    assert is_interaction_event("poll", "4")


def test_answer_bearing_events_are_not_interaction_events():
    assert not is_interaction_event("mChoice", "answer")
    assert not is_interaction_event("unittest", "percent:100.0:passed:2:failed:0")


def test_missing_act_is_not_an_interaction():
    assert not is_interaction_event("video", "")
    assert not is_interaction_event("video", None)


# ---------------------------------------------------------------------------
# autograde options
# ---------------------------------------------------------------------------


def _supported(option):
    return set(option.to_dict()["supported_question_types"])


def test_interaction_only_question_types():
    assert INTERACTION_ONLY_QUESTION_TYPES == {"video", "youtube", "poll"}


def test_correctness_policies_exclude_interaction_only_types():
    """pct_correct / all_or_nothing on a video silently score every student 0
    forever, because a video has no notion of a correct answer."""
    for option in (AutogradeOptions.PCT_CORRECT, AutogradeOptions.ALL_OR_NOTHING):
        assert not _supported(option) & INTERACTION_ONLY_QUESTION_TYPES


def test_interact_and_manual_still_offered_for_videos_and_polls():
    for option in (AutogradeOptions.INTERACT, AutogradeOptions.MANUAL):
        assert INTERACTION_ONLY_QUESTION_TYPES <= _supported(option)


def test_correctness_policies_still_offered_for_ordinary_questions():
    for option in (AutogradeOptions.PCT_CORRECT, AutogradeOptions.ALL_OR_NOTHING):
        assert "mchoice" in _supported(option)
        assert "fillintheblank" in _supported(option)


def test_correctness_gradable_types_is_all_types_minus_interaction_only():
    assert set(QuestionType.correctness_gradable_types()) | set(
        QuestionType.interaction_only_types()
    ) == set(QuestionType.all_types())


# ---------------------------------------------------------------------------
# default_autograde_for
# ---------------------------------------------------------------------------


def test_video_added_to_exercises_defaults_to_interact():
    assert default_autograde_for("youtube", is_reading=False) == "interact"
    assert default_autograde_for("video", is_reading=False) == "interact"
    assert default_autograde_for("poll", is_reading=False) == "interact"


def test_ordinary_question_added_to_exercises_defaults_to_pct_correct():
    assert default_autograde_for("mchoice", is_reading=False) == "pct_correct"


def test_reading_questions_still_default_to_interaction():
    assert default_autograde_for("mchoice", is_reading=True) == "interaction"
    assert default_autograde_for("youtube", is_reading=True) == "interaction"


def test_unknown_question_type_defaults_to_pct_correct():
    assert default_autograde_for(None, is_reading=False) == "pct_correct"


# ---------------------------------------------------------------------------
# question_type -> useinfo events (the grader / re-grader side)
# ---------------------------------------------------------------------------


def test_interaction_events_for_video_types():
    from rsptx.grading_helpers.answer_tables import interaction_events_for

    assert interaction_events_for("video") == {"video"}
    assert interaction_events_for("youtube") == {"video"}
    assert interaction_events_for("poll") == {"poll"}


def test_interaction_events_for_ordinary_types_is_none():
    from rsptx.grading_helpers.answer_tables import interaction_events_for

    assert interaction_events_for("mchoice") is None
    assert interaction_events_for("activecode") is None


def test_interaction_types_have_no_answer_table():
    """The two storage maps must stay disjoint: a type is either in an answer
    table or in useinfo, never both."""
    from rsptx.grading_helpers.answer_tables import (
        QTYPE_TO_INTERACTION_EVENTS,
        QTYPE_TO_TABLE,
    )

    assert not set(QTYPE_TO_INTERACTION_EVENTS) & set(QTYPE_TO_TABLE)


def test_every_interaction_only_type_maps_to_events():
    """Otherwise the re-grader silently skips it with "no_table" -- the
    original bug."""
    from rsptx.grading_helpers.answer_tables import QTYPE_TO_INTERACTION_EVENTS

    assert set(QTYPE_TO_INTERACTION_EVENTS) == INTERACTION_ONLY_QUESTION_TYPES


def test_mapped_events_are_all_recognised_by_the_logger():
    """The question_type side and the logging side have to agree, or the
    re-grader will query for an event that /bookevent never scores."""
    from rsptx.grading_helpers.answer_tables import QTYPE_TO_INTERACTION_EVENTS

    mapped = set()
    for events in QTYPE_TO_INTERACTION_EVENTS.values():
        mapped |= events
    assert mapped == INTERACTION_ONLY_EVENTS


# ---------------------------------------------------------------------------
# describe_interaction
# ---------------------------------------------------------------------------


def test_describe_video_play_and_pause_include_the_position():
    from rsptx.grading_helpers.answer_tables import describe_interaction

    assert describe_interaction("video", "play:42.5") == "Played at 0:42"
    assert describe_interaction("video", "pause:125.5") == "Paused at 2:05"
    assert describe_interaction("video", "play:0") == "Played at 0:00"


def test_describe_video_complete():
    from rsptx.grading_helpers.answer_tables import describe_interaction

    assert describe_interaction("video", "complete") == "Watched to the end"


def test_describe_poll_response():
    from rsptx.grading_helpers.answer_tables import describe_interaction

    assert describe_interaction("poll", "3") == "Responded 3"


def test_describe_handles_unparseable_position():
    from rsptx.grading_helpers.answer_tables import describe_interaction

    assert describe_interaction("video", "play:soon") == "Played at soon"
    assert describe_interaction("video", "") == "Interacted"
