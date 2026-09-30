"""
Where student submissions for each ``question_type`` are stored.

These are plain lookup tables with no database or web imports, so a service that
only reads answers (the dash server, for one) can use them without pulling in
the grading stack.  ``rsptx.grading_helpers.answer_tables`` re-exports them and
adds the model-aware helpers, and ``rsptx.db.crud`` uses
:data:`INTERACTION_ACTS` to decide which ``useinfo`` rows are real
interactions.

Most types have an answer table.  Videos and polls do not -- the ``useinfo`` row
written when the student interacts *is* the submission -- so they are described
by :data:`QTYPE_TO_INTERACTION_EVENTS` instead, and every reader has to consult
both maps.
"""

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

#: Answer tables with no ``correct`` column: a row records that the student
#: answered, never whether the answer was right.
TABLES_WITHOUT_CORRECT = {"shortanswer_answers"}

#: Question types whose work is also (or only) kept in the ``code`` table.
CODE_TABLE_TYPES = {"activecode", "actex", "codelens"}

#: Question types rendered as a third-party activity inside an iframe. Their
#: stored "answer" is an opaque provider state blob rather than something a
#: human can read, so the grader shows the activity itself instead of the text.
IFRAME_QUESTION_TYPES = {"splice", "doenet", "iframe"}

UNITTEST_TABLE = "unittest_answers"

#: ``question_type`` -> the ``useinfo.event`` values that record a student
#: interacting with it. These types have no answer table at all: the useinfo row
#: is the whole submission, so the grader and re-grader read it directly.
QTYPE_TO_INTERACTION_EVENTS = {
    "video": {"video"},
    "youtube": {"video"},
    "poll": {"poll"},
    "quizly": {"quizly"},
}

#: The acts that count as a genuine student interaction, keyed by ``useinfo``
#: event. ``None`` means every act for that event counts. Only the part of the
#: act before the first ``:`` is compared (videos log ``play:12.5``). The
#: YouTube player fires ``onStateChange`` with unstarted/cued as soon as it is
#: built, which the video component logs as ``ready``; counting that would
#: credit a student for merely loading the page, so ``ready`` is deliberately
#: absent.
INTERACTION_ACTS = {
    "video": {"play", "pause", "complete"},
    "poll": None,
    "quizly": None,
}
