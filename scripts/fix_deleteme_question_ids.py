#!/usr/bin/env python
"""Repoint a course's assignment questions away from ``*_deleteme`` questions.

Some assignments carry ``assignment_questions`` rows whose ``question_id``
points at a question whose ``name`` ends in ``_deleteme``.  The intended
question is the one with the same name minus that suffix.  This script finds
those rows for the assignments of a single course and rewrites their
``question_id`` to the id of the surviving question.

The replacement is looked up by ``(name, base_course)``, which is unique in the
``questions`` table.  The ``_deleteme`` question's own base course is tried
first, then the course's base course.  Rows whose replacement cannot be found
(or where the assignment already contains the replacement question) are
reported and left alone.

It is a dry run unless ``--apply`` is given.

    uv run python scripts/fix_deleteme_question_ids.py --course ac-single
    uv run python scripts/fix_deleteme_question_ids.py --course ac-single --apply

Only ``assignment_questions`` is touched; question rows, grades and answer
tables are left as they are.

The database is taken from ``--dburl``, else from the usual Runestone settings
(``SERVER_CONFIG`` picking between ``DBURL``/``DEV_DBURL``/``TEST_DBURL``).
"""

import argparse
import sys
from typing import Dict, List, Optional, Tuple

from sqlalchemy import create_engine, text


def resolve_dburl(explicit: Optional[str]) -> str:
    if explicit:
        return explicit
    try:
        from rsptx.configuration import settings
    except ImportError:
        sys.exit(
            "Could not import rsptx.configuration; pass --dburl explicitly "
            "(e.g. --dburl postgresql://user:pw@host/dbname)."
        )
    url = settings._sync_database_url
    if not url:
        sys.exit("No database URL configured; pass --dburl explicitly.")
    return url


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--course",
        default="ac-single",
        help="course_name whose assignments are fixed (default: ac-single)",
    )
    parser.add_argument(
        "--suffix",
        default="_deleteme",
        help="question name suffix to strip (default: _deleteme)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="write the new question_ids; without this the script only reports",
    )
    parser.add_argument("--dburl", help="database URL (default: Runestone settings)")
    args = parser.parse_args()

    suffix = args.suffix
    engine = create_engine(resolve_dburl(args.dburl))

    with engine.connect() as conn:
        course = conn.execute(
            text(
                "select id, course_name, base_course from courses "
                "where course_name = :course"
            ),
            {"course": args.course},
        ).one_or_none()
        if course is None:
            sys.exit(f"No course named {args.course!r}.")

        rows = conn.execute(
            text(
                """
                select aq.id           as aq_id,
                       aq.assignment_id,
                       a.name          as assignment_name,
                       q.id            as old_id,
                       q.name          as old_name,
                       q.base_course   as old_base_course
                  from assignment_questions aq
                  join assignments a on a.id = aq.assignment_id
                  join questions   q on q.id = aq.question_id
                 where a.course = :course_id
                 order by a.name, aq.sorting_priority, aq.id
                """
            ),
            {"course_id": course.id},
        ).fetchall()

        stale = [r for r in rows if r.old_name.endswith(suffix)]

        # Which questions does each assignment already carry?  Repointing a row
        # onto a question the assignment already has would duplicate it.
        existing: Dict[int, set] = {}
        for r in rows:
            existing.setdefault(r.assignment_id, set()).add(r.old_id)

        # Resolve the replacements.  (name, base_course) is unique, so each
        # lookup yields at most one row.
        updates: List[Tuple[int, int, int, str, str]] = []
        unresolved: List[Tuple[str, str, str]] = []
        conflicts: List[Tuple[str, str, int]] = []
        for r in stale:
            target_name = r.old_name[: -len(suffix)]
            new_id = None
            for base_course in (r.old_base_course, course.base_course):
                new_id = conn.execute(
                    text(
                        "select id from questions "
                        "where name = :name and base_course = :base_course"
                    ),
                    {"name": target_name, "base_course": base_course},
                ).scalar()
                if new_id is not None:
                    break
            if new_id is None:
                unresolved.append((r.assignment_name, r.old_name, target_name))
                continue
            if new_id in existing[r.assignment_id]:
                conflicts.append((r.assignment_name, target_name, new_id))
                continue
            existing[r.assignment_id].add(new_id)
            updates.append((r.aq_id, r.old_id, new_id, r.assignment_name, target_name))

    print(
        f"course {course.course_name} (id {course.id}, base course "
        f"{course.base_course}): {len(rows)} assignment question(s), "
        f"{len(stale)} pointing at a *{suffix} question"
    )
    for aq_id, old_id, new_id, assignment_name, target_name in updates:
        print(
            f"  aq #{aq_id:<8} {assignment_name}: {old_id} -> {new_id}  {target_name}"
        )
    if conflicts:
        print("\nskipped, the assignment already contains the replacement:")
        for assignment_name, target_name, new_id in conflicts:
            print(f"  {assignment_name}: {target_name} (#{new_id})")
    if unresolved:
        print(f"\nskipped, no question named the same without {suffix}:")
        for assignment_name, old_name, target_name in unresolved:
            print(f"  {assignment_name}: {old_name} -> {target_name} not found")

    if not updates:
        print("\nNothing to update.")
        return 0

    if not args.apply:
        print(
            f"\nDry run: {len(updates)} assignment_questions row(s) would be "
            "repointed. Re-run with --apply to write them."
        )
        return 0

    with engine.begin() as conn:
        for aq_id, _old_id, new_id, _assignment_name, _target_name in updates:
            conn.execute(
                text(
                    "update assignment_questions set question_id = :new_id "
                    "where id = :aq_id"
                ),
                {"new_id": new_id, "aq_id": aq_id},
            )
    print(f"\nRepointed {len(updates)} assignment_questions row(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
