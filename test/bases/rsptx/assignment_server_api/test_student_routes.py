"""
Functional tests for the student progress report route in the assignment
server (``GET /student/studentreport``), plus a unit test for the
``_build_chapter_progress`` helper that ports the legacy dashboard's
book-completion logic.

The seeded test DB has ``testuser1`` in the ``overview`` course with no
chapters, assignments, or activity, so the functional tests exercise the
rendering / download paths against an empty report. The unit test covers the
status-rollup logic directly with lightweight fake objects.
"""

from types import SimpleNamespace

import pytest

from rsptx.assignment_server_api.routers.student import _build_chapter_progress

# Applied to the async route tests below; the pure helper test is synchronous.
asyncio_session = pytest.mark.asyncio(loop_scope="session")


# ---------------------------------------------------------------------------
# Unit test: _build_chapter_progress
# ---------------------------------------------------------------------------


def test_build_chapter_progress_status_rollup():
    """Chapter status rolls up from subchapter progress: completed only when
    every started subchapter is complete, started when any progress exists,
    otherwise not started. Only subchapters with progress are listed."""
    chapters = [
        SimpleNamespace(id=1, chapter_label="ch1", chapter_name="Chapter One"),
        SimpleNamespace(id=2, chapter_label="ch2", chapter_name="Chapter Two"),
        SimpleNamespace(id=3, chapter_label="ch3", chapter_name="Chapter Three"),
    ]
    subchapters = [
        SimpleNamespace(chapter_id=1, sub_chapter_label="s1", sub_chapter_name="Sub 1"),
        SimpleNamespace(chapter_id=1, sub_chapter_label="s2", sub_chapter_name="Sub 2"),
        SimpleNamespace(chapter_id=2, sub_chapter_label="s3", sub_chapter_name="Sub 3"),
        SimpleNamespace(chapter_id=3, sub_chapter_label="s4", sub_chapter_name="Sub 4"),
    ]
    # ch1: one complete + one started -> "started"
    # ch2: all complete -> "completed"
    # ch3: no progress -> "notstarted"
    progress = [
        SimpleNamespace(chapter_id="ch1", sub_chapter_id="s1", status=1),
        SimpleNamespace(chapter_id="ch1", sub_chapter_id="s2", status=0),
        SimpleNamespace(chapter_id="ch2", sub_chapter_id="s3", status=1),
    ]

    result = _build_chapter_progress(chapters, subchapters, progress)

    assert [c["label"] for c in result] == [
        "Chapter One",
        "Chapter Two",
        "Chapter Three",
    ]
    assert result[0]["status"] == "started"
    assert result[1]["status"] == "completed"
    assert result[2]["status"] == "notstarted"

    # Subchapter labels are mapped to their human-readable names, and only
    # subchapters that have progress rows are shown.
    assert result[0]["subchapters"] == [
        {"label": "Sub 1", "status": "completed"},
        {"label": "Sub 2", "status": "started"},
    ]
    assert result[1]["subchapters"] == [{"label": "Sub 3", "status": "completed"}]
    assert result[2]["subchapters"] == []


# ---------------------------------------------------------------------------
# GET /student/studentreport
# ---------------------------------------------------------------------------


@asyncio_session
async def test_student_report_renders(auth_assignment_client):
    """A student can load their own progress report (HTML)."""
    resp = await auth_assignment_client.get("/student/studentreport")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "Student Report" in resp.text


@asyncio_session
async def test_student_report_dlcsv(auth_assignment_client):
    """The dlcsv action streams the activity history as a CSV download."""
    resp = await auth_assignment_client.get("/student/studentreport?action=dlcsv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "data_for_testuser1.csv" in resp.headers["content-disposition"]


@asyncio_session
async def test_student_report_dlcode(auth_assignment_client):
    """The dlcode action streams the code history as a CSV download."""
    resp = await auth_assignment_client.get("/student/studentreport?action=dlcode")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "code_for_testuser1.csv" in resp.headers["content-disposition"]


@asyncio_session
async def test_instructor_can_view_student(auth_instructor_client):
    """An instructor can view a specific student's report via ?id=."""
    resp = await auth_instructor_client.get("/student/studentreport?id=testuser1")
    assert resp.status_code == 200
    assert "Student Report" in resp.text
