"""
Authorization and data-scoping tests for two assessment endpoints:

- ``getaggregateresults`` must report on the caller's own course (never one
  named in the query string), must not return the course record, and must
  drop answer keys the mchoice component could not have written (they are
  rendered for every student who clicks "Compare me").
- ``has_attachment`` must only let an instructor look up another student's
  attachment.

These endpoints read ``request.state.user`` (set by the auth middleware), so
the handlers are called directly with a stand-in request and the database
and S3 helpers stubbed out. No database is required.
"""

import json
from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from rsptx.book_server_api.routers import assessment

pytestmark = pytest.mark.asyncio(loop_scope="session")


def _request(username="student1", course_name="mycourse"):
    user = SimpleNamespace(username=username, course_name=course_name)
    return SimpleNamespace(state=SimpleNamespace(user=user))


def _detail(resp):
    return json.loads(resp.body)["detail"]


@pytest.fixture
def aggregate_stubs(monkeypatch):
    calls = {}

    async def fake_fetch_course(course_name):
        calls["course"] = course_name
        return SimpleNamespace(
            course_name=course_name,
            base_course="base",
            term_start_date=datetime(2026, 1, 1),
        )

    async def fake_count_useinfo_for(div_id, course_name, start_date):
        calls["useinfo_course"] = course_name
        return [
            ("answer:0:correct", 2),
            ("answer:1,2:no", 1),
            ('answer:<img src=x onerror="alert(1)">:no', 1),
            ("answer::no", 1),
        ]

    monkeypatch.setattr(assessment, "fetch_course", fake_fetch_course)
    monkeypatch.setattr(assessment, "count_useinfo_for", fake_count_useinfo_for)
    return calls


async def test_aggregate_uses_callers_course(aggregate_stubs):
    await assessment.getaggregateresults(
        _request(course_name="mycourse"), div_id="q1", course_name="othercourse"
    )
    assert aggregate_stubs["course"] == "mycourse"
    assert aggregate_stubs["useinfo_course"] == "mycourse"


async def test_aggregate_omits_course_record(aggregate_stubs):
    detail = _detail(await assessment.getaggregateresults(_request(), div_id="q1"))
    assert "course" not in detail["misc"]
    assert detail["misc"]["correct"] == "0"


async def test_aggregate_drops_non_index_answers(aggregate_stubs):
    detail = _detail(await assessment.getaggregateresults(_request(), div_id="q1"))
    assert set(detail["answerDict"]) == {"0", "1,2"}


@pytest.fixture
def attachment_stubs(monkeypatch):
    calls = {}

    async def fake_check_attachment(sid, div_id, course):
        calls["sid"] = sid
        calls["course"] = course
        return f"{course}/{div_id}/{sid}/file.png"

    def set_instructor(value):
        async def fake_is_instructor(request):
            return value

        monkeypatch.setattr(assessment, "is_instructor", fake_is_instructor)

    monkeypatch.setattr(assessment, "check_attachment", fake_check_attachment)
    set_instructor(False)
    calls["set_instructor"] = set_instructor
    return calls


async def test_attachment_defaults_to_own(attachment_stubs):
    await assessment.has_attachment(_request(), div_id="q1")
    assert attachment_stubs["sid"] == "student1"


async def test_attachment_own_sid_allowed(attachment_stubs):
    await assessment.has_attachment(_request(), div_id="q1", sid="student1")
    assert attachment_stubs["sid"] == "student1"


async def test_attachment_other_sid_rejected_for_student(attachment_stubs):
    with pytest.raises(HTTPException) as exc:
        await assessment.has_attachment(_request(), div_id="q1", sid="student2")
    assert exc.value.status_code == 401
    assert "sid" not in attachment_stubs


async def test_attachment_other_sid_allowed_for_instructor(attachment_stubs):
    attachment_stubs["set_instructor"](True)
    await assessment.has_attachment(
        _request(username="prof"), div_id="q1", sid="student2"
    )
    assert attachment_stubs["sid"] == "student2"
    assert attachment_stubs["course"] == "mycourse"
