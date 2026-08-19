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
        # A one-student batch reads just that student's grade row rather than
        # the whole roster, so both readers have to be stubbed.
        patch.object(
            core,
            "fetch_grade",
            AsyncMock(
                side_effect=lambda uid, aid: next(
                    (g for g in grades if g.auth_user == uid), None
                )
            ),
        ),
        patch.object(core, "send_lti1p1_grade", MagicMock()),
    )


async def test_score_updates_send_one_replace_result_per_student():
    cfg, attrs, grades, one_grade, send = _patch_push(
        [_grade(1), _grade(2, "sourced-2")]
    )
    with cfg, attrs, grades, one_grade, send as send_mock:
        sent = await core.attempt_lti1p1_score_updates(
            _assignment(), 5, [(1, 7.0), (2, 3.0)]
        )

    assert sent == 2
    # (points, score, consumer, secret, outcome_url, sourcedid)
    assert [c.args[1] for c in send_mock.call_args_list] == [7.0, 3.0]
    assert [c.args[5] for c in send_mock.call_args_list] == ["sourced-1", "sourced-2"]


async def test_credentials_and_grades_are_read_once_for_the_batch():
    cfg, attrs, grades, one_grade, send = _patch_push([_grade(i) for i in range(1, 4)])
    with cfg as cfg_mock, attrs, grades as grades_mock, one_grade, send:
        await core.attempt_lti1p1_score_updates(
            _assignment(), 5, [(1, 1.0), (2, 2.0), (3, 3.0)]
        )

    cfg_mock.assert_awaited_once()
    grades_mock.assert_awaited_once()


async def test_student_who_never_launched_is_skipped():
    """No sourcedid means the LMS has nowhere to put the score."""
    cfg, attrs, grades, one_grade, send = _patch_push([_grade(1, sourcedid=None)])
    with cfg, attrs, grades, one_grade, send as send_mock:
        sent = await core.attempt_lti1p1_score_updates(_assignment(), 5, [(1, 7.0)])

    assert sent == 0
    send_mock.assert_not_called()


async def test_nothing_is_sent_for_a_course_with_no_lti1p1_link():
    cfg, attrs, grades, one_grade, send = _patch_push([_grade(1)], lti_key=None)
    with cfg, attrs, grades, one_grade, send as send_mock:
        sent = await core.attempt_lti1p1_score_updates(_assignment(), 5, [(1, 7.0)])

    assert sent == 0
    send_mock.assert_not_called()


async def test_unreleased_grades_are_not_sent_unless_forced():
    cfg, attrs, grades, one_grade, send = _patch_push([_grade(1)])
    with cfg, attrs, grades, one_grade, send as send_mock:
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
    cfg, attrs, grades, one_grade, send = _patch_push(
        [_grade(1)], attrs={"no_lti_auto_grade_update": "true"}
    )
    with cfg, attrs, grades, one_grade, send as send_mock:
        sent = await core.attempt_lti1p1_score_updates(_assignment(), 5, [(1, 7.0)])

    assert sent == 0
    send_mock.assert_not_called()


async def test_one_students_failure_does_not_abandon_the_batch():
    cfg, attrs, grades, one_grade, send = _patch_push(
        [_grade(1), _grade(2, "sourced-2")]
    )
    with cfg, attrs, grades, one_grade, send as send_mock:
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


# ---------------------------------------------------------------------------
# _resolve_course -- which course does a launch belong to?
#
# The consumer key is issued per course (course_lti_map), so that mapping wins
# over the LMS's custom_course_id, which instructors copy between courses and
# forget to update.
# ---------------------------------------------------------------------------
from contextlib import ExitStack, contextmanager  # noqa: E402

from rsptx.admin_server_api.routers import lti1p1 as lti1p1_router  # noqa: E402

LTI_RECORD = SimpleNamespace(id=7, consumer=KEY, secret=SECRET)


def _course(course_id, name=None):
    return SimpleNamespace(id=course_id, course_name=name or f"course-{course_id}")


@contextmanager
def _patch_resolve(mapped, course_by_name=None, courses_by_id=None):
    """Patch the lookups _resolve_course makes.

    ``courses_by_id`` defaults to "every id exists"; pass a dict to model a
    mapping that points at a course that has since been deleted.
    """

    async def by_id(course_id):
        if courses_by_id is None:
            return _course(course_id)
        return courses_by_id.get(course_id)

    with ExitStack() as stack:
        stack.enter_context(
            patch.object(
                lti1p1_router, "fetch_lti1p1_course_ids", AsyncMock(return_value=mapped)
            )
        )
        stack.enter_context(
            patch.object(
                lti1p1_router, "fetch_course", AsyncMock(return_value=course_by_name)
            )
        )
        stack.enter_context(
            patch.object(
                lti1p1_router, "fetch_course_by_id", AsyncMock(side_effect=by_id)
            )
        )
        yield


async def test_mapped_course_wins_over_the_lms_parameter():
    with _patch_resolve([42]):
        course, error = await lti1p1_router._resolve_course(LTI_RECORD, "999")
    assert (course.id, error) == (42, None)


async def test_mapped_course_is_used_when_the_lms_sends_nothing():
    with _patch_resolve([42]):
        course, error = await lti1p1_router._resolve_course(LTI_RECORD, None)
    assert (course.id, error) == (42, None)


async def test_falls_back_to_the_lms_parameter_when_the_key_is_unmapped():
    with _patch_resolve([]):
        course, error = await lti1p1_router._resolve_course(LTI_RECORD, "999")
    assert (course.id, error) == (999, None)


async def test_unmapped_key_accepts_a_course_name():
    with _patch_resolve([], course_by_name=_course(17)):
        course, error = await lti1p1_router._resolve_course(LTI_RECORD, "intro-cs")
    assert (course.id, error) == (17, None)


async def test_unmapped_key_with_an_unknown_course_name_is_an_error():
    with _patch_resolve([], course_by_name=None):
        course, error = await lti1p1_router._resolve_course(
            LTI_RECORD, "no-such-course"
        )
    assert course is None
    assert "no-such-course" in error


async def test_a_bad_course_name_is_survivable_when_the_key_is_mapped():
    """The mapping is what we trust, so a stale LMS name is only a warning."""
    with _patch_resolve([42], course_by_name=None):
        course, error = await lti1p1_router._resolve_course(
            LTI_RECORD, "no-such-course"
        )
    assert (course.id, error) == (42, None)


async def test_a_shared_key_is_disambiguated_by_the_lms_parameter():
    with _patch_resolve([42, 43]):
        course, error = await lti1p1_router._resolve_course(LTI_RECORD, "43")
    assert (course.id, error) == (43, None)


async def test_a_shared_key_pointing_outside_its_courses_is_an_error():
    with _patch_resolve([42, 43]):
        course, error = await lti1p1_router._resolve_course(LTI_RECORD, "99")
    assert course is None
    assert error


async def test_a_mapping_to_a_deleted_course_is_an_error():
    with _patch_resolve([42], courses_by_id={}):
        course, error = await lti1p1_router._resolve_course(LTI_RECORD, None)
    assert course is None
    assert "42" in error


# ---------------------------------------------------------------------------
# _login_or_create_user -- the launched course must stick to the user row
#
# The auth cookie carries only the username, so every later request reads the
# course off auth_user. An LTI user usually has several Runestone courses, so
# the row has to be switched to the one being launched -- and the object we hand
# back has to agree with it, because _launch_assignment validates the assignment
# against user.course_id.
# ---------------------------------------------------------------------------

USERINFO = {
    "first_name": "Jo",
    "last_name": "Doe",
    "email": "jo@example.com",
    "username": "jo@example.com",
}


@contextmanager
def _patch_login(existing_user, refreshed_user=None):
    """Patch _login_or_create_user's collaborators.

    ``fetch_user`` returns ``existing_user`` first and ``refreshed_user`` on the
    re-read that follows the course switch -- mirroring a real update_user,
    which writes the row but hands nothing back.
    """
    fetch = AsyncMock(side_effect=[existing_user, refreshed_user])
    update = AsyncMock()
    with ExitStack() as stack:
        stack.enter_context(patch.object(lti1p1_router, "fetch_user", fetch))
        stack.enter_context(patch.object(lti1p1_router, "update_user", update))
        for name in (
            "create_instructor_course_entry",
            "delete_course_instructor",
            "create_user_course_entry",
        ):
            stack.enter_context(patch.object(lti1p1_router, name, AsyncMock()))
        stack.enter_context(
            patch.object(lti1p1_router, "user_in_course", AsyncMock(return_value=True))
        )
        yield fetch, update


def _user(course_id, course_name):
    return SimpleNamespace(
        id=1,
        username=USERINFO["username"],
        course_id=course_id,
        course_name=course_name,
    )


async def test_the_launched_course_is_written_to_the_user_row():
    launched = _course(42, "cs101-fall")
    with _patch_login(_user(9, "other-course"), _user(42, "cs101-fall")) as (
        _f,
        update,
    ):
        user, _new = await lti1p1_router._login_or_create_user(
            USERINFO, launched, instructor=False
        )

    assert update.await_args.args[1] == {
        "course_id": 42,
        "course_name": "cs101-fall",
    }
    # ...and the object handed back agrees with what was written, so the
    # assignment check in _launch_assignment sees the launched course.
    assert (user.course_id, user.course_name) == (42, "cs101-fall")


async def test_a_user_already_in_the_launched_course_is_not_rewritten():
    launched = _course(42, "cs101-fall")
    with _patch_login(_user(42, "cs101-fall")) as (_f, update):
        user, _new = await lti1p1_router._login_or_create_user(
            USERINFO, launched, instructor=False
        )

    update.assert_not_awaited()
    assert (user.course_id, user.course_name) == (42, "cs101-fall")


async def test_a_renamed_course_updates_the_stored_course_name():
    """course_name is what verifyInstructor matches on, so it must track too."""
    launched = _course(42, "cs101-spring")
    with _patch_login(_user(42, "cs101-fall"), _user(42, "cs101-spring")) as (
        _f,
        update,
    ):
        user, _new = await lti1p1_router._login_or_create_user(
            USERINFO, launched, instructor=False
        )

    update.assert_awaited_once()
    assert user.course_name == "cs101-spring"


async def test_a_single_student_push_does_not_read_the_whole_roster():
    """Real-time pushes arrive one student at a time; a full-roster query on
    every scored answer would be a needless cost on the hottest path."""
    assignment = SimpleNamespace(id=42, points=10, released=True)
    grade = SimpleNamespace(
        auth_user=7,
        lis_result_sourcedid="sourcedid-7",
        lis_outcome_url="https://lms.example.com/outcomes",
    )
    with (
        patch.object(
            core,
            "fetch_lti1p1_config",
            AsyncMock(return_value=SimpleNamespace(consumer="key", secret="secret")),
        ),
        patch.object(core, "fetch_all_course_attributes", AsyncMock(return_value={})),
        patch.object(core, "fetch_grade", AsyncMock(return_value=grade)) as one_grade,
        patch.object(
            core, "fetch_all_grades_for_assignment", AsyncMock(return_value=[])
        ) as all_grades,
        patch.object(core, "send_lti1p1_grade") as send,
    ):
        sent = await core.attempt_lti1p1_score_updates(assignment, 5, [(7, 8.0)])

    assert sent == 1
    one_grade.assert_awaited_once_with(7, 42)
    all_grades.assert_not_awaited()
    assert send.call_args.args[5] == "sourcedid-7"


async def test_a_batch_still_reads_the_roster_once():
    assignment = SimpleNamespace(id=42, points=10, released=True)
    grades = [
        SimpleNamespace(
            auth_user=uid,
            lis_result_sourcedid=f"sourcedid-{uid}",
            lis_outcome_url="https://lms.example.com/outcomes",
        )
        for uid in (7, 8)
    ]
    with (
        patch.object(
            core,
            "fetch_lti1p1_config",
            AsyncMock(return_value=SimpleNamespace(consumer="key", secret="secret")),
        ),
        patch.object(core, "fetch_all_course_attributes", AsyncMock(return_value={})),
        patch.object(core, "fetch_grade", AsyncMock()) as one_grade,
        patch.object(
            core, "fetch_all_grades_for_assignment", AsyncMock(return_value=grades)
        ) as all_grades,
        patch.object(core, "send_lti1p1_grade"),
    ):
        sent = await core.attempt_lti1p1_score_updates(
            assignment, 5, [(7, 8.0), (8, 9.0)]
        )

    assert sent == 2
    all_grades.assert_awaited_once()
    one_grade.assert_not_awaited()
