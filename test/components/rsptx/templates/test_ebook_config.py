import datetime
import json
from types import SimpleNamespace

import pytest

from rsptx.templates import ebook_config
from rsptx.templates.ebook_config import ebook_config_override

# No session-scoped fixture here, so pin the loop or later DB tests break.
pytestmark = pytest.mark.asyncio(loop_scope="session")

PREFIX = "ebook_config_override = "


def _course():
    return SimpleNamespace(
        course_name="mycourse",
        base_course="mybook",
        term_start_date=datetime.date(2026, 9, 1),
        downloads_enabled=True,
        allow_pairs=None,
    )


def _parse(statement):
    assert statement.startswith(PREFIX)
    return json.loads(statement[len(PREFIX) :])


async def test_anonymous_reader():
    cfg = _parse(
        await ebook_config_override(
            course=_course(),
            user=None,
            user_is_instructor=False,
            course_attrs={},
            readings=[],
            activities={},
            use_services=False,
        )
    )
    assert cfg["useRunestoneServices"] is False
    assert cfg["isLoggedIn"] is False
    assert cfg["username"] == "" and cfg["email"] == ""
    assert cfg["course"] == "mycourse" and cfg["basecourse"] == "mybook"
    assert cfg["termStartDate"] == "2026-09-01"
    assert cfg["downloadsEnabled"] is True and cfg["allow_pairs"] is False
    assert cfg["isAuthor"] is False and cfg["isEditor"] is False


async def test_null_readings_survive():
    # Assignment pages send null so bookfuncs skips the reading tracker.
    cfg = _parse(
        await ebook_config_override(
            course=_course(),
            user=None,
            user_is_instructor=False,
            course_attrs={},
            readings=None,
            activities={},
        )
    )
    assert cfg["readings"] is None


async def test_group_lookups_only_for_instructors(monkeypatch):
    calls = []

    async def fake_is_author(uid):
        calls.append(("author", uid))
        return True

    async def fake_is_editor(uid):
        calls.append(("editor", uid))
        return False

    monkeypatch.setattr(ebook_config, "is_author", fake_is_author)
    monkeypatch.setattr(ebook_config, "is_editor", fake_is_editor)
    user = SimpleNamespace(id=7, username="sue", email="sue@example.com")

    student = _parse(
        await ebook_config_override(
            course=_course(),
            user=user,
            user_is_instructor=False,
            course_attrs={},
            readings=[],
            activities={},
        )
    )
    assert calls == []
    assert student["isAuthor"] is False and student["isEditor"] is False

    instructor = _parse(
        await ebook_config_override(
            course=_course(),
            user=user,
            user_is_instructor=True,
            course_attrs={},
            readings=[],
            activities={},
        )
    )
    assert calls == [("author", 7), ("editor", 7)]
    assert instructor["isAuthor"] is True and instructor["isEditor"] is False
    assert instructor["username"] == "sue" and instructor["isLoggedIn"] is True


async def test_course_attr_cannot_close_the_script_tag():
    statement = await ebook_config_override(
        course=_course(),
        user=None,
        user_is_instructor=False,
        course_attrs={"x": "</script><script>alert(1)</script>"},
        readings=[],
        activities={},
    )
    assert "</script>" not in statement
    assert _parse(statement)["course_attrs"]["x"].startswith("</script>")
