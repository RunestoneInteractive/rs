"""
Resolving ``selectquestion`` wrappers.

A ``selectquestion`` is not a question, it is a stand-in for whichever question
the student was actually served; which one that was is recorded per student in
``selected_questions``.  The two halves of a submission then end up in
different places:

* the **answer** is stored under the served question's ``div_id``,
* the **grade** is stored under the wrapper's ``div_id`` -- see
  ``rsptx.grading_helpers.core.grade_submission``.

So anything that reads answers has to resolve the wrapper first, per student,
or a selectquestion reads as "No submission" for the whole class even though it
has been graded.  See issue #1481.
"""

from typing import Dict, Iterable, NamedTuple, Optional

from rsptx.db.crud import (
    fetch_questions_by_name,
    fetch_selected_id,
    fetch_selected_ids_for_selector,
)

SELECT_QUESTION_TYPE = "selectquestion"


class ResolvedQuestion(NamedTuple):
    """The question whose answers a student's work is actually stored under."""

    #: the div_id to look up in the answer tables
    div_id: str
    #: the question_type that picks the answer table
    question_type: str
    #: the source to render in the grading preview, when it is known
    htmlsrc: Optional[str] = None
    #: True when this came from resolving a selectquestion wrapper
    from_selector: bool = False


def _self(question) -> ResolvedQuestion:
    return ResolvedQuestion(
        div_id=question.name,
        question_type=question.question_type,
        htmlsrc=getattr(question, "htmlsrc", None),
    )


def is_select_question(question) -> bool:
    """True when this assignment question is a ``selectquestion`` wrapper."""
    return question.question_type == SELECT_QUESTION_TYPE


async def resolve_for_class(
    question, sids: Optional[Iterable[str]] = None, basecourse: Optional[str] = None
) -> Dict[str, ResolvedQuestion]:
    """Resolve a ``selectquestion`` for every student who has been served one.

    :param question: the assignment's question row (needs ``name``,
        ``question_type`` and ``htmlsrc``).
    :param sids: restrict the result to these students; ``None`` means all.
    :param basecourse: prefer question rows from this book when a div_id is
        used by more than one.
    :return: ``{sid: ResolvedQuestion}``.  Empty for a question that is not a
        selectquestion -- callers fall back to the question itself, which
        :func:`resolve_one` does for them.
    """
    if not is_select_question(question):
        return {}

    selected = await fetch_selected_ids_for_selector(question.name)
    if sids is not None:
        keep = set(sids)
        selected = {sid: div for sid, div in selected.items() if sid in keep}
    if not selected:
        return {}

    real = await fetch_questions_by_name(selected.values(), basecourse=basecourse)
    resolved: Dict[str, ResolvedQuestion] = {}
    for sid, div_id in selected.items():
        q = real.get(div_id)
        resolved[sid] = ResolvedQuestion(
            div_id=div_id,
            # An unknown div_id still has answers worth showing; assume it
            # behaves like the wrapper rather than dropping the student.
            question_type=q.question_type if q else question.question_type,
            htmlsrc=q.htmlsrc if q else None,
            from_selector=True,
        )
    return resolved


async def resolve_one(
    question, sid: str, basecourse: Optional[str] = None
) -> ResolvedQuestion:
    """Resolve a ``selectquestion`` for a single student.

    Falls back to the question itself when it is not a selectquestion, or when
    the student has never been served one.
    """
    if not is_select_question(question):
        return _self(question)

    div_id = await fetch_selected_id(sid, question.name)
    if not div_id:
        return _self(question)

    real = await fetch_questions_by_name([div_id], basecourse=basecourse)
    q = real.get(div_id)
    return ResolvedQuestion(
        div_id=div_id,
        question_type=q.question_type if q else question.question_type,
        htmlsrc=q.htmlsrc if q else None,
        from_selector=True,
    )
