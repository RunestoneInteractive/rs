"""LTI service response parsing.

Platforms disagree about what a successful service response looks like. An AGS
score POST is answered by D2L with 200, an empty body, and an empty content
type; Moodle is known to serve real JSON as text/html. aiohttp's ``json()``
rejects both on mimetype alone, and the resulting ContentTypeError used to
surface as "put_grade failed" for grades the LMS had actually accepted.
"""

import json
from unittest.mock import AsyncMock, MagicMock

import aiohttp
import pytest
from multidict import CIMultiDict, CIMultiDictProxy
from yarl import URL

from rsptx.lti1p3.pylti1p3.exception import LtiException
from rsptx.lti1p3.pylti1p3.service_connector import ServiceConnector

SCOPES = ["https://purl.imsglobal.org/spec/lti-ags/scope/score"]
URL_STR = "https://lms.example/lineitems/1/scores"

# aiohttp only hands a body to json.loads when the mimetype says JSON.
JSON_MIMETYPES = ("application/json", "application/vnd.ims.lis.v1.score+json")


class FakeResponse:
    """Enough of aiohttp.ClientResponse to exercise make_service_request.

    ``json()`` mirrors aiohttp: it checks the content type first and raises
    ContentTypeError without ever looking at the body.
    """

    def __init__(self, body="", content_type="application/json", status=200):
        self._body = body
        self.content_type = content_type
        self.status = status
        self.ok = status < 400
        self.reason = "OK"
        self.url = URL(URL_STR)
        self.headers = {}
        self.content = MagicMock()

    async def json(self):
        if not (
            self.content_type in JSON_MIMETYPES or self.content_type.endswith("+json")
        ):
            raise aiohttp.ContentTypeError(
                aiohttp.RequestInfo(
                    URL(URL_STR), "POST", CIMultiDictProxy(CIMultiDict()), URL(URL_STR)
                ),
                (),
                status=self.status,
                message=f"Attempt to decode JSON with unexpected mimetype: {self.content_type}",
            )
        return json.loads(self._body)

    async def text(self):
        return self._body


def _connector(response):
    session = MagicMock()
    session.post = AsyncMock(return_value=response)
    connector = ServiceConnector(MagicMock(), requests_session=session)
    connector.get_access_token = AsyncMock(return_value="token")
    return connector


async def _post(response):
    return await _connector(response).make_service_request(
        SCOPES, URL_STR, method="POST", data='{"scoreGiven": 50.0}'
    )


async def test_empty_body_without_content_type_is_not_an_error():
    """D2L's answer to a score POST: 200, no body, empty content type."""
    result = await _post(FakeResponse(body="", content_type=""))

    assert result["body"] is None


async def test_json_served_as_text_html_is_parsed():
    """Moodle labels JSON as text/html; the body is still the response."""
    result = await _post(
        FakeResponse(body='{"resultUrl": "/results/1"}', content_type="text/html")
    )

    assert result["body"] == {"resultUrl": "/results/1"}


async def test_unparseable_body_still_raises():
    """A non-empty body we cannot read is a real failure, mimetype aside."""
    with pytest.raises(LtiException, match="Gateway Timeout"):
        await _post(FakeResponse(body="<html>Gateway Timeout</html>", content_type=""))


async def test_json_response_is_parsed():
    result = await _post(
        FakeResponse(
            body='{"resultUrl": "/results/1"}', content_type="application/json"
        )
    )

    assert result["body"] == {"resultUrl": "/results/1"}
