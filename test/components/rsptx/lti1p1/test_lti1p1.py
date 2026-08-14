"""Unit tests for the LTI 1.1 helper component (rsptx.lti1p1).

These exercise the security-critical OAuth1 signature verification and the
outcome-request XML generation without touching the database or network.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import oauth2
import pytest
from lxml import etree

from rsptx.lti1p1 import core
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


# ---------------------------------------------------------------------------
# attempt_lti1p1_score_updates -- batched grade passback from the grading paths
#
# Before this existed, the only replaceResult Runestone ever sent was on a
# student's first launch of a released assignment, so a later regrade or manual
# override never reached the LMS.
# ---------------------------------------------------------------------------


def _assignment(released=True, points=10):
    return SimpleNamespace(id=42, points=points, released=released)


def _grade(auth_user, sourcedid="sourced-1", outcome_url="https://lms/outcomes"):
    return SimpleNamespace(
        auth_user=auth_user,
        lis_result_sourcedid=sourcedid,
        lis_outcome_url=outcome_url,
    )


def _patch_push(
    grades, lti_key=SimpleNamespace(consumer=KEY, secret=SECRET), attrs=None
):
    return (
        patch.object(core, "fetch_lti1p1_config", AsyncMock(return_value=lti_key)),
        patch.object(
            core, "fetch_all_course_attributes", AsyncMock(return_value=attrs or {})
        ),
        patch.object(
            core, "fetch_all_grades_for_assignment", AsyncMock(return_value=grades)
        ),
        patch.object(core, "send_lti1p1_grade", MagicMock()),
    )


async def test_score_updates_send_one_replace_result_per_student():
    cfg, attrs, grades, send = _patch_push([_grade(1), _grade(2, "sourced-2")])
    with cfg, attrs, grades, send as send_mock:
        sent = await core.attempt_lti1p1_score_updates(
            _assignment(), 5, [(1, 7.0), (2, 3.0)]
        )

    assert sent == 2
    # (points, score, consumer, secret, outcome_url, sourcedid)
    assert [c.args[1] for c in send_mock.call_args_list] == [7.0, 3.0]
    assert [c.args[5] for c in send_mock.call_args_list] == ["sourced-1", "sourced-2"]


async def test_credentials_and_grades_are_read_once_for_the_batch():
    cfg, attrs, grades, send = _patch_push([_grade(i) for i in range(1, 4)])
    with cfg as cfg_mock, attrs, grades as grades_mock, send:
        await core.attempt_lti1p1_score_updates(
            _assignment(), 5, [(1, 1.0), (2, 2.0), (3, 3.0)]
        )

    cfg_mock.assert_awaited_once()
    grades_mock.assert_awaited_once()


async def test_student_who_never_launched_is_skipped():
    """No sourcedid means the LMS has nowhere to put the score."""
    cfg, attrs, grades, send = _patch_push([_grade(1, sourcedid=None)])
    with cfg, attrs, grades, send as send_mock:
        sent = await core.attempt_lti1p1_score_updates(_assignment(), 5, [(1, 7.0)])

    assert sent == 0
    send_mock.assert_not_called()


async def test_nothing_is_sent_for_a_course_with_no_lti1p1_link():
    cfg, attrs, grades, send = _patch_push([_grade(1)], lti_key=None)
    with cfg, attrs, grades, send as send_mock:
        sent = await core.attempt_lti1p1_score_updates(_assignment(), 5, [(1, 7.0)])

    assert sent == 0
    send_mock.assert_not_called()


async def test_unreleased_grades_are_not_sent_unless_forced():
    cfg, attrs, grades, send = _patch_push([_grade(1)])
    with cfg, attrs, grades, send as send_mock:
        assert (
            await core.attempt_lti1p1_score_updates(
                _assignment(released=False), 5, [(1, 7.0)]
            )
            == 0
        )
        send_mock.assert_not_called()

        assert (
            await core.attempt_lti1p1_score_updates(
                _assignment(released=False), 5, [(1, 7.0)], force=True
            )
            == 1
        )


async def test_auto_update_can_be_switched_off_per_course():
    cfg, attrs, grades, send = _patch_push(
        [_grade(1)], attrs={"no_lti_auto_grade_update": "true"}
    )
    with cfg, attrs, grades, send as send_mock:
        sent = await core.attempt_lti1p1_score_updates(_assignment(), 5, [(1, 7.0)])

    assert sent == 0
    send_mock.assert_not_called()


async def test_one_students_failure_does_not_abandon_the_batch():
    cfg, attrs, grades, send = _patch_push([_grade(1), _grade(2, "sourced-2")])
    with cfg, attrs, grades, send as send_mock:
        send_mock.side_effect = [RuntimeError("LMS down"), None]
        sent = await core.attempt_lti1p1_score_updates(
            _assignment(), 5, [(1, 7.0), (2, 3.0)]
        )

    assert sent == 1
    assert send_mock.call_count == 2


def test_a_total_above_the_assignment_points_is_clamped_to_full_credit():
    """The spec only allows 0.0..1.0; an LMS rejects anything above it."""
    with patch.object(core, "OutcomeRequest") as req:
        req.return_value.post_replace_result.return_value = SimpleNamespace(
            is_success=lambda: True
        )
        core.send_lti1p1_grade(10, 12, KEY, SECRET, "https://lms/outcomes", "s-1")

    assert req.return_value.post_replace_result.call_args.args[0] == 1.0
