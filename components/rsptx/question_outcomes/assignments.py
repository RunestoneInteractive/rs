"""
The questions and readings of an assignment, and the cutoff for each student.

An assignment has two kinds of parts.  Exercises are ordinary questions, scored
by :func:`rsptx.question_outcomes.core.question_outcomes`.  Readings are whole
pages of the book, scored by how many of the page's activities a student did;
see :mod:`rsptx.question_outcomes.readings`.

What counts toward either depends on the assignment's late-work policy.  When
the instructor enforces the due date (``assignments.enforce_due``), only work
up to the due date counts -- pushed back for a student by the number of days in
their deadline exception, if they have one.  When it is not enforced, late work
is allowed and everything counts.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.engine import Connection

from rsptx.question_outcomes.core import QuestionRef, is_graded, reportable_types


@dataclass(frozen=True)
class AssignmentInfo:
    id: int
    name: str
    #: naive UTC, like the answer tables
    duedate: Optional[datetime]
    #: False means late work is allowed
    enforce_due: bool


@dataclass(frozen=True)
class ReadingRef:
    """One page of the book assigned as reading."""

    #: the page's question name, "<chapter>/<subchapter>"
    name: str
    chapter: str
    subchapter: str
    #: the page's title, for display
    label: str
    base_course: str
    #: activities to do, the page itself included, for the reading to count
    activities_required: int


def fetch_assignments(conn: Connection, course_id: int) -> List[dict]:
    """A course's assignments as ``[{label, value}]`` dropdown options, by due date."""
    rows = conn.execute(
        text(
            """
            select id, name from assignments
            where course = :course_id
            order by duedate, name
            """
        ),
        {"course_id": course_id},
    )
    return [{"label": r.name, "value": r.id} for r in rows]


def fetch_assignment(
    conn: Connection, course_id: int, assignment_id: int
) -> Optional[AssignmentInfo]:
    """One assignment, or None if it is not in this course.

    Always pass the course the request is for: this is the check that stops an
    instructor from reading another course's assignment by id.
    """
    row = conn.execute(
        text(
            """
            select id, name, duedate, enforce_due from assignments
            where id = :assignment_id and course = :course_id
            """
        ),
        {"assignment_id": assignment_id, "course_id": course_id},
    ).first()
    if row is None:
        return None
    return AssignmentInfo(
        id=row.id,
        name=row.name,
        duedate=row.duedate,
        enforce_due=row.enforce_due == "T",
    )


def fetch_assignment_parts(
    conn: Connection, assignment_id: int
) -> Tuple[List[QuestionRef], List[ReadingRef]]:
    """The exercises and the readings of an assignment, each in assignment order.

    A part is a reading when it is marked as one or is a whole page; the
    assignment builder does both.  Exercises of a type this report cannot score
    are left out rather than shown as never tried.
    """
    rows = conn.execute(
        text(
            """
            select q.name, q.question_type, q.qnumber, q.autograde, q.chapter,
                q.subchapter, q.base_course, aq.reading_assignment,
                aq.activities_required, sc.sub_chapter_name
            from assignment_questions aq
                join questions q on q.id = aq.question_id
                left join chapters c
                    on c.course_id = q.base_course and c.chapter_label = q.chapter
                left join sub_chapters sc
                    on sc.chapter_id = c.id and sc.sub_chapter_label = q.subchapter
            where aq.assignment_id = :assignment_id
            order by aq.sorting_priority, aq.id
            """
        ),
        {"assignment_id": assignment_id},
    ).all()
    types = reportable_types()
    exercises, readings = [], []
    for r in rows:
        if r.reading_assignment == "T" or r.question_type == "page":
            readings.append(
                ReadingRef(
                    name=r.name,
                    chapter=r.chapter,
                    subchapter=r.subchapter,
                    label=r.sub_chapter_name or r.name,
                    base_course=r.base_course,
                    activities_required=r.activities_required or 0,
                )
            )
        elif r.question_type in types:
            exercises.append(
                QuestionRef(
                    name=r.name,
                    question_type=r.question_type,
                    label=r.qnumber or r.name,
                    graded=is_graded(r.question_type, r.autograde),
                )
            )
    return exercises, readings


def assignment_cutoffs(
    conn: Connection,
    course_id: int,
    assignment: AssignmentInfo,
    sids: List[str],
) -> Tuple[Optional[Dict[str, Optional[datetime]]], int]:
    """Each student's cutoff for an assignment, and how many have an extension.

    :return: ``(cutoffs, extended)``. ``cutoffs`` is None when late work is
        allowed -- nothing is cut off -- and otherwise maps every student to
        the due date plus their extension. ``extended`` counts the students
        whose cutoff was pushed back.

    A deadline exception names either one assignment or, with no assignment,
    every assignment for that student; one for this assignment wins over one
    for all of them.  The newest row wins within each kind, as it does in the
    accommodations editor.
    """
    if not assignment.enforce_due or assignment.duedate is None:
        return None, 0
    rows = conn.execute(
        text(
            """
            select sid, assignment_id, duedate from deadline_exceptions
            where course_id = :course_id
                and (assignment_id = :assignment_id or assignment_id is null)
                and duedate is not null
            order by id
            """
        ),
        {"course_id": course_id, "assignment_id": assignment.id},
    ).all()
    everything: Dict[str, int] = {}
    this_one: Dict[str, int] = {}
    for r in rows:
        target = this_one if r.assignment_id is not None else everything
        target[r.sid] = r.duedate  # later rows overwrite earlier ones
    cutoffs, extended = {}, 0
    for sid in sids:
        days = this_one.get(sid, everything.get(sid, 0)) or 0
        if days:
            extended += 1
        cutoffs[sid] = assignment.duedate + timedelta(days=days)
    return cutoffs, extended
