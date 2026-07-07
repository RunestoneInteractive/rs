# ****************************************
# |docname| - LTI 1.1 core helper routines
# ****************************************
#
# OAuth1 signature verification for incoming launches and grade passback
# (replaceResult) for outgoing scores.  These are plain functions with no web
# framework or web2py dependencies so they can be unit tested and reused by the
# admin and assignment servers.

# Imports
# =======
# Standard library
# ----------------
from typing import Optional

# Third-party imports
# -------------------
import oauth2

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from .outcome_request import OutcomeRequest, OutcomeResponse


def param_converter(param):
    """
    Some LMSes (notably Canvas) send URL query parameters twice, so web2py
    surfaces them as a list like ``[23, 23]``.  Take the first element and strip
    surrounding whitespace.
    """
    res = param[0] if isinstance(param, list) else param
    if isinstance(res, str):
        res = res.strip()
    return res


def verify_lti1p1_signature(
    consumer_key: str,
    consumer_secret: str,
    method: str,
    url: str,
    params: dict,
    query_string: str = "",
) -> bool:
    """
    Verify the OAuth1 signature of an LTI 1.1 launch request.

    :param consumer_key: the oauth_consumer_key expected for this course
    :param consumer_secret: the shared secret for that key
    :param method: the HTTP method of the launch request (normally ``POST``)
    :param url: the fully-qualified launch URL (no query string) exactly as the
        LMS signed it -- must match scheme/host/path the consumer used
    :param params: all launch parameters (form + query), including the oauth_* fields
    :param query_string: the raw query string, if any
    :return: True if the signature validates, False otherwise
    """
    oauth_server = oauth2.Server()
    oauth_server.add_signature_method(oauth2.SignatureMethod_PLAINTEXT())
    oauth_server.add_signature_method(oauth2.SignatureMethod_HMAC_SHA1())

    oauth_request = oauth2.Request.from_request(
        method,
        url,
        headers=None,
        parameters=params,
        query_string=query_string,
    )
    if oauth_request is None:
        return False
    # The signed keys are bytes, but the oauth2 Request constructor coerces
    # everything to str, so they never compare equal unless we re-encode.
    if isinstance(oauth_request.get("oauth_signature"), str):
        oauth_request["oauth_signature"] = oauth_request["oauth_signature"].encode(
            "utf-8"
        )
    consumer = oauth2.Consumer(consumer_key, consumer_secret)
    try:
        oauth_server.verify_request(oauth_request, consumer, None)
        return True
    except oauth2.Error as err:
        rslogger.error(f"LTI1.1 OAuth validation failed: {err}")
        return False


def send_lti1p1_grade(
    assignment_points: float,
    score: Optional[float],
    consumer: str,
    secret: str,
    outcome_url: str,
    result_sourcedid: str,
) -> OutcomeResponse:
    """
    Send an LTI 1.1 grade back to the LMS via a signed replaceResult request.
    The LMS expects a fraction between 0.0 and 1.0.

    Ported from ``rs_grading.send_lti_grade`` in the web2py server.
    """
    pct = score / float(assignment_points) if score and assignment_points else 0.0
    request = OutcomeRequest(
        {
            "consumer_key": consumer,
            "consumer_secret": secret,
            "lis_outcome_service_url": outcome_url,
            "lis_result_sourcedid": result_sourcedid,
        }
    )
    resp = request.post_replace_result(pct)
    rslogger.debug(f"LTI1.1 grade passback pct={pct} success={resp.is_success()}")
    return resp
