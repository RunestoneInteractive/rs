"""Opaque, assignment-scoped student references for blind grading."""

import base64
import hashlib
import hmac

from rsptx.configuration import settings


def student_grading_token(*, course_id: int, assignment_id: int, sid: str) -> str:
    """Return a stable token that does not disclose the student's username."""

    secret = settings.jwt_secret
    if isinstance(secret, str):
        secret = secret.encode("utf-8")
    message = f"blind-grading\0{course_id}\0{assignment_id}\0{sid}".encode()
    digest = hmac.new(secret, message, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
