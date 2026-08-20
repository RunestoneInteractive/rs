#!/usr/bin/env python
"""Clone questions from one base course into another, remapping chapter/subchapter.

Reads a CSV of questions to copy (the ``CopytoPreText-*.csv`` export) and, for
each row, finds the question named ``name`` in the source base course and
inserts a copy of it into the target base course.  The copy keeps every column
of the original except:

* ``id``          — a fresh one is assigned
* ``name``        — the original name with ``--prefix`` prepended
* ``base_course`` — set to ``--target``
* ``chapter``     — set to the CSV's ``newchapterid``
* ``subchapter``  — set to the CSV's ``newsubchapterid`` (the export has also
                    shipped this column as ``numsubchapterid``; either is read)

Defaults match the py4e-int -> py4eint move:

    uv run python scripts/copy_questions_to_pretext.py ~/Downloads/CopytoPreText-Aug-20-2026.csv
    uv run python scripts/copy_questions_to_pretext.py ~/Downloads/CopytoPreText-Aug-20-2026.csv --apply

It is a dry run unless ``--apply`` is given.

Rows whose source question is missing, or whose target name already exists in
the target base course, are reported and left alone.

The database is taken from ``--dburl``, else from the usual Runestone settings
(``SERVER_CONFIG`` picking between ``DBURL``/``DEV_DBURL``/``TEST_DBURL``).
"""

import argparse
import csv
import re
import sys
from typing import Dict, List, Optional, Tuple

from sqlalchemy import MetaData, Table, create_engine, select

# The chapter column is stable across exports; the subchapter one has been
# spelled both ways, so accept whichever the file actually carries.
CHAPTER_COLUMN = "newchapterid"
SUBCHAPTER_COLUMNS = ("newsubchapterid", "numsubchapterid")


def rename_in_htmlsrc(htmlsrc: str, old_name: str, new_name: str) -> Tuple[str, int]:
    """Rename every identifier reference to ``old_name`` in a question's htmlsrc.

    A question's name shows up in its htmlsrc as the component id -- quoted or
    not, ``id="foo"`` and ``id=foo`` both occur -- and as the stem of the ids
    derived from it (``foo_question``, ``foo_editor``, ``fooTraceData`` ...).
    All of those have to move, or a copy rendered on the same page as the
    original would fight it for the same DOM ids.

    So this replaces the name wherever it starts an identifier.  The lookbehind
    keeps it from matching inside a longer word, and excluding ``/`` keeps it
    off paths: a question named the same as its illustration would otherwise
    have ``src="../_images/foo.png"`` rewritten out from under it.
    """
    pattern = re.compile(r"(?<![A-Za-z0-9_/-])" + re.escape(old_name))
    return pattern.subn(new_name, htmlsrc)


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


def read_csv(path: str) -> List[Dict[str, str]]:
    # utf-8-sig: the export is written with a BOM, which would otherwise end up
    # glued to the first field name.
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        if "name" not in fieldnames:
            sys.exit(f"{path} has no 'name' column (found: {', '.join(fieldnames)}).")
        if CHAPTER_COLUMN not in fieldnames:
            sys.exit(f"{path} has no {CHAPTER_COLUMN!r} column.")
        subchapter_column = next(
            (c for c in SUBCHAPTER_COLUMNS if c in fieldnames), None
        )
        if subchapter_column is None:
            sys.exit(
                f"{path} has none of {', '.join(SUBCHAPTER_COLUMNS)} "
                "(the new subchapter id column)."
            )
        rows = []
        for line, raw in enumerate(reader, start=2):
            name = (raw.get("name") or "").strip()
            if not name:
                continue
            rows.append(
                {
                    "line": line,
                    "name": name,
                    "chapter": (raw.get(CHAPTER_COLUMN) or "").strip(),
                    "subchapter": (raw.get(subchapter_column) or "").strip(),
                }
            )
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csvfile", help="the CopytoPreText CSV export")
    parser.add_argument(
        "--source",
        default="py4e-int",
        help="base_course the questions are copied from (default: py4e-int)",
    )
    parser.add_argument(
        "--target",
        default="py4eint",
        help="base_course the copies are written to (default: py4eint)",
    )
    parser.add_argument(
        "--prefix",
        default="py4eint_2_",
        help="prepended to each copied question's name (default: py4eint_2_)",
    )
    parser.add_argument(
        "--no-rewrite-htmlsrc",
        dest="rewrite_htmlsrc",
        action="store_false",
        help="copy htmlsrc verbatim instead of renaming the component ids in it",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="write the new questions; without this the script only reports",
    )
    parser.add_argument("--dburl", help="database URL (default: Runestone settings)")
    args = parser.parse_args()

    csv_rows = read_csv(args.csvfile)
    engine = create_engine(resolve_dburl(args.dburl))

    # Reflect rather than using the ORM model so that every column actually
    # present in this database is copied, and so the Web2PyBoolean columns come
    # back as the plain strings they are stored as.
    questions = Table("questions", MetaData(), autoload_with=engine)
    copyable = [c.name for c in questions.columns if c.name != "id"]

    inserts: List[Tuple[Dict[str, str], Dict[str, object], int]] = []
    missing: List[Dict[str, str]] = []
    existing: List[Tuple[Dict[str, str], int]] = []
    duplicates: List[Dict[str, str]] = []
    unrenamed: List[Tuple[Dict[str, str], str]] = []
    seen_names = set()

    with engine.connect() as conn:
        for row in csv_rows:
            new_name = args.prefix + row["name"]
            if new_name in seen_names:
                duplicates.append(row)
                continue
            seen_names.add(new_name)

            source = conn.execute(
                select(questions).where(
                    questions.c.name == row["name"],
                    questions.c.base_course == args.source,
                )
            ).one_or_none()
            if source is None:
                missing.append(row)
                continue

            # (name, base_course) is unique, so a pre-existing copy would make
            # the insert fail; report it instead.
            clash = conn.execute(
                select(questions.c.id).where(
                    questions.c.name == new_name,
                    questions.c.base_course == args.target,
                )
            ).scalar()
            if clash is not None:
                existing.append((row, clash))
                continue

            values = {c: getattr(source, c) for c in copyable}
            values["name"] = new_name
            values["base_course"] = args.target
            values["chapter"] = row["chapter"]
            values["subchapter"] = row["subchapter"]
            # The question column holds source text we no longer let anyone
            # edit, so the copy starts out empty rather than carrying a stale
            # copy of the original's.
            if "question" in values:
                values["question"] = None

            renames = 0
            if args.rewrite_htmlsrc and values.get("htmlsrc"):
                values["htmlsrc"], renames = rename_in_htmlsrc(
                    values["htmlsrc"], row["name"], new_name
                )
                if renames == 0:
                    # The htmlsrc never mentions its own question, so there was
                    # no component id to move.  Worth surfacing rather than
                    # silently inserting a copy that still points at the
                    # original.
                    unrenamed.append((row, "htmlsrc does not mention the old name"))
            elif args.rewrite_htmlsrc:
                unrenamed.append((row, "no htmlsrc to rewrite"))
            inserts.append((row, values, renames))

    print(
        f"{args.csvfile}: {len(csv_rows)} row(s); copying {args.source} -> "
        f"{args.target} with prefix {args.prefix!r}"
    )
    for row, values, renames in inserts:
        renamed = f", {renames} id(s) renamed" if args.rewrite_htmlsrc else ""
        print(
            f"  {row['name']} -> {values['name']}  "
            f"[{values['chapter']} / {values['subchapter']}{renamed}]"
        )
    if unrenamed:
        print("\ninserted, but the component id could not be renamed:")
        for row, why in unrenamed:
            print(f"  line {row['line']}: {row['name']}: {why}")
    if existing:
        print(f"\nskipped, already present in {args.target}:")
        for row, clash in existing:
            print(f"  line {row['line']}: {args.prefix}{row['name']} (#{clash})")
    if missing:
        print(f"\nskipped, no such question in {args.source}:")
        for row in missing:
            print(f"  line {row['line']}: {row['name']}")
    if duplicates:
        print("\nskipped, the CSV names this question more than once:")
        for row in duplicates:
            print(f"  line {row['line']}: {row['name']}")

    if not inserts:
        print("\nNothing to insert.")
        return 0

    if not args.apply:
        print(
            f"\nDry run: {len(inserts)} question(s) would be inserted into "
            f"{args.target}. Re-run with --apply to write them."
        )
        return 0

    with engine.begin() as conn:
        for _row, values, _renames in inserts:
            conn.execute(questions.insert().values(**values))
    print(f"\nInserted {len(inserts)} question(s) into {args.target}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
