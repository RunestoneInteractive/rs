"""
The mapping from a question's ``question_type`` to the answer table that holds
student submissions for it.

This lives in one place because both the grading interface (which reads answers)
and the batch re-grader (which rescores them) have to agree: a type missing from
the map has no answer table, so answers for it silently disappear from the
grader and are skipped by a re-grade.
"""

from typing import Optional, Tuple

from rsptx.db.models import runestone_component_dict


#: ``question_type`` -> answer table name. Several question types share a table:
#: everything embedded in an iframe that speaks the SPLICE protocol (``splice``,
#: ``doenet`` and the builder's ``iframe`` type, which emits a
#: ``data-component="splice"`` wrapper) logs to ``splice_answers``.
QTYPE_TO_TABLE = {
    "mchoice": "mchoice_answers",
    "fillintheblank": "fitb_answers",
    "parsonsprob": "parsons_answers",
    "activecode": "unittest_answers",
    "actex": "unittest_answers",
    "shortanswer": "shortanswer_answers",
    "clickablearea": "clickablearea_answers",
    "dragndrop": "dragndrop_answers",
    "codelens": "codelens_answers",
    "matching": "matching_answers",
    "webwork": "webwork_answers",
    "hparsons": "microparsons_answers",
    "microparsons": "microparsons_answers",
    "splice": "splice_answers",
    "doenet": "splice_answers",
    "iframe": "splice_answers",
}

#: Question types whose work is also (or only) kept in the ``code`` table.
CODE_TABLE_TYPES = {"activecode", "actex", "codelens"}

#: Question types rendered as a third-party activity inside an iframe. Their
#: stored "answer" is an opaque provider state blob rather than something a
#: human can read, so the grader shows the activity itself instead of the text.
IFRAME_QUESTION_TYPES = {"splice", "doenet", "iframe"}

UNITTEST_TABLE = "unittest_answers"


def answer_table_for(question_type: str) -> Tuple[Optional[object], Optional[str]]:
    """Return ``(model, table_name)`` for a question type, or ``(None, None)``
    when the type has no answer table."""
    table_name = QTYPE_TO_TABLE.get(question_type)
    if not table_name:
        return None, None
    rcd = runestone_component_dict.get(table_name)
    if not rcd:
        return None, None
    return rcd.model, table_name
