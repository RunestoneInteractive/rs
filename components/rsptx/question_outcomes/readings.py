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
from rsptx.question_outcomes.core import student_filter

READING_STATES = ["completed", "in_progress", "not_started"]

READING_LABELS = {
    "completed": "Completed",
    "in_progress": "In progress",
    "not_started": "Not started",
}


def page_url_suffix(origin: Optional[str], chapter: str, subchapter: str) -> str:
    """How a view of this page ends in ``useinfo.div_id``.

    A PreTeXt book serves each page as ``<subchapter>.html``; a Sphinx book
    puts it under its chapter.  Kept in step with
    ``rsptx.grading_helpers.regrade.page_url_suffix``.
    """
    if origin == "PreTeXt":
        return f"{subchapter}.html"
    return f"{chapter}/{subchapter}.html"


def _course_facts(conn: Connection, course_name: str, base_course: str):
    """The course's term start and its book's markup system."""
    row = conn.execute(
        text(
            """
            select c.term_start_date,
                (select ca.value from course_attributes ca
                    join courses b on b.id = ca.course_id
                    where b.course_name = :base_course
                        and ca.attr = 'markup_system'
                    limit 1) as origin
            from courses c where c.course_name = :course_name
            """
        ),
        {"course_name": course_name, "base_course": base_course},
    ).first()
    return (row.term_start_date, row.origin) if row else (None, None)


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
        text(
            """
            select name, base_course, chapter, subchapter from questions
            where base_course || chr(31) || chapter || chr(31) || subchapter
                    = any(:keys)
                and from_source = 'T'
                and (optional = 'F' or optional is null)
                and question_type <> 'page'
            """
        ),
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
    term_start, origin = _course_facts(conn, course_name, base_course)
    counts: Dict[Tuple[str, str], int] = {}

    activities = _page_activities(conn, readings)
    if activities:
        params = {
            "course_name": course_name,
            "div_ids": sorted(activities),
            "term_start": term_start,
        }
        join = student_filter(sids, cutoffs, params, "u")
        rows = conn.execute(
            text(
                f"""
                select distinct u.sid, u.div_id
                from useinfo as u {join}
                where u.course_id = :course_name
                    and u.div_id = any(:div_ids)
                    and u.timestamp > :term_start
                """
            ),
            params,
        ).all()
        for r in rows:
            key = (r.sid, activities[r.div_id])
            counts[key] = counts.get(key, 0) + 1

    # Opening the page is one more activity, however many times it was opened.
    suffixes = {
        page_url_suffix(origin, r.chapter, r.subchapter): r.name for r in readings
    }
    params = {
        "course_name": course_name,
        "suffixes": sorted(suffixes),
        "term_start": term_start,
    }
    join = student_filter(sids, cutoffs, params, "u")
    rows = conn.execute(
        text(
            f"""
            select distinct u.sid, s.suffix
            from useinfo as u {join}
                join unnest(cast(:suffixes as text[])) as s(suffix)
                    on right(u.div_id, length(s.suffix)) = s.suffix
            where u.course_id = :course_name
                and u.event = 'page'
                and u.timestamp > :term_start
            """
        ),
        params,
    ).all()
    for r in rows:
        key = (r.sid, suffixes[r.suffix])
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
