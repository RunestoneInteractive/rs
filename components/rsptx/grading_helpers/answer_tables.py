"""
The mapping from a question's ``question_type`` to where student submissions for
it are stored.

This lives in one place because both the grading interface (which reads answers)
and the batch re-grader (which rescores them) have to agree: a type missing from
the map has no answer table, so answers for it silently disappear from the
grader and are skipped by a re-grade.

The lookup tables themselves live in ``rsptx.data_types.answer_storage``, which
has no database imports, and are re-exported here.

Most types have an answer table.  Videos and polls do not -- the ``useinfo`` row
written when the student interacts *is* the submission -- so they are described
by :data:`QTYPE_TO_INTERACTION_EVENTS` instead, and every reader has to consult
both maps.  See ``INTERACTION_ONLY_EVENTS`` in ``rsptx.db.crud`` for the
logging-side half of the same idea.
"""

from typing import Optional, Set, Tuple

from rsptx.data_types.answer_storage import (  # noqa: F401  (re-exported)
    CODE_TABLE_TYPES,
    IFRAME_QUESTION_TYPES,
    QTYPE_TO_INTERACTION_EVENTS,
    QTYPE_TO_TABLE,
    UNITTEST_TABLE,
)
from rsptx.data_types.autograde import INTERACTION_ONLY_QUESTION_TYPES
from rsptx.db.models import runestone_component_dict


def answer_table_for(question_type: str) -> Tuple[Optional[object], Optional[str]]:
    """Return ``(model, table_name)`` for a question type, or ``(None, None)``
    when the type has no answer table.

    Note that ``(None, None)`` does not mean "no submissions exist" -- for the
    interaction-only types it means the submissions live in ``useinfo``. Callers
    that care about those must also check :func:`interaction_events_for`."""
    table_name = QTYPE_TO_TABLE.get(question_type)
    if not table_name:
        return None, None
    rcd = runestone_component_dict.get(table_name)
    if not rcd:
        return None, None
    return rcd.model, table_name


def interaction_events_for(question_type: str) -> Optional[Set[str]]:
    """Return the ``useinfo.event`` values that count as a submission for an
    interaction-only question type, or ``None`` for every other type.

    :param question_type: the ``Question.question_type`` to look up.
    :return: the set of useinfo events to query, or ``None`` if this type stores
        its submissions in an answer table instead.
    """
    return QTYPE_TO_INTERACTION_EVENTS.get(question_type)


def is_interaction_only(question_type: str) -> bool:
    """True when a question type records interaction rather than an answer."""
    return question_type in INTERACTION_ONLY_QUESTION_TYPES


def _format_seconds(raw: str) -> str:
    """Render a video position in seconds as ``m:ss``."""
    try:
        total = int(float(raw))
    except (TypeError, ValueError):
        return raw
    return f"{total // 60}:{total % 60:02d}"


#: How each video act reads in the grading interface.
_VIDEO_ACT_LABELS = {
    "play": "Played",
    "pause": "Paused",
    "complete": "Watched to the end",
}


def describe_interaction(event: str, act: str) -> str:
    """Render a ``useinfo`` interaction as something an instructor can read.

    Videos and polls have no answer text, so the grading interface shows what
    the student actually did -- "Played at 0:42" -- instead of a blank cell.

    :param event: the useinfo ``event``.
    :param act: the useinfo ``act``, e.g. ``play:42.5``.
    :return: a human-readable description of the interaction.
    """
    act = act or ""
    if event == "video":
        verb, _, position = act.partition(":")
        label = _VIDEO_ACT_LABELS.get(verb, verb or "Interacted")
        if position and verb in ("play", "pause"):
            return f"{label} at {_format_seconds(position)}"
        return label
    if event == "poll":
        return f"Responded {act}" if act else "Responded"
    return act or "Interacted"
