#!/usr/bin/env python
"""
traceback_monitor.py -- a Textual TUI for watching the ``traceback`` table.

Polls the database every 15 seconds and shows the most recent tracebacks in a
sortable table (timestamp, err_message, hostname, path). Select a row (Enter or
click) to pop up the full traceback text in a scrollable modal.

Connection string is read from the ``DEV_DBURL`` environment variable, falling
back to the local docker-compose ``basic`` profile database
(``postgresql://runestone:runestone@localhost:2345/runestone_dev``).

Usage::

    uv run traceback-monitor
    uv run traceback-monitor --limit 200
    DEV_DBURL=postgresql://user:pass@host:5432/db uv run traceback-monitor

Keys::

    up/down, j/k     move the selection
    Enter            show full traceback detail
    r                refresh now
    q / ctrl+c       quit
    escape           close the detail popup
"""

import argparse
import json
import os
import re
from datetime import datetime

import psycopg2
import psycopg2.extras
from textual import work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import VerticalScroll
from textual.screen import ModalScreen
from textual.widgets import DataTable, Footer, Header, Static

DEFAULT_DBURL = "postgresql://runestone:runestone@localhost:2345/runestone_dev"
REFRESH_SECONDS = 15
QUERY = """
    SELECT id, timestamp, err_message, hostname, path, traceback, local_vars,
           query_string, post_body
    FROM traceback
    ORDER BY timestamp DESC NULLS LAST, id DESC
    LIMIT %s
"""


def get_dburl():
    """psycopg2 wants a plain libpq URL; strip any SQLAlchemy +driver suffix."""
    url = os.environ.get("DBURL", DEFAULT_DBURL)
    return url.replace("postgresql+psycopg2", "postgresql").replace(
        "postgresql+asyncpg", "postgresql"
    )


def fmt_ts(ts):
    if ts is None:
        return ""
    if isinstance(ts, datetime):
        return ts.strftime("%Y-%m-%d %H:%M:%S")
    return str(ts)


# Legacy rows (before the local_vars JSON column was added) had create_traceback
# append "\n".join(textwrap.wrap(str([{'name':.., 'local_vars': {..}}, ...]), 80))
# onto the traceback text -- the last couple of frames' locals as a Python repr
# folded at 80 columns. The helpers below split that section off, undo the
# folding, and re-indent it so such rows still render nicely.
LOCALS_RE = re.compile(r"\[\{'name': '")


def split_traceback_and_locals(tb):
    """Return (traceback_text, locals_repr). locals_repr is None when the
    trailing variables section isn't present."""
    if not tb:
        return tb, None
    m = LOCALS_RE.search(tb)
    if not m:
        return tb, None
    return tb[: m.start()].rstrip("\n"), tb[m.start() :]


def unwrap(text, width=80):
    """Undo textwrap.wrap(s, width) by rejoining physical lines. A line filled
    to the width was a force-broken long word, and a line ending in a hyphen
    was broken on that hyphen -- both rejoin with no space; anything else broke
    at a space and rejoins with one."""
    lines = text.split("\n")
    parts = [lines[0]]
    for prev, ln in zip(lines, lines[1:]):
        sep = "" if (prev.endswith("-") or len(prev) >= width) else " "
        parts.append(sep + ln)
    return "".join(parts)


def prettify_repr(s, indent_str="  "):
    """Structurally re-indent a Python-repr string (quote-aware). Dict and list
    brackets break onto indented lines; call/tuple parens stay inline so things
    like datetime.datetime(...) read on a single line."""
    out = []
    stack = []  # open-bracket characters we're currently inside
    i, n = 0, len(s)
    in_str, quote = False, ""

    def newline():
        out.append("\n" + indent_str * sum(1 for b in stack if b in "{["))

    while i < n:
        c = s[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:  # keep escaped char with its backslash
                out.append(s[i + 1])
                i += 2
                continue
            if c == quote:
                in_str = False
            i += 1
            continue
        if c in ("'", '"'):
            in_str, quote = True, c
            out.append(c)
            i += 1
            continue
        if c in "{[":
            stack.append(c)
            out.append(c)
            newline()
            i += 1
            while i < n and s[i] == " ":
                i += 1
            continue
        if c == "(":
            stack.append(c)
            out.append(c)
            i += 1
            continue
        if c in "}]":
            if stack:
                stack.pop()
            newline()
            out.append(c)
            i += 1
            continue
        if c == ")":
            if stack:
                stack.pop()
            out.append(c)
            i += 1
            continue
        if c == ",":
            out.append(",")
            if stack and stack[-1] in "{[":
                newline()
            else:
                out.append(" ")
            i += 1
            while i < n and s[i] == " ":
                i += 1
            continue
        out.append(c)
        i += 1
    return "".join(out)


class TracebackDetail(ModalScreen):
    """A scrollable modal showing one full traceback."""

    BINDINGS = [
        Binding("escape,q", "dismiss", "Close"),
    ]

    DEFAULT_CSS = """
    TracebackDetail {
        align: center middle;
    }
    TracebackDetail > VerticalScroll {
        width: 90%;
        height: 90%;
        border: round $accent;
        background: $surface;
        padding: 1 2;
    }
    TracebackDetail .meta {
        color: $text-muted;
        margin-bottom: 1;
    }
    TracebackDetail .tb {
        color: $text;
    }
    TracebackDetail .locals-header {
        color: $accent;
        text-style: bold;
        margin-top: 1;
    }
    TracebackDetail .locals {
        color: $text-muted;
    }
    """

    def __init__(self, row):
        super().__init__()
        self.row = row

    def compose(self) -> ComposeResult:
        r = self.row

        def esc(value):
            # Escape so user data containing "[...]" isn't parsed as markup.
            return str("" if value is None else value).replace("[", r"\[")

        meta = (
            f"[b]id[/b]        {esc(r['id'])}\n"
            f"[b]timestamp[/b] {esc(fmt_ts(r['timestamp']))}\n"
            f"[b]hostname[/b]  {esc(r['hostname'])}\n"
            f"[b]path[/b]      {esc(r['path'])}\n"
            f"[b]err[/b]       {esc(r['err_message'])}"
        )
        # New rows carry locals in the JSON ``local_vars`` column. Old rows have
        # them folded into the traceback text -- fall back to parsing that.
        if r.get("local_vars"):
            tb_text = r["traceback"]
            locals_text = json.dumps(r["local_vars"], indent=2, ensure_ascii=False)
        else:
            tb_text, locals_repr = split_traceback_and_locals(r["traceback"])
            locals_text = prettify_repr(unwrap(locals_repr)) if locals_repr else None

        with VerticalScroll():
            yield Static(meta, classes="meta", markup=True)
            # markup=False: raw traceback text is never interpreted as markup.
            yield Static(tb_text or "(no traceback text)", classes="tb", markup=False)
            if locals_text:
                yield Static(
                    "── Local variables (last frames) ──",
                    classes="locals-header",
                    markup=False,
                )
                yield Static(locals_text, classes="locals", markup=False)

    def action_dismiss(self) -> None:
        self.dismiss()


class FieldDetail(ModalScreen):
    """A scrollable modal showing a single field's value (e.g. post_body)."""

    BINDINGS = [
        Binding("escape,q", "dismiss", "Close"),
    ]

    DEFAULT_CSS = """
    FieldDetail {
        align: center middle;
    }
    FieldDetail > VerticalScroll {
        width: 90%;
        height: 90%;
        border: round $accent;
        background: $surface;
        padding: 1 2;
    }
    FieldDetail .field-title {
        color: $accent;
        text-style: bold;
        margin-bottom: 1;
    }
    FieldDetail .field-value {
        color: $text;
    }
    """

    def __init__(self, title, value):
        super().__init__()
        self.field_title = title
        self.field_value = value

    def compose(self) -> ComposeResult:
        with VerticalScroll():
            yield Static(self.field_title, classes="field-title", markup=False)
            value = self.field_value
            if value is None or value == "":
                value = "(empty)"
            yield Static(str(value), classes="field-value", markup=False)

    def action_dismiss(self) -> None:
        self.dismiss()


class TracebackMonitor(App):
    """Live view of the traceback table."""

    TITLE = "Traceback Monitor"

    BINDINGS = [
        Binding("ctrl+c", "quit", "Quit"),
        Binding("r", "refresh", "Refresh"),
        Binding("enter", "show_detail", "Detail"),
        Binding("p", "show_post_body", "Post body"),
        Binding("q", "show_query_string", "Query string"),
        Binding("j", "cursor_down", "Down", show=False),
        Binding("k", "cursor_up", "Up", show=False),
    ]

    CSS = """
    DataTable {
        height: 1fr;
    }
    """

    def __init__(self, limit):
        super().__init__()
        self.limit = limit
        self.rows_by_key = {}

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        yield DataTable(cursor_type="row", zebra_stripes=True)
        yield Footer()

    def on_mount(self) -> None:
        table = self.query_one(DataTable)
        table.add_column("Timestamp", key="timestamp", width=19)
        table.add_column("Err Message", key="err_message")
        table.add_column("Hostname", key="hostname", width=20)
        table.add_column("Path", key="path")
        self.load_rows()
        self.set_interval(REFRESH_SECONDS, self.load_rows)

    @work(exclusive=True, thread=True)
    def load_rows(self) -> None:
        """Fetch rows off the UI thread, then update the table on the UI thread."""
        try:
            conn = psycopg2.connect(get_dburl())
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(QUERY, (self.limit,))
                    rows = cur.fetchall()
            finally:
                conn.close()
        except psycopg2.Error as e:
            self.call_from_thread(self._set_status, f"DB error: {str(e).strip()}")
            return
        self.call_from_thread(self._populate, rows)

    def _set_status(self, message) -> None:
        self.sub_title = message

    def _populate(self, rows) -> None:
        table = self.query_one(DataTable)
        # Preserve the selected row across refreshes when possible.
        prev_key = None
        if table.row_count and table.cursor_row is not None:
            try:
                prev_key = table.coordinate_to_cell_key(
                    table.cursor_coordinate
                ).row_key.value
            except Exception:
                prev_key = None

        table.clear()
        self.rows_by_key = {}
        for r in rows:
            key = str(r["id"])
            self.rows_by_key[key] = r
            table.add_row(
                fmt_ts(r["timestamp"]),
                r["err_message"] or "",
                r["hostname"] or "",
                r["path"] or "",
                key=key,
            )

        if prev_key and prev_key in self.rows_by_key:
            try:
                table.move_cursor(row=table.get_row_index(prev_key))
            except Exception:
                pass

        self.sub_title = f"{len(rows)} rows · updated {datetime.now():%H:%M:%S}"

    def action_refresh(self) -> None:
        self.load_rows()

    def action_cursor_down(self) -> None:
        self.query_one(DataTable).action_cursor_down()

    def action_cursor_up(self) -> None:
        self.query_one(DataTable).action_cursor_up()

    def _selected_row(self):
        table = self.query_one(DataTable)
        if not table.row_count:
            return None
        key = table.coordinate_to_cell_key(table.cursor_coordinate).row_key.value
        return self.rows_by_key.get(key)

    def action_show_detail(self) -> None:
        row = self._selected_row()
        if row:
            self.push_screen(TracebackDetail(row))

    def action_show_post_body(self) -> None:
        row = self._selected_row()
        if row:
            self.push_screen(
                FieldDetail(f"post_body (id {row['id']})", row.get("post_body"))
            )

    def action_show_query_string(self) -> None:
        row = self._selected_row()
        if row:
            self.push_screen(
                FieldDetail(f"query_string (id {row['id']})", row.get("query_string"))
            )

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        row = self.rows_by_key.get(event.row_key.value)
        if row:
            self.push_screen(TracebackDetail(row))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="number of most-recent tracebacks to load (default: 100)",
    )
    args = parser.parse_args()
    TracebackMonitor(limit=args.limit).run()


if __name__ == "__main__":
    main()
