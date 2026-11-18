#!/usr/bin/env python
"""Repair the stored ``htmlsrc`` of drag-n-drop questions.

The assignment builder used to render a drag-n-drop question's HTML by linking
each premise to its dropzone through the dropzone's ``for`` attribute.  That
link is one-to-one, so when several premises belonged in the same dropzone only
the first one was linked; the rest had no category that matched any dropzone
and were graded as misplaced no matter where the student dropped them.

``dndPreview.ts`` now writes an explicit ``data-category`` on every premise and
dropzone, which many premises can share.  Questions saved before that change
keep their broken ``htmlsrc`` until they are saved again in the builder, so this
script regenerates ``htmlsrc`` from ``question_json`` for the affected ones.

It is a dry run unless ``--apply`` is given.

    uv run python scripts/fix_dragndrop_htmlsrc.py            # report only
    uv run python scripts/fix_dragndrop_htmlsrc.py --verbose  # + per question
    uv run python scripts/fix_dragndrop_htmlsrc.py --apply    # write

The database is taken from ``--dburl``, else from the usual Runestone settings
(``SERVER_CONFIG`` picking between ``DBURL``/``DEV_DBURL``/``TEST_DBURL``).
"""

import argparse
import json
import re
import sys
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import create_engine, text

DEFAULT_STATEMENT = (
    "Match items from the left column with their corresponding items on the right."
)
DEFAULT_INCORRECT_FEEDBACK = "Not quite. Try again."


# -----------------------------------------------------------------------------
# A port of the assignment builder's HTML generator.  These three functions must
# stay byte-for-byte compatible with their TypeScript originals, otherwise a
# question repaired here would be rewritten the next time it is saved in the
# builder.  The originals live in:
#   bases/rsptx/assignment_server_api/assignment_builder/src/utils/sanitize.ts
#   bases/rsptx/assignment_server_api/assignment_builder/src/utils/preview/dndPreview.ts
# -----------------------------------------------------------------------------
def sanitize_id(name: str) -> str:
    """Port of ``sanitizeId``; the caller always has a name, so no fallback."""
    sanitized = re.sub(r"[^a-zA-Z0-9\-_]", "", name or "")
    if not re.match(r"^[a-zA-Z]", sanitized):
        sanitized = "id_" + sanitized
    return sanitized


def remove_p_tags(content: str) -> str:
    """Port of ``removePTags``."""
    if not content:
        return ""
    content = re.sub(r"^<p>", "", content, count=1)
    content = re.sub(r"</p>$", "", content, count=1)
    content = content.replace("<p>", "<span>")
    content = content.replace("</p>", "</span>")
    return content


def generate_dragndrop_html(
    left: List[Dict[str, Any]],
    right: List[Dict[str, Any]],
    correct_answers: List[List[str]],
    feedback: str,
    name: str,
    statement: str,
) -> str:
    """Port of ``generateDragAndDropPreview``."""
    safe_id = sanitize_id(name)
    html = ""

    used_left_items = set()
    connected_right_items = set()
    right_by_id = {item.get("id"): item for item in right}

    def category_for(right_id: str) -> str:
        return f"{safe_id}_cat_{right_id}"

    for left_item in left:
        connections = [p for p in correct_answers if p and p[0] == left_item.get("id")]
        for pair in connections:
            right_item = right_by_id.get(pair[1] if len(pair) > 1 else None)
            if right_item is None:
                continue
            drag_id = f"{safe_id}_drag_{left_item.get('id')}"
            category = category_for(right_item["id"])

            if left_item.get("id") not in used_left_items:
                html += (
                    f'<li data-subcomponent="draggable" id="{drag_id}" '
                    f'data-category="{category}">'
                    f'{remove_p_tags(left_item.get("label") or "")}</li>'
                )

            if right_item["id"] not in connected_right_items:
                html += (
                    f'<li data-subcomponent="dropzone" for="{drag_id}" '
                    f'data-category="{category}">'
                    f'{remove_p_tags(right_item.get("label") or "")}</li>'
                )
                connected_right_items.add(right_item["id"])

            used_left_items.add(left_item.get("id"))

    for left_item in left:
        if left_item.get("id") not in used_left_items:
            drag_id = f"{safe_id}_extra_{left_item.get('id')}"
            html += (
                f'\n    <li data-subcomponent="draggable" id="{drag_id}">'
                f'{remove_p_tags(left_item.get("label") or "")}</li>'
            )

    used_right_items = {p[1] for p in correct_answers if p and len(p) > 1}

    for right_item in right:
        if right_item.get("id") not in used_right_items:
            placeholder_id = f"{safe_id}_placeholder_{right_item.get('id')}"
            html += (
                f'\n    <li data-subcomponent="dropzone" for="{placeholder_id}" '
                f'data-category="{category_for(right_item.get("id"))}">'
                f'{remove_p_tags(right_item.get("label") or "")}</li>'
            )

    return (
        '\n<div class="runestone flex justify-content-center">\n'
        f'<ul data-component="dragndrop" data-question_label="{safe_id}" id="{safe_id}"'
        ' style="visibility: hidden; margin: 0 auto; text-align: center;">\n'
        f'    <span data-subcomponent="question">'
        f"{remove_p_tags(statement or DEFAULT_STATEMENT)}</span>\n"
        f'    <span data-subcomponent="feedback">'
        f"{remove_p_tags(feedback or DEFAULT_INCORRECT_FEEDBACK)}</span>\n"
        f"{html}\n"
        "</ul>   \n"
        "</div>"
    )


# -----------------------------------------------------------------------------
# Which questions are broken
# -----------------------------------------------------------------------------
def defects(
    left: List[Dict[str, Any]],
    right: List[Dict[str, Any]],
    correct_answers: List[List[str]],
) -> List[str]:
    """Name the generator bugs this question's mapping would have run into."""
    found = []
    right_ids = {item.get("id") for item in right}
    left_ids = {item.get("id") for item in left}
    pairs = [p for p in correct_answers if p and len(p) > 1]
    # Only pairs that name real items make it into the HTML.
    live = [p for p in pairs if p[0] in left_ids and p[1] in right_ids]

    per_right: Dict[str, int] = {}
    per_left: Dict[str, int] = {}
    for source, target in live:
        per_right[target] = per_right.get(target, 0) + 1
        per_left[source] = per_left.get(source, 0) + 1

    if any(count > 1 for count in per_right.values()):
        # The bug being fixed: premises after the first were graded as misplaced.
        found.append("many-premises-one-dropzone")
    if any(count > 1 for count in per_left.values()):
        # The same premise was emitted once per link, so its id was duplicated.
        found.append("premise-linked-to-several-dropzones")
    if len([item for item in right if item.get("id") not in {p[1] for p in live}]) > 1:
        # Every empty dropzone shared one placeholder id.
        found.append("multiple-empty-dropzones")
    return found


def parse_question_json(raw: Any) -> Optional[Dict[str, Any]]:
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        if not raw.strip():
            return None
        try:
            parsed = json.loads(raw)
        except ValueError:
            return None
        return parsed if isinstance(parsed, dict) else None
    return None


def looks_builder_generated(htmlsrc: str) -> bool:
    """True when the stored HTML is the builder's own output.

    PreTeXt/authored books produce their own markup; regenerating that from
    ``question_json`` would throw away whatever the author wrote.
    """
    return bool(htmlsrc) and 'data-component="dragndrop"' in htmlsrc


def evaluate(row) -> Tuple[str, Optional[str], List[str]]:
    """Return (status, new_htmlsrc, defects) for one question row."""
    question_json = parse_question_json(row.question_json)
    if question_json is None:
        return "no-question-json", None, []

    left = question_json.get("left") or []
    right = question_json.get("right") or []
    correct_answers = question_json.get("correctAnswers") or []
    if not isinstance(left, list) or not isinstance(right, list):
        return "unusable-question-json", None, []

    found = defects(left, right, correct_answers)
    if not found:
        return "ok", None, []

    if not looks_builder_generated(row.htmlsrc or ""):
        return "skipped-not-builder-html", None, found

    new_htmlsrc = generate_dragndrop_html(
        left=left,
        right=right,
        correct_answers=correct_answers,
        feedback=question_json.get("feedback") or "",
        name=row.name,
        statement=question_json.get("statement")
        or question_json.get("questionText")
        or "",
    )
    if new_htmlsrc == (row.htmlsrc or ""):
        return "already-repaired", None, found
    return "needs-repair", new_htmlsrc, found


# -----------------------------------------------------------------------------
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
        "--apply",
        action="store_true",
        help="write the repaired htmlsrc; without this the script only reports",
    )
    parser.add_argument("--dburl", help="database URL (default: Runestone settings)")
    parser.add_argument("--name", help="only consider the question with this name")
    parser.add_argument(
        "--base-course", help="only consider questions in this base course"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="list every affected question, not just the counts",
    )
    parser.add_argument(
        "--show-html",
        action="store_true",
        help="print the old and new htmlsrc for each question to be repaired",
    )
    args = parser.parse_args()

    engine = create_engine(resolve_dburl(args.dburl))

    query = (
        "select id, name, base_course, from_source, htmlsrc, question_json "
        "from questions where question_type = 'dragndrop'"
    )
    params: Dict[str, Any] = {}
    if args.name:
        query += " and name = :name"
        params["name"] = args.name
    if args.base_course:
        query += " and base_course = :base_course"
        params["base_course"] = args.base_course
    query += " order by id"

    counts: Dict[str, int] = {}
    defect_counts: Dict[str, int] = {}
    to_repair: List[Tuple[int, str, str, str, List[str]]] = []

    with engine.connect() as conn:
        rows = conn.execute(text(query), params).fetchall()
        for row in rows:
            status, new_htmlsrc, found = evaluate(row)
            counts[status] = counts.get(status, 0) + 1
            for defect in found:
                defect_counts[defect] = defect_counts.get(defect, 0) + 1
            if status == "needs-repair":
                to_repair.append(
                    (row.id, row.name, row.base_course, new_htmlsrc, found)
                )
            if args.verbose and found:
                print(
                    f"  {status:<26} #{row.id} {row.name} "
                    f"({row.base_course}, from_source={row.from_source}) "
                    f"[{', '.join(found)}]"
                )

    print(f"\ndragndrop questions examined: {len(rows)}")
    for status in sorted(counts):
        print(f"  {status:<26} {counts[status]}")
    if defect_counts:
        print("\naffected by:")
        for defect in sorted(defect_counts):
            print(f"  {defect:<36} {defect_counts[defect]}")

    if args.show_html:
        with engine.connect() as conn:
            for qid, name, _base_course, new_htmlsrc, _found in to_repair:
                old = conn.execute(
                    text("select htmlsrc from questions where id = :id"), {"id": qid}
                ).scalar()
                print(
                    f"\n===== #{qid} {name} =====\n--- old ---{old}\n--- new ---{new_htmlsrc}"
                )

    if not to_repair:
        print("\nNothing to repair.")
        return 0

    if not args.apply:
        print(
            f"\nDry run: {len(to_repair)} question(s) would have their htmlsrc "
            "regenerated. Re-run with --apply to write them."
        )
        return 0

    with engine.begin() as conn:
        for qid, name, _base_course, new_htmlsrc, _found in to_repair:
            conn.execute(
                text("update questions set htmlsrc = :htmlsrc where id = :id"),
                {"htmlsrc": new_htmlsrc, "id": qid},
            )
            print(f"repaired #{qid} {name}")
    print(f"\nRepaired {len(to_repair)} question(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
