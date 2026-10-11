#!/usr/bin/env python
"""Give questions that are not from a PreTeXt source their ``question_json``.

The assignment builder can only edit a question that has a ``question_json``.
Manifest processing writes it for questions in a PreTeXt book's source
(``from_source = 'T'``), but older questions -- those from RST books, and those
that have since been removed from a book's source -- have only their
``htmlsrc``. This script converts that ``htmlsrc`` with the same converters
manifest processing uses (``rsptx.build_tools.question_json``).

Only a lossless conversion is stored, because the builder regenerates a
question's HTML from its ``question_json`` when it is copied or edited. A
question that already has a ``question_json`` (e.g. one made in the builder) is
never touched.

It is a dry run unless ``--apply`` is given.

    uv run python scripts/backfill_question_json.py                 # report only
    uv run python scripts/backfill_question_json.py --verbose       # + why not
    uv run python scripts/backfill_question_json.py --base-course thinkcspy --apply

The database is taken from ``--dburl``, else from the usual Runestone settings
(``SERVER_CONFIG`` picking between ``DBURL``/``DEV_DBURL``/``TEST_DBURL``).
"""

import argparse
import sys
from collections import Counter
from typing import Any, Dict, Optional

from sqlalchemy import JSON, bindparam, create_engine, text

from rsptx.build_tools.question_json import CONVERTERS, convert_htmlsrc


def resolve_dburl(explicit: Optional[str]) -> str:
    if explicit:
        return explicit
    from rsptx.configuration import settings

    url = settings._sync_database_url
    if not url:
        sys.exit("No database URL configured; pass --dburl explicitly.")
    return url.replace("+asyncpg", "")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="write the question_json; without this the script only reports",
    )
    parser.add_argument("--dburl", help="database URL (default: Runestone settings)")
    parser.add_argument(
        "--base-course",
        action="append",
        help="only consider questions in this base course (may be repeated)",
    )
    parser.add_argument(
        "--type",
        dest="question_type",
        action="append",
        choices=sorted(CONVERTERS),
        help="only consider questions of this type (may be repeated)",
    )
    parser.add_argument("--name", help="only consider the question with this name")
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="list each question that could not be converted, and why",
    )
    args = parser.parse_args()

    engine = create_engine(resolve_dburl(args.dburl))

    # A JSON column written with Python None holds the JSON value null rather
    # than SQL NULL; both mean the question has no question_json.
    query = (
        "select id, name, base_course, question_type, htmlsrc from questions "
        "where from_source = 'F' "
        "and (question_json is null or question_json::text = 'null') "
        "and question_type in :types"
    )
    params: Dict[str, Any] = {"types": args.question_type or sorted(CONVERTERS)}
    if args.base_course:
        query += " and base_course in :courses"
        params["courses"] = args.base_course
    if args.name:
        query += " and name = :name"
        params["name"] = args.name
    query += " order by base_course, id"
    stmt = text(query).bindparams(bindparam("types", expanding=True))
    if args.base_course:
        stmt = stmt.bindparams(bindparam("courses", expanding=True))

    examined = Counter()
    converted = Counter()
    reasons = Counter()
    updates = []
    with engine.connect() as conn:
        for row in conn.execute(stmt, params):
            conversion = convert_htmlsrc(row.question_type, row.htmlsrc)
            examined[row.question_type] += 1
            if conversion is not None and conversion.lossless:
                converted[row.question_type] += 1
                updates.append({"id": row.id, "qjson": conversion.question_json})
                continue
            losses = conversion.losses if conversion else ["no htmlsrc"]
            for loss in losses:
                reasons[row.question_type, loss] += 1
            if args.verbose:
                print(
                    f"  #{row.id} {row.name} ({row.base_course}, "
                    f"{row.question_type}): {'; '.join(losses)}"
                )

    total = sum(examined.values())
    print(f"\nquestions without question_json (from_source = 'F'): {total}")
    for qtype in sorted(examined):
        print(
            f"  {qtype:<16} {converted[qtype]:>6} of {examined[qtype]:>6} convertible"
        )
    if reasons:
        print("\nnot convertible because of:")
        for (qtype, reason), count in reasons.most_common(30):
            print(f"  {count:>6}  {qtype:<16} {reason[:90]}")

    if not updates:
        return 0
    if not args.apply:
        print(f"\nDry run: {len(updates)} questions would get a question_json.")
        print("Run again with --apply to write them.")
        return 0

    update = text(
        "update questions set question_json = :qjson where id = :id"
    ).bindparams(bindparam("qjson", type_=JSON))
    with engine.begin() as conn:
        conn.execute(update, updates)
    print(f"\nWrote question_json for {len(updates)} questions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
