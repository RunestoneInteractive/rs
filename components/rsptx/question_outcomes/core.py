"""
How a class did on a set of questions.

For each question, every enrolled student lands in exactly one bucket:

* ``first_try`` -- their first answer was correct,
* ``later`` -- their first answer was wrong but a later one was correct,
* ``never_correct`` -- they answered but never correctly,
* ``tried`` -- they interacted with a question that has no notion of correct
  (short answer, polls, videos, activecode without unit tests),
* ``not_tried`` -- no answer at all.

The buckets add up to the class size, so a chart can stack them.

The module is split so that *which* questions are asked about is independent of
*how* they are scored.  A question-set provider (:func:`fetch_subchapter_questions`
today, an assignment provider later) returns :class:`QuestionRef` rows, and
:func:`question_outcomes` scores any list of them.  Assignments also need a
per-student cutoff (due date, late work, deadline exceptions); that is the
``cutoffs`` argument, so the scoring code does not need to know where a cutoff
came from.

Everything here is synchronous and takes a SQLAlchemy ``Connection``, so it
runs in a Dash background callback or a FastAPI worker thread alike.  It
depends only on SQLAlchemy and pandas -- not on ``rsptx.db`` -- so a service
can use it without the async database stack.
"""

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Iterable, List, Mapping, Optional, Sequence

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Connection

from rsptx.data_types.answer_storage import (
    INTERACTION_ACTS,
    QTYPE_TO_INTERACTION_EVENTS,
    QTYPE_TO_TABLE,
    TABLES_WITHOUT_CORRECT,
    UNITTEST_TABLE,
)

SELECT_QUESTION_TYPE = "selectquestion"

#: Activecode that is not autograded logs its runs to ``useinfo`` only.
CODE_RUN_EVENT = "activecode"

#: The buckets, in the order a stacked chart should draw them.
OUTCOMES = ["first_try", "later", "never_correct", "tried", "not_tried"]

#: What each bucket is called on screen.
OUTCOME_LABELS = {
    "first_try": "Correct on first try",
    "later": "Correct after retrying",
    "never_correct": "Tried, never correct",
    "tried": "Tried (not auto-graded)",
    "not_tried": "Never tried",
}


@dataclass(frozen=True)
class QuestionRef:
    """One question to report on."""

    #: the question's div_id (``questions.name``)
    name: str
    question_type: str
    #: how the question is shown to an instructor, e.g. "Q-3" or "Checkpoint 2.3.1"
    label: str
    #: False when there is no correct answer to measure, only whether a student
    #: interacted
    graded: bool


# Question-set providers
# ======================
def reportable_types() -> set:
    """Question types this module knows how to score."""
    return (
        set(QTYPE_TO_TABLE) | set(QTYPE_TO_INTERACTION_EVENTS) | {SELECT_QUESTION_TYPE}
    )


def is_graded(question_type: str, autograde: Optional[str]) -> bool:
    """True when answers to this question are marked correct or incorrect.

    Activecode is only graded when it has unit tests, which the build records as
    ``autograde = 'unittest'``; without them it logs runs but never a verdict.
    A selectquestion is treated as graded since its pool is almost always
    gradable questions; a student served an ungraded one counts as ``tried``.
    """
    if question_type == SELECT_QUESTION_TYPE:
        return True
    if question_type in QTYPE_TO_INTERACTION_EVENTS:
        return False
    table = QTYPE_TO_TABLE.get(question_type)
    if table is None or table in TABLES_WITHOUT_CORRECT:
        return False
    if table == UNITTEST_TABLE:
        return autograde == "unittest"
    return True


def _number_key(qnumber: Optional[str]) -> tuple:
    """Sort key that puts "Q-2" before "Q-10" and "2.3.9" before "2.3.10"."""
    return tuple(int(n) for n in re.findall(r"\d+", qnumber or ""))


def fetch_chapters(conn: Connection, base_course: str) -> List[dict]:
    """Chapters of a book as ``[{label, value}]`` dropdown options, in book order."""
    rows = conn.execute(
        text(
            """
            select chapter_name, chapter_label
            from chapters
            where course_id = :base_course and chapter_num < 999
            order by chapter_num
            """
        ),
        {"base_course": base_course},
    )
    return [{"label": r.chapter_name, "value": r.chapter_label} for r in rows]


def fetch_subchapters(conn: Connection, base_course: str, chapter: str) -> List[dict]:
    """Subchapters of one chapter as ``[{label, value}]`` dropdown options."""
    rows = conn.execute(
        text(
            """
            select sub_chapter_name, sub_chapter_label
            from sub_chapters
                join chapters on chapters.id = sub_chapters.chapter_id
            where chapters.course_id = :base_course
                and chapters.chapter_label = :chapter
            order by sub_chapter_num
            """
        ),
        {"base_course": base_course, "chapter": chapter},
    )
    return [{"label": r.sub_chapter_name, "value": r.sub_chapter_label} for r in rows]


def fetch_subchapter_questions(
    conn: Connection, base_course: str, chapter: str, subchapter: str
) -> List[QuestionRef]:
    """The questions that appear on one page of a book, in page order.

    Only questions that came from the book source are included; instructor-
    written questions are filed under a chapter but do not appear on its pages.
    """
    rows = conn.execute(
        text(
            """
            select id, name, question_type, qnumber, autograde
            from questions
            where base_course = :base_course
                and chapter = :chapter
                and subchapter = :subchapter
                and from_source = 'T'
                and question_type = any(:types)
            """
        ),
        {
            "base_course": base_course,
            "chapter": chapter,
            "subchapter": subchapter,
            "types": sorted(reportable_types()),
        },
    ).all()
    # questions has no page-position column. qnumber follows page order when
    # the book numbers its questions; the id (insertion order at build time)
    # breaks ties and orders unnumbered questions.
    rows.sort(key=lambda r: (_number_key(r.qnumber), r.id))
    return [
        QuestionRef(
            name=r.name,
            question_type=r.question_type,
            label=r.qnumber or r.name,
            graded=is_graded(r.question_type, r.autograde),
        )
        for r in rows
    ]


def fetch_roster(conn: Connection, course_name: str) -> List[str]:
    """Usernames of the students enrolled in a course; instructors are left out."""
    rows = conn.execute(
        text(
            """
            select auth_user.username
            from user_courses
                join auth_user on auth_user.id = user_courses.user_id
                join courses on courses.id = user_courses.course_id
            where courses.course_name = :course_name
                and not exists (
                    select 1 from course_instructor
                    where course_instructor.course = courses.id
                        and course_instructor.instructor = auth_user.id
                )
            """
        ),
        {"course_name": course_name},
    )
    return sorted({r.username for r in rows})


# Fetching attempts
# =================
# Each fetcher returns one row per (sid, div_id) the student touched, with
# ``first_correct`` and ``ever_correct`` (None when the source has no notion of
# correct). The reduction happens in PostgreSQL so only one row per student per
# question comes back, however many times they answered.
#
# ``cutoffs`` limits each student's answers to those at or before their own
# cutoff. It is applied by joining against an unnested (sid, cutoff) array, so
# a student whose cutoff is NULL keeps every answer.


def _student_filter(sids: Sequence[str], cutoffs, params: dict, alias: str) -> str:
    """Join clause restricting ``alias`` to the roster and, optionally, cutoffs."""
    params["cut_sids"] = list(sids)
    if cutoffs is None:
        return (
            f"join unnest(cast(:cut_sids as text[])) as c(sid) on c.sid = {alias}.sid"
        )
    params["cut_times"] = [cutoffs.get(sid) for sid in sids]
    return (
        "join unnest(cast(:cut_sids as text[]), cast(:cut_times as timestamp[]))"
        f" as c(sid, cutoff) on c.sid = {alias}.sid"
        f" and (c.cutoff is null or {alias}.timestamp <= c.cutoff)"
    )


def _fetch_from_answer_table(
    conn: Connection,
    table: str,
    course_name: str,
    div_ids: Iterable[str],
    sids: Sequence[str],
    cutoffs,
) -> pd.DataFrame:
    # ``table`` comes from QTYPE_TO_TABLE, never from the request, so it is
    # safe to interpolate.
    params = {"course_name": course_name, "div_ids": sorted(div_ids)}
    join = _student_filter(sids, cutoffs, params, "a")
    if table in TABLES_WITHOUT_CORRECT:
        verdicts = "null::boolean as first_correct, null::boolean as ever_correct"
    else:
        verdicts = (
            "(array_agg(a.correct = 'T' order by a.timestamp, a.id))[1]"
            " as first_correct, bool_or(a.correct = 'T') as ever_correct"
        )
    sql = f"""
        select a.sid, a.div_id, {verdicts}
        from {table} as a {join}
        where a.course_name = :course_name and a.div_id = any(:div_ids)
        group by a.sid, a.div_id
    """
    return pd.DataFrame(conn.execute(text(sql), params).mappings().all())


def _fetch_from_useinfo(
    conn: Connection,
    course_name: str,
    div_ids: Iterable[str],
    events: Iterable[str],
    sids: Sequence[str],
    cutoffs,
) -> pd.DataFrame:
    """Students who interacted with ungraded questions logged only in useinfo."""
    params = {
        "course_name": course_name,
        "div_ids": sorted(div_ids),
        "events": sorted(events),
    }
    join = _student_filter(sids, cutoffs, params, "u")
    # A video's page load logs a "ready" act, which is not an interaction; only
    # the acts listed in INTERACTION_ACTS count for the events that restrict them.
    act_clauses = []
    for i, (event, acts) in enumerate(sorted(INTERACTION_ACTS.items())):
        if acts is not None and event in params["events"]:
            params[f"ev{i}"] = event
            params[f"acts{i}"] = sorted(acts)
            act_clauses.append(
                f"(u.event <> :ev{i} or split_part(u.act, ':', 1) = any(:acts{i}))"
            )
    acts = "".join(f" and {c}" for c in act_clauses)
    sql = f"""
        select distinct u.sid, u.div_id,
            null::boolean as first_correct, null::boolean as ever_correct
        from useinfo as u {join}
        where u.course_id = :course_name
            and u.div_id = any(:div_ids)
            and u.event = any(:events){acts}
    """
    return pd.DataFrame(conn.execute(text(sql), params).mappings().all())


def _resolve_select_questions(
    conn: Connection,
    base_course: str,
    selectors: Sequence[QuestionRef],
    sids: Sequence[str],
) -> Dict[str, Dict[str, QuestionRef]]:
    """``{selector name: {sid: the question that student was served}}``.

    A selectquestion is a stand-in: each student is served one question from a
    pool, and their answers are stored under *that* question's div_id.  See
    ``rsptx.grading_helpers.select_questions``.
    """
    if not selectors or not sids:
        return {}
    selected = conn.execute(
        text(
            """
            select selector_id, sid, selected_id
            from selected_questions
            where selector_id = any(:names) and sid = any(:sids)
            """
        ),
        {"names": [q.name for q in selectors], "sids": list(sids)},
    ).all()
    if not selected:
        return {}
    # A div_id can exist in more than one book; prefer this course's own. The
    # dict below keeps the last row per name, so the preferred rows sort last.
    served_rows = conn.execute(
        text(
            """
            select name, question_type, autograde
            from questions
            where name = any(:names)
            order by (base_course = :base_course) asc
            """
        ),
        {
            "names": sorted({s.selected_id for s in selected}),
            "base_course": base_course,
        },
    ).all()
    served = {
        r.name: QuestionRef(
            name=r.name,
            question_type=r.question_type,
            label=r.name,
            graded=is_graded(r.question_type, r.autograde),
        )
        for r in served_rows
    }
    resolved: Dict[str, Dict[str, QuestionRef]] = {}
    for s in selected:
        if s.selected_id in served:
            resolved.setdefault(s.selector_id, {})[s.sid] = served[s.selected_id]
    return resolved


def fetch_attempts(
    conn: Connection,
    course_name: str,
    base_course: str,
    questions: Sequence[QuestionRef],
    sids: Sequence[str],
    cutoffs: Optional[Mapping[str, Optional[datetime]]] = None,
) -> pd.DataFrame:
    """One row per (sid, question) a student attempted.

    Columns: ``sid``, ``div_id`` (the reported question's name -- for a
    selectquestion, the selector, not the question served), ``first_correct``
    and ``ever_correct``.

    :param cutoffs: ``{sid: latest counted answer time}`` in naive UTC, like
        the answer tables. ``None`` counts every answer; a student missing from
        the mapping, or mapped to ``None``, also has no cutoff.
    """
    columns = ["sid", "div_id", "first_correct", "ever_correct"]
    if not questions or not sids:
        return pd.DataFrame(columns=columns)

    selectors = [q for q in questions if q.question_type == SELECT_QUESTION_TYPE]
    resolved = _resolve_select_questions(conn, base_course, selectors, sids)
    # Every question whose answers need fetching, served questions included.
    targets = {q.name: q for q in questions if q.question_type != SELECT_QUESTION_TYPE}
    for by_sid in resolved.values():
        for served in by_sid.values():
            targets.setdefault(served.name, served)

    by_table: Dict[str, set] = {}
    by_events: Dict[frozenset, set] = {}
    for q in targets.values():
        if q.question_type in QTYPE_TO_INTERACTION_EVENTS:
            events = frozenset(QTYPE_TO_INTERACTION_EVENTS[q.question_type])
            by_events.setdefault(events, set()).add(q.name)
        elif QTYPE_TO_TABLE.get(q.question_type) == UNITTEST_TABLE and not q.graded:
            by_events.setdefault(frozenset({CODE_RUN_EVENT}), set()).add(q.name)
        elif q.question_type in QTYPE_TO_TABLE:
            by_table.setdefault(QTYPE_TO_TABLE[q.question_type], set()).add(q.name)

    frames = [
        _fetch_from_answer_table(conn, table, course_name, div_ids, sids, cutoffs)
        for table, div_ids in sorted(by_table.items())
    ] + [
        _fetch_from_useinfo(conn, course_name, div_ids, events, sids, cutoffs)
        for events, div_ids in sorted(by_events.items(), key=lambda kv: sorted(kv[0]))
    ]
    frames = [f for f in frames if not f.empty]
    if not frames:
        return pd.DataFrame(columns=columns)
    attempts = pd.concat(frames, ignore_index=True)

    if resolved:
        # Answers to a served question count toward the selector, but only for
        # the student who was served it -- another student may have met the
        # same question directly on its own page.
        served_to = pd.DataFrame(
            [
                {"sid": sid, "div_id": q.name, "selector": selector}
                for selector, by_sid in resolved.items()
                for sid, q in by_sid.items()
            ]
        )
        via_selector = attempts.merge(served_to, on=["sid", "div_id"])
        via_selector["div_id"] = via_selector.pop("selector")
        direct_names = {q.name for q in questions}
        attempts = pd.concat(
            [attempts[attempts.div_id.isin(direct_names)], via_selector],
            ignore_index=True,
        )

    return attempts[columns]


# Scoring
# =======
def _truthy(value) -> bool:
    """True for a real true value; False for false, None and NaN alike.

    After ``pd.concat`` a boolean column may hold numpy bools or NaN, so
    ``is True`` is not safe here.
    """
    return not pd.isna(value) and bool(value)


def classify(
    questions: Sequence[QuestionRef], roster: Sequence[str], attempts: pd.DataFrame
) -> pd.DataFrame:
    """Count the students in each outcome bucket for each question.

    Pure function of its inputs, so it can be tested without a database.

    :param attempts: as returned by :func:`fetch_attempts`.
    :return: one row per question, in the order given, with ``name``,
        ``label``, ``question_type``, ``graded``, a column per bucket in
        :data:`OUTCOMES`, and ``students`` (the roster size).
    """
    roster_set = set(roster)
    # {div_id: {sid: bucket}}. A student can appear more than once when a
    # question is reachable two ways; the best outcome wins.
    rank = {b: i for i, b in enumerate(OUTCOMES)}
    buckets: Dict[str, Dict[str, str]] = {}
    for row in attempts.itertuples(index=False):
        if row.sid not in roster_set:
            continue
        if pd.isna(row.ever_correct):
            # No verdict: an ungraded question, or a selectquestion that served
            # this student an ungraded one. An attempt, not a wrong answer.
            bucket = "tried"
        elif _truthy(row.first_correct):
            bucket = "first_try"
        elif _truthy(row.ever_correct):
            bucket = "later"
        else:
            bucket = "never_correct"
        per_q = buckets.setdefault(row.div_id, {})
        if row.sid not in per_q or rank[bucket] < rank[per_q[row.sid]]:
            per_q[row.sid] = bucket

    rows = []
    for q in questions:
        per_student = buckets.get(q.name, {})
        counts = dict.fromkeys(OUTCOMES, 0)
        for bucket in per_student.values():
            counts[bucket] += 1
        counts["not_tried"] = len(roster_set) - len(per_student)
        rows.append(
            {
                "name": q.name,
                "label": q.label,
                "question_type": q.question_type,
                "graded": q.graded,
                **counts,
                "students": len(roster_set),
            }
        )
    return pd.DataFrame(
        rows,
        columns=["name", "label", "question_type", "graded", *OUTCOMES, "students"],
    )


def question_outcomes(
    conn: Connection,
    course_name: str,
    base_course: str,
    questions: Sequence[QuestionRef],
    cutoffs: Optional[Mapping[str, Optional[datetime]]] = None,
) -> pd.DataFrame:
    """Fetch and score a class's attempts at ``questions``; see :func:`classify`."""
    roster = fetch_roster(conn, course_name)
    attempts = fetch_attempts(
        conn, course_name, base_course, questions, roster, cutoffs
    )
    return classify(questions, roster, attempts)
