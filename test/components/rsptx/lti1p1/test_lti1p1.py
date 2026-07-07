"""Unit tests for the LTI 1.1 helper component (rsptx.lti1p1).

These exercise the security-critical OAuth1 signature verification and the
outcome-request XML generation without touching the database or network.
"""

import oauth2
import pytest
from lxml import etree

from rsptx.lti1p1.core import param_converter, verify_lti1p1_signature
from rsptx.lti1p1.outcome_request import OutcomeRequest, REPLACE_REQUEST


KEY = "test.consumer"
SECRET = "supersecret"
URL = "https://runestone.academy/runestone/lti"


def _sign(params, key=KEY, secret=SECRET, url=URL):
    """Produce an HMAC-SHA1 signed launch param dict, like an LMS would."""
    consumer = oauth2.Consumer(key, secret)
    req = oauth2.Request.from_consumer_and_token(
        consumer, token=None, http_method="POST", http_url=url, parameters=dict(params)
    )
    req.sign_request(oauth2.SignatureMethod_HMAC_SHA1(), consumer, None)
    # oauth2 hands back the signature as bytes; browsers/LMS send it as text.
    return {
        k: (v.decode() if isinstance(v, bytes) else v) for k, v in dict(req).items()
    }


LAUNCH = {
    "user_id": "123",
    "lis_person_name_given": "Jo",
    "lis_person_name_family": "Doe",
    "lis_person_contact_email_primary": "jo@example.com",
    "roles": "Instructor",
    "custom_course_id": "42",
    "lti_message_type": "basic-lti-launch-request",
    "lti_version": "LTI-1p0",
}


def test_param_converter_list_and_whitespace():
    assert param_converter(["  a ", "b"]) == "a"
    assert param_converter("  x ") == "x"
    assert param_converter(None) is None
    assert param_converter(5) == 5


def test_verify_valid_signature():
    signed = _sign(LAUNCH)
    assert verify_lti1p1_signature(KEY, SECRET, "POST", URL, signed) is True


def test_verify_rejects_tampered_signature():
    signed = _sign(LAUNCH)
    signed["oauth_signature"] = "AAAA" + str(signed["oauth_signature"])[4:]
    assert verify_lti1p1_signature(KEY, SECRET, "POST", URL, signed) is False


def test_verify_rejects_wrong_secret():
    signed = _sign(LAUNCH)
    assert verify_lti1p1_signature(KEY, "not-the-secret", "POST", URL, signed) is False


def test_verify_rejects_wrong_url():
    signed = _sign(LAUNCH)
    assert (
        verify_lti1p1_signature(KEY, SECRET, "POST", "https://evil.com/lti", signed)
        is False
    )


def test_verify_rejects_tampered_param():
    signed = _sign(LAUNCH)
    # Change a signed value after signing -> base string no longer matches.
    signed["custom_course_id"] = "999"
    assert verify_lti1p1_signature(KEY, SECRET, "POST", URL, signed) is False


def test_outcome_request_generates_replace_result_xml():
    req = OutcomeRequest(
        {
            "consumer_key": KEY,
            "consumer_secret": SECRET,
            "lis_outcome_service_url": "https://lms.example.com/outcomes",
            "lis_result_sourcedid": "sourced-123",
        }
    )
    req.operation = REPLACE_REQUEST
    req.score = 0.75
    xml = req.generate_request_xml()

    root = etree.fromstring(xml)
    ns = {"o": "http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0"}
    assert root.find(".//o:replaceResultRequest", ns) is not None
    assert root.find(".//o:sourcedId", ns).text == "sourced-123"
    assert root.find(".//o:resultScore/o:textString", ns).text == "0.75"


def test_outcome_request_requires_attributes():
    req = OutcomeRequest({"consumer_key": KEY})
    req.operation = REPLACE_REQUEST
    with pytest.raises(Exception):
        req.post_outcome_request()
