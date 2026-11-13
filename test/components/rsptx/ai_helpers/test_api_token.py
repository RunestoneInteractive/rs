"""
Tests for choosing the course's LLM token and provider for CodeTailor.
"""

from types import SimpleNamespace

import pytest

from rsptx.ai_helpers import api_token
from rsptx.ai_helpers.api_token import LLMToken, fetch_llm_token
from rsptx.configuration import settings

# Session loop scope keeps later DB tests on the shared loop (see AGENTS.md)
_asyncio = pytest.mark.asyncio(loop_scope="session")

_COURSE_ID = 7


def _fake_tokens(monkeypatch, tokens):
    """Make fetch_api_token return tokens[provider] for _COURSE_ID."""

    async def fetch_api_token(course_id, provider):
        assert course_id == _COURSE_ID
        token = tokens.get(provider)
        return SimpleNamespace(token=token) if token is not None else None

    monkeypatch.setattr(api_token, "fetch_api_token", fetch_api_token)


@_asyncio
async def test_umgpt_token_used_when_course_has_no_openai_token(monkeypatch):
    _fake_tokens(monkeypatch, {"umgpt": "um-key"})
    assert await fetch_llm_token(_COURSE_ID) == LLMToken("um-key", "umgpt")


@_asyncio
async def test_openai_token_used_when_course_has_only_openai(monkeypatch):
    _fake_tokens(monkeypatch, {"openai": "sk-key"})
    assert await fetch_llm_token(_COURSE_ID) == LLMToken("sk-key", "openai")


@_asyncio
async def test_provider_order_decides_when_course_has_both(monkeypatch):
    _fake_tokens(monkeypatch, {"openai": "sk-key", "umgpt": "um-key"})
    assert await fetch_llm_token(_COURSE_ID) == LLMToken("um-key", "umgpt")

    monkeypatch.setattr(settings, "llm_provider_order", ["openai", "umgpt"])
    assert await fetch_llm_token(_COURSE_ID) == LLMToken("sk-key", "openai")


@_asyncio
async def test_no_token(monkeypatch):
    _fake_tokens(monkeypatch, {"openai": ""})
    assert await fetch_llm_token(_COURSE_ID) is None


def test_client_and_model_follow_provider():
    um = LLMToken("um-key", "umgpt")
    assert str(um.client().base_url).startswith(settings.llm_base_url_umgpt)
    assert str(um.async_client().base_url).startswith(settings.llm_base_url_umgpt)
    assert um.model == settings.llm_model_umgpt

    oa = LLMToken("sk-key")
    assert str(oa.client().base_url).startswith(settings.llm_base_url_openai)
    assert oa.model == settings.llm_model_openai


def test_model_comes_from_settings(monkeypatch):
    monkeypatch.setattr(settings, "llm_model_umgpt", "some-newer-model")
    assert LLMToken("um-key", "umgpt").model == "some-newer-model"
    # every feature on UMGPT follows the shared setting
    assert LLMToken("um-key", "umgpt", "peer").model == "some-newer-model"
    assert LLMToken("um-key", "umgpt", "codetailor").model == "some-newer-model"


def test_feature_model_overrides_provider_model(monkeypatch):
    monkeypatch.setattr(settings, "llm_model_openai", "gpt-5-nano")
    monkeypatch.setattr(
        settings, "llm_feature_models", {"peer": {"openai": "gpt-4o-mini"}}
    )
    assert LLMToken("sk-key", "openai", "peer").model == "gpt-4o-mini"
    assert LLMToken("sk-key", "openai", "codetailor").model == "gpt-5-nano"


@_asyncio
async def test_fetch_passes_feature_along(monkeypatch):
    _fake_tokens(monkeypatch, {"umgpt": "um-key"})
    token = await fetch_llm_token(_COURSE_ID, "peer")
    assert token == LLMToken("um-key", "umgpt", "peer")


def test_request_params_add_model_extras(monkeypatch):
    monkeypatch.setattr(settings, "llm_model_openai", "gpt-5-nano")
    monkeypatch.setattr(settings, "llm_model_umgpt", "gpt-4o-mini")
    monkeypatch.setattr(
        settings, "llm_model_params", {"gpt-5-nano": {"verbosity": "low"}}
    )
    msgs = [{"role": "user", "content": "hi"}]

    assert LLMToken("sk-key").request_params(messages=msgs) == {
        "model": "gpt-5-nano",
        "verbosity": "low",
        "messages": msgs,
    }
    # verbosity goes with the model, so other models never get it
    assert "verbosity" not in LLMToken("um", "umgpt").request_params(messages=msgs)
    # a caller's own parameter overrides the model's
    params = LLMToken("sk-key").request_params(messages=msgs, verbosity="high")
    assert params["verbosity"] == "high"


def test_repr_masks_key():
    token = LLMToken("sk-abSECRETSECRETSECRETxyz9", "openai")
    assert token.masked() == "sk-a****xyz9"
    assert "SECRET" not in repr(token)


def test_short_key_shows_less():
    token = LLMToken("abcd1234", "openai")
    assert token.masked() == "a****4"
    assert "abcd" not in repr(token) and "1234" not in repr(token)
    assert LLMToken("abc").masked() == "****"
