"""The LLM API token a course's instructor added for its LLM features.

CodeTailor calls the LLM with the course's own token, never a server-wide key.
"""

from typing import NamedTuple

from openai import OpenAI

from rsptx.db.crud.crud import fetch_api_token

# for dev/test -- replace with your own key for local testing
DEV_API_KEY = ""
# The test course for development, which uses DEV_API_KEY
DEV_COURSE = "personalized_parsons"

# The providers CodeTailor can call, in the order a course's tokens are tried.
# Each serves the OpenAI chat completions API. The keys are the provider names
# instructors save tokens under (add_token.html; UMGPT is entered as "umgpt").
# Trying "openai" first keeps courses that have both on the model they used.
LLM_PROVIDERS = {
    "openai": {"base_url": "https://api.openai.com/v1", "model": "gpt-5-nano"},
    # U-M's gateway, as in assignment_server_api/routers/peer.py
    "umgpt": {
        "base_url": "https://api.toolkit.umgpt.umich.edu/v1",
        "model": "gpt-4o-mini",
    },
}


class LLMToken(NamedTuple):
    """A course's API token and the provider it belongs to."""

    token: str
    provider: str = "openai"

    @property
    def model(self):
        return LLM_PROVIDERS[self.provider]["model"]

    def client(self):
        return OpenAI(
            api_key=self.token, base_url=LLM_PROVIDERS[self.provider]["base_url"]
        )

    def __repr__(self):
        # keep the key out of logs and tracebacks
        return f"LLMToken(provider={self.provider!r}, token={self.token[:4]!r}****)"


def uses_dev_api_key(course_name):
    return course_name is None or course_name == DEV_COURSE


def dev_llm_token():
    return LLMToken(DEV_API_KEY, "openai")


async def fetch_llm_token(course):
    """
    The course's least recently used token (decrypted) for the first provider
    in LLM_PROVIDERS it has one for, or None if its instructor hasn't added one.
    """
    for provider in LLM_PROVIDERS:
        token_record = await fetch_api_token(course_id=course.id, provider=provider)
        if token_record and token_record.token:
            return LLMToken(token_record.token, provider)
    return None
