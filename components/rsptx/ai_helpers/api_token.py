"""The LLM API token a course's instructor added for its LLM features.

AI features (CodeTailor, peer instruction) call the LLM with the course's own
token, never a server-wide key. Which provider, model and request parameters
a course gets is configured once, in Settings (``llm_*`` in
rsptx.configuration.core), and shared by every feature.
"""

from typing import NamedTuple, Optional

from openai import AsyncOpenAI, OpenAI

from rsptx.configuration import settings
from rsptx.db.crud.crud import fetch_api_token

# for dev/test -- replace with your own key for local testing
DEV_API_KEY = ""
# The test course for development, which uses DEV_API_KEY
DEV_COURSE = "personalized_parsons"

# The providers the AI features can call. The names are the ones instructors
# save tokens under (add_token.html; UMGPT is entered as "umgpt" under Other).
# Each needs llm_base_url_<name> and llm_model_<name> in Settings.
LLM_PROVIDERS = ("openai", "umgpt")


class LLMToken(NamedTuple):
    """A course's API token, the provider it belongs to, and the feature using it."""

    token: str
    provider: str = "openai"
    # e.g. "codetailor" or "peer"; picks up that feature's llm_feature_models
    feature: Optional[str] = None

    @property
    def base_url(self):
        return getattr(settings, f"llm_base_url_{self.provider}")

    @property
    def model(self):
        feature_models = settings.llm_feature_models.get(self.feature) or {}
        return feature_models.get(self.provider) or getattr(
            settings, f"llm_model_{self.provider}"
        )

    def request_params(self, **params):
        """
        The model and its extra parameters (llm_model_params) for a chat
        completions request, plus the caller's own ``params``, which take
        precedence.
        """
        model = self.model
        return {
            "model": model,
            **settings.llm_model_params.get(model, {}),
            **params,
        }

    def client(self, **options):
        """A synchronous OpenAI client for this provider; ``options`` go to OpenAI()."""
        return OpenAI(api_key=self.token, base_url=self.base_url, **options)

    def async_client(self, **options):
        """An async OpenAI client for this provider; ``options`` go to AsyncOpenAI()."""
        return AsyncOpenAI(api_key=self.token, base_url=self.base_url, **options)

    def masked(self):
        """
        The key with only a few characters at each end shown, as a breadcrumb
        for telling keys apart: four for real keys, fewer for short ones so
        most of the key stays hidden.
        """
        shown = min(4, len(self.token) // 6)
        if shown == 0:
            return "****"
        return f"{self.token[:shown]}****{self.token[-shown:]}"

    def __repr__(self):
        # keep the key out of logs and tracebacks
        return (
            f"LLMToken(provider={self.provider!r}, feature={self.feature!r}, "
            f"token={self.masked()!r})"
        )


def uses_dev_api_key(course_name):
    return course_name is None or course_name == DEV_COURSE


def dev_llm_token(feature=None):
    return LLMToken(DEV_API_KEY, "openai", feature)


async def fetch_llm_token(course_id, feature=None):
    """
    The course's least recently used token (decrypted) for the provider it has
    a token for, or None if its instructor hasn't added one. A course with
    tokens for several providers gets the first in ``llm_provider_order``.
    ``feature`` names the feature that will use it (see llm_feature_models).
    """
    for provider in settings.llm_provider_order:
        if provider not in LLM_PROVIDERS:
            continue
        token_record = await fetch_api_token(course_id=course_id, provider=provider)
        if token_record and token_record.token:
            return LLMToken(token_record.token, provider, feature)
    return None
