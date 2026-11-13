"""
Peer instruction's LLM calls go through the shared rsptx.ai_helpers token, so
they reach the course's provider with the shared model settings.

The OpenAI SDK runs for real; only its HTTP transport is replaced, so these
tests see exactly the request PI would send.
"""

import json

import httpx
import pytest

from rsptx.ai_helpers import api_token
from rsptx.ai_helpers.api_token import LLMToken
from rsptx.assignment_server_api.routers import peer
from rsptx.configuration import settings

# Session loop scope keeps later DB tests on the shared loop (see AGENTS.md)
pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest.fixture
def llm(monkeypatch):
    """
    Give course 7 the token in ``llm.token`` and record every request PI sends.
    """
    state = {"token": None, "requests": []}

    async def fetch_llm_token(course_id, feature=None):
        assert feature == "peer"
        tok = state["token"]
        return tok._replace(feature=feature) if tok else None

    def handler(request):
        state["requests"].append(
            {"url": str(request.url), "body": json.loads(request.content)}
        )
        return httpx.Response(
            200,
            json={
                "id": "x",
                "object": "chat.completion",
                "created": 0,
                "model": "m",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {"role": "assistant", "content": " a reply "},
                    }
                ],
            },
        )

    real_async_openai = api_token.AsyncOpenAI

    def async_openai(**kwargs):
        transport = httpx.MockTransport(handler)
        return real_async_openai(
            http_client=httpx.AsyncClient(transport=transport), **kwargs
        )

    monkeypatch.setattr(peer, "fetch_llm_token", fetch_llm_token)
    monkeypatch.setattr(api_token, "AsyncOpenAI", async_openai)
    return state


async def test_umgpt_course_uses_shared_umgpt_model(llm, monkeypatch):
    monkeypatch.setattr(settings, "llm_model_umgpt", "shared-umgpt-model")
    llm["token"] = LLMToken("um-key", "umgpt")

    reply = await peer._call_openai_async([{"role": "user", "content": "hi"}], 7)

    assert reply == "a reply"
    [req] = llm["requests"]
    assert req["url"] == settings.llm_base_url_umgpt + "/chat/completions"
    assert req["body"]["model"] == "shared-umgpt-model"
    assert req["body"]["temperature"] == 0.4
    assert req["body"]["max_tokens"] == 300
    assert "verbosity" not in req["body"]


async def test_openai_course_keeps_peer_model(llm, monkeypatch):
    # PI sends temperature, which GPT-5 models reject, so on OpenAI it keeps
    # its own model instead of CodeTailor's gpt-5-nano
    monkeypatch.setattr(settings, "llm_model_openai", "gpt-5-nano")
    monkeypatch.setattr(
        settings, "llm_feature_models", {"peer": {"openai": "gpt-4o-mini"}}
    )
    monkeypatch.setattr(
        settings, "llm_model_params", {"gpt-5-nano": {"verbosity": "low"}}
    )
    llm["token"] = LLMToken("sk-key", "openai")

    await peer._call_openai_async([{"role": "user", "content": "hi"}], 7)

    [req] = llm["requests"]
    assert req["url"] == settings.llm_base_url_openai + "/chat/completions"
    assert req["body"]["model"] == "gpt-4o-mini"
    assert "verbosity" not in req["body"]


async def test_no_token_means_llm_disabled(llm):
    assert await peer._llm_enabled_async(7) is False
    with pytest.raises(Exception, match="missing api key"):
        await peer._call_openai_async([{"role": "user", "content": "hi"}], 7)
    assert llm["requests"] == []


async def test_analogy_mapping_splits_first_message(llm, monkeypatch):
    llm["token"] = LLMToken("um-key", "umgpt")

    mapping, first = await peer._generate_analogy_mapping_async(
        "What does x = 5 do?", "", [], "cooking", course_id=7
    )
    [req] = llm["requests"]
    assert req["body"]["temperature"] == 0.5
    assert req["body"]["max_tokens"] == 700
    # the stub reply has no FIRST_MESSAGE marker, so it is all mapping
    assert mapping == "a reply" and first == ""
