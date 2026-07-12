#!/usr/bin/env python3
#
# `build_mon.py` - Monitor book build and deploy progress
# ========================================================
# A Textual TUI that watches the last_build and last_deploy columns of the
# library table (maintained by the build_books script) for every book that is
# in use (for_classes or is_visible).  Handy to keep open in another terminal
# while a long build_books run is in progress.

import os
from datetime import datetime

import click
from sqlalchemy import create_engine, select, or_
from textual.app import App, ComposeResult
from textual.widgets import DataTable, Header, Footer, Static

from rsptx.db.models import Library


def get_dburl():
    conf = os.environ.get("WEB2PY_CONFIG", "production")
    if conf == "production":
        dburl = os.environ.get("DBURL")
    elif conf == "development":
        dburl = os.environ.get("DEV_DBURL")
    elif conf == "test":
        dburl = os.environ.get("TEST_DBURL")
    else:
        dburl = None
    return dburl.replace("+asyncpg", "") if dburl else None


def fmt(ts):
    return ts.strftime("%Y-%m-%d %H:%M:%S") if ts else ""


class BuildMonitor(App):
    """A Textual app to monitor build progress with a scrollable table."""

    BINDINGS = [
        ("q", "quit", "Quit"),
        ("ctrl+c", "quit", "Quit"),
        ("r", "refresh", "Refresh Now"),
        ("p", "pause", "Pause Refresh"),
        ("c", "resume", "Resume Refresh"),
    ]

    def __init__(self, dburl):
        super().__init__()
        self.engine = create_engine(dburl)

    def compose(self) -> ComposeResult:
        yield Header()
        yield Static(
            "Build Progress Monitor - Press 'r' to refresh, 'q' to quit",
            id="instructions",
        )
        self.table = DataTable(zebra_stripes=True, cursor_type="row")
        self.table.add_columns("Build Time", "Book", "Deploy Time")
        yield self.table
        yield Footer()

    def on_mount(self) -> None:
        # Refresh table every 15 seconds
        self.timer = self.set_interval(15.0, self.refresh_table)

        # Initial load
        self.refresh_table()

    def refresh_table(self) -> None:
        """Refresh the build progress table from the library table."""
        try:
            query = select(
                Library.basecourse, Library.last_build, Library.last_deploy
            ).where(
                or_(
                    Library.for_classes == True,  # noqa: E712
                    Library.is_visible == True,  # noqa: E712
                )
            )
            with self.engine.connect() as conn:
                books = conn.execute(query).all()

            # Sort by build time (most recent first), with missing times at the end
            def sort_key(row):
                if row.last_build:
                    return (0, -row.last_build.timestamp())
                return (1, row.basecourse)

            self.table.clear()
            for book, last_build, last_deploy in sorted(books, key=sort_key):
                if not last_build:
                    # Never built - red book name
                    styled_book = f"[red]{book}[/red]"
                elif not last_deploy or last_deploy < last_build:
                    # Built but not deployed since - yellow book name
                    styled_book = f"[yellow]{book}[/yellow]"
                else:
                    # Deploy is current with the build - green book name
                    styled_book = f"[green]{book}[/green]"

                self.table.add_row(fmt(last_build), styled_book, fmt(last_deploy))

            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.query_one("#instructions").update(
                f"Build Progress Monitor - Last updated: {current_time} - Press 'r' to refresh, 'q' to quit"
            )

        except Exception as e:
            self.query_one("#instructions").update(
                f"Build Progress Monitor - refresh failed: {e}"
            )

    def action_refresh(self) -> None:
        """Manually refresh the table."""
        self.refresh_table()

    def action_quit(self) -> None:
        """Handle quit action."""
        self.exit()

    def action_pause(self) -> None:
        """Pause the app."""
        self.timer.pause()
        self.query_one("#instructions").update("Build Progress Monitor - Paused")

    def action_resume(self) -> None:
        """Resume the app."""
        self.timer.resume()
        self.query_one("#instructions").update("Build Progress Monitor - Resuming")


def main():
    dburl = get_dburl()
    if not dburl:
        click.echo("No database URL configured, check WEB2PY_CONFIG and DBURL")
        exit(1)
    BuildMonitor(dburl).run()


if __name__ == "__main__":
    main()
