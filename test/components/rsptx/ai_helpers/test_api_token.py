"""
Tests for choosing the course's LLM token and provider for CodeTailor.
"""

from types import SimpleNamespace

import pytest

from rsptx.ai_helpers import api_token
from rsptx.ai_helpers.api_token import LLMToken, fetch_llm_token

# Session loop scope keeps later DB tests on the shared loop (see AGENTS.md)
_asyncio = pytest.mark.asyncio(loop_scope="session")

_COURSE = SimpleNamespace(id=7)


def _fake_tokens(monkeypatch, tokens):
    """Make fetch_api_token return tokens[provider] for _COURSE."""

    async def fetch_api_token(course_id, provider):
        assert course_id == _COURSE.id
        token = tokens.get(provider)
        return SimpleNamespace(token=token) if token is not None else None

    monkeypatch.setattr(api_token, "fetch_api_token", fetch_api_token)


@_asyncio
async def test_umgpt_token_used_when_course_has_no_openai_token(monkeypatch):
    _fake_tokens(monkeypatch, {"umgpt": "um-key"})
    assert await fetch_llm_token(_COURSE) == LLMToken("um-key", "umgpt")


@_asyncio
async def test_openai_token_preferred_when_course_has_both(monkeypatch):
    _fake_tokens(monkeypatch, {"openai": "sk-key", "umgpt": "um-key"})
    assert await fetch_llm_token(_COURSE) == LLMToken("sk-key", "openai")


@_asyncio
async def test_no_token(monkeypatch):
    _fake_tokens(monkeypatch, {"openai": ""})
    assert await fetch_llm_token(_COURSE) is None


def test_client_and_model_follow_provider():
    um = LLMToken("um-key", "umgpt")
    assert str(um.client().base_url).startswith(
        "https://api.toolkit.umgpt.umich.edu/v1"
    )
    assert um.model == "gpt-4o-mini"

    oa = LLMToken("sk-key")
    assert str(oa.client().base_url).startswith("https://api.openai.com/v1")
    assert oa.model == "gpt-5-nano"


def test_repr_masks_key():
    token = LLMToken("sk-abSECRETxyz9", "openai")
    assert token.masked() == "sk-a****xyz9"
    assert "SECRET" not in repr(token)
