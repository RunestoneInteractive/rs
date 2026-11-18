"""
The signed course token that carries an instructor's course to a background
callback, where there is no request to authenticate.
"""

import pytest
from itsdangerous import URLSafeTimedSerializer

from rsptx.dash_server_api.auth import CourseContext, sign_course, verify_course

CONTEXT = CourseContext("teacher", 7, "my_course", "thinkcspy")


def test_round_trip():
    assert verify_course(sign_course(CONTEXT)) == CONTEXT


def test_missing_token_is_refused():
    with pytest.raises(PermissionError):
        verify_course(None)


def test_edited_token_is_refused():
    token = sign_course(CONTEXT)
    with pytest.raises(PermissionError):
        verify_course(token[:-2] + ("A" if token[-2] != "A" else "B") + token[-1])


def test_token_signed_with_another_key_is_refused():
    # What an instructor could build to point the chart at someone else's course.
    forged = URLSafeTimedSerializer(b"not the secret", salt="dash-course-context")
    token = forged.dumps(
        {
            "username": "teacher",
            "course_id": 8,
            "course_name": "their_course",
            "base_course": "thinkcspy",
        }
    )
    with pytest.raises(PermissionError):
        verify_course(token)
