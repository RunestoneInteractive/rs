"""
How far a class has got with each assigned reading.

A reading is a page of the book with a number of activities to do.  This is the
same rule the reading progress bar shows the student and the re-grader scores
(``count_reading_activities`` in ``rsptx.db.crud.book``): opening the page counts
as one activity, and each distinct non-optional activity on the page the
student interacted with counts as another.  For each reading, every student is
in exactly one bucket:

* ``completed`` -- at least ``activities_required`` activities,
* ``in_progress`` -- some, but not enough,
* ``not_started`` -- none.

Like :mod:`rsptx.question_outcomes.core` this is synchronous, takes a
``Connection``, and honors per-student ``cutoffs``.
"""

from typing import Dict, List, Mapping, Optional, Sequence, Set, Tuple

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Connection

from rsptx.question_outcomes.assignments import ReadingRef
from rsptx.data_types.interactions import page_interaction_key
from rsptx.question_outcomes.core import student_filter

READING_STATES = ["completed", "in_progress", "not_started"]

READING_LABELS = {
    "completed": "Completed",
    "in_progress": "In progress",
    "not_started": "Not started",
}


def _tracker_rows(alias: str) -> str:
    """``user_interactions`` rows for the course and keys, shaped for
    ``student_filter``: its cutoff test reads ``<alias>.timestamp``, and the
    time that decides "done by the cutoff" is the first interaction.  Rows
    with no activity since the term started are left out, as the useinfo
    queries this replaced did.
    """
    return f"""
        (select ui.sid, ui.div_id, ui.first_interaction as timestamp
         from user_interactions ui
         join courses c on c.course_name = ui.course_name
         where ui.course_name = :course_name
             and ui.div_id = any(:div_ids)
             and ui.last_interaction > c.term_start_date) as {alias}
    """


def _page_activities(
    conn: Connection, readings: Sequence[ReadingRef]
) -> Dict[str, str]:
    """``{activity div_id: reading name}`` for the activities on each page.

    Only activities from the book source that are not optional count, as in
    the progress bar.
    """
    keys = sorted(
        {f"{r.base_course}\x1f{r.chapter}\x1f{r.subchapter}" for r in readings}
    )
    rows = conn.execute(
        text("""
            select name, base_course, chapter, subchapter from questions
            where base_course || chr(31) || chapter || chr(31) || subchapter
                    = any(:keys)
                and from_source = 'T'
                and (optional = 'F' or optional is null)
                and question_type <> 'page'
            """),
        {"keys": keys},
    ).all()
    by_page = {(r.base_course, r.chapter, r.subchapter): r.name for r in readings}
    return {
        row.name: by_page[(row.base_course, row.chapter, row.subchapter)]
        for row in rows
    }


def fetch_reading_activity(
    conn: Connection,
    course_name: str,
    base_course: str,
    readings: Sequence[ReadingRef],
    sids: Sequence[str],
    cutoffs: Optional[Mapping] = None,
) -> Dict[Tuple[str, str], int]:
    """``{(sid, reading name): activities done}``, the page view included.

    Pairs with nothing done are left out.
    """
    if not readings or not sids:
        return {}
    counts: Dict[Tuple[str, str], int] = {}

    # Each activity touched counts once; opening the page is one more,
    # however many times it was opened.  Both are rows in user_interactions,
    # the page view under its page_interaction_key.
    reading_of = _page_activities(conn, readings)
    reading_of.update(
        {page_interaction_key(r.chapter, r.subchapter): r.name for r in readings}
    )
    params = {"course_name": course_name, "div_ids": sorted(reading_of)}
    join = student_filter(sids, cutoffs, params, "u")
    rows = conn.execute(
        text(f"select distinct u.sid, u.div_id from {_tracker_rows('u')} {join}"),
        params,
    ).all()
    for r in rows:
        key = (r.sid, reading_of[r.div_id])
        counts[key] = counts.get(key, 0) + 1
    return counts


def classify_readings(
    readings: Sequence[ReadingRef],
    roster: Sequence[str],
    activity: Mapping[Tuple[str, str], int],
) -> pd.DataFrame:
    """Count the students in each state for each reading.

    Pure function of its inputs.

    :return: one row per reading, in the order given, with ``name``,
        ``label``, ``required``, a column per state in :data:`READING_STATES`,
        and ``students``.
    """
    roster_set: Set[str] = set(roster)
    rows = []
    for r in readings:
        # A page with nothing required is done once it has been opened.
        required = max(r.activities_required, 1)
        counts = dict.fromkeys(READING_STATES, 0)
        for sid in roster_set:
            done = activity.get((sid, r.name), 0)
            if done == 0:
                counts["not_started"] += 1
            elif done >= required:
                counts["completed"] += 1
            else:
                counts["in_progress"] += 1
        rows.append(
            {
                "name": r.name,
                "label": r.label,
                "required": required,
                **counts,
                "students": len(roster_set),
            }
        )
    return pd.DataFrame(
        rows, columns=["name", "label", "required", *READING_STATES, "students"]
    )


def reading_progress(
    conn: Connection,
    course_name: str,
    base_course: str,
    readings: Sequence[ReadingRef],
    roster: List[str],
    cutoffs: Optional[Mapping] = None,
) -> pd.DataFrame:
    """Fetch and classify a class's progress on ``readings``."""
    activity = fetch_reading_activity(
        conn, course_name, base_course, readings, roster, cutoffs
    )
    return classify_readings(readings, roster, activity)
