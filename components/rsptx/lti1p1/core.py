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
import asyncio
from typing import List, Optional, Tuple

# Third-party imports
# -------------------
import oauth2

# Local application imports
# -------------------------
from rsptx.db.crud import (
    fetch_all_course_attributes,
    fetch_all_grades_for_assignment,
    fetch_grade,
    fetch_lti1p1_config,
)
from rsptx.db.models import AssignmentValidator
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
    if pct > 1.0:
        # A total can exceed the assignment's points when the questions add up to
        # more than ``assignment.points`` (or a threshold rule awards full
        # credit). The spec only allows 0.0..1.0 and the LMS rejects anything
        # above it, so clamp -- the mismatch is an authoring problem to fix on
        # the assignment, not here.
        rslogger.warning(
            f"LTI1.1 - clamping grade fraction {pct} to 1.0 "
            f"(score={score} points={assignment_points})"
        )
        pct = 1.0
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


async def attempt_lti1p1_score_updates(
    assignment: AssignmentValidator,
    course_id: int,
    updates: List[Tuple[int, Optional[float]]],
    force: bool = False,
) -> int:
    """Push a batch of scores back to an LTI 1.1 consumer.

    ``updates`` is a list of ``(rs_user_id, score)`` pairs. The per-course
    consumer key/secret and the whole assignment's ``grades`` rows are each read
    once for the batch rather than per student -- the identifiers this needs
    (``lis_result_sourcedid``/``lis_outcome_url``) live on the grade row and are
    recorded when the student launches the assignment from the LMS.

    Returns the number of scores actually sent. Students with no recorded
    passback identifiers (never launched through the LMS, or enrolled directly)
    are skipped, as is the whole batch when the course is not linked to an LTI
    1.1 consumer.

    Mirrors the release/auto-update gating of the LTI 1.3 path: nothing is sent
    for an unreleased assignment, or when the course sets
    ``no_lti_auto_grade_update``, unless ``force`` is set.

    NOTE: the underlying ``replaceResult`` POST is blocking (oauth2/httplib2),
    so each send is handed to a worker thread. Sends are still serialized; a
    roster-sized batch should be dispatched off the request path.
    """
    if not updates:
        return 0

    lti_key = await fetch_lti1p1_config(course_id)
    if not lti_key:
        return 0

    course_attributes = await fetch_all_course_attributes(course_id)
    if (
        not assignment.released
        or course_attributes.get("no_lti_auto_grade_update") == "true"
    ) and not force:
        rslogger.debug(
            f"LTI1.1 - not sending scores for assignment {assignment.id}: "
            f"released={assignment.released} force={force}"
        )
        return 0

    # The passback identifiers live on the grade row. Reading the whole
    # assignment's grades is the cheap way to get them for a roster-sized batch,
    # but real-time pushes arrive one student at a time -- fetching every
    # student's grade to read one of them would put a full-roster query on the
    # path of every scored answer.
    if len(updates) == 1:
        grade = await fetch_grade(updates[0][0], assignment.id)
        grade_map = {grade.auth_user: grade} if grade else {}
    else:
        grades = await fetch_all_grades_for_assignment(assignment.id)
        grade_map = {g.auth_user: g for g in grades}

    sent = 0
    for rs_user_id, score in updates:
        grade = grade_map.get(rs_user_id)
        if not grade or not grade.lis_result_sourcedid or not grade.lis_outcome_url:
            rslogger.debug(
                f"LTI1.1 - skipping score update on assignment {assignment.id} "
                f"for user {rs_user_id}: no grade passback identifiers recorded"
            )
            continue
        try:
            await asyncio.to_thread(
                send_lti1p1_grade,
                assignment.points,
                score,
                lti_key.consumer,
                lti_key.secret,
                grade.lis_outcome_url,
                grade.lis_result_sourcedid,
            )
            sent += 1
        except Exception as e:
            # One student's LMS failure must not abandon the rest of the batch.
            rslogger.error(
                f"LTI1.1 - grade passback failed for user {rs_user_id} on "
                f"assignment {assignment.id}: {e}"
            )
    rslogger.debug(
        f"LTI1.1 - sent {sent} of {len(updates)} score updates for "
        f"assignment {assignment.id}"
    )
    return sent
