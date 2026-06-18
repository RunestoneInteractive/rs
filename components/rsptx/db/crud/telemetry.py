"""CRUD helpers for anonymous usage telemetry.

The sender side (book server) uses :func:`get_or_create_instance_id`,
:func:`get_last_sent`/:func:`set_last_sent`, and the ``gather_*``/``count_*``
helpers to build a check-in payload. The receiver side (central
runestone.academy admin server) uses :func:`upsert_installation`.

None of this touches personal data, and the receiver never records the
sender's IP address -- location comes only from the self-declared region in
the payload.
"""

import datetime
import importlib.metadata
import json
import os
import uuid
from typing import List, Optional

from sqlalchemy import func, select

from ..models import Courses, Installation, Library, TelemetryState, UserCourse
from ..async_session import async_session
from rsptx.configuration import settings
from rsptx.logging import rslogger


# ---------------------------------------------------------------------------
# Sender side
# ---------------------------------------------------------------------------


async def get_or_create_instance_id() -> str:
    """Return this install's stable, anonymous instance id, creating it once.

    :return: A random UUIDv4 string that persists for the life of the install.
    :rtype: str
    """
    async with async_session.begin() as session:
        row = (await session.execute(select(TelemetryState))).scalars().first()
        if row is None:
            row = TelemetryState(instance_id=str(uuid.uuid4()), last_sent=None)
            session.add(row)
            await session.flush()
        return row.instance_id


async def get_last_sent() -> Optional[datetime.datetime]:
    """Return the time of the last successful check-in, or None if never sent."""
    async with async_session() as session:
        row = (await session.execute(select(TelemetryState))).scalars().first()
        return row.last_sent if row else None


async def set_last_sent(when: datetime.datetime) -> None:
    """Record the time of a successful check-in."""
    async with async_session.begin() as session:
        row = (await session.execute(select(TelemetryState))).scalars().first()
        if row:
            row.last_sent = when


async def gather_served_books() -> List[str]:
    """Return the list of visible base course names this install serves."""
    async with async_session() as session:
        res = await session.execute(
            select(Library.basecourse).where(Library.is_visible == True)  # noqa: E712
        )
        return [r[0] for r in res.all()]


async def count_courses() -> int:
    """Return the total number of courses on this install."""
    async with async_session() as session:
        res = await session.execute(select(func.count(Courses.id)))
        return res.scalar() or 0


async def count_enrolled_students() -> int:
    """Return the number of distinct enrolled students on this install."""
    async with async_session() as session:
        res = await session.execute(
            select(func.count(func.distinct(UserCourse.user_id)))
        )
        return res.scalar() or 0


def bucket_count(n: int) -> str:
    """Bucket a raw count into a coarse range label.

    We never report exact course/student counts -- only the bucket -- to keep
    the data non-identifying.
    """
    if n <= 0:
        return "0"
    for hi, label in (
        (10, "1-10"),
        (50, "11-50"),
        (200, "51-200"),
        (1000, "201-1000"),
        (5000, "1001-5000"),
    ):
        if n <= hi:
            return label
    return "5000+"


def _server_version() -> str:
    # Prefer the version baked into the Docker image at build time (the same
    # value the image is tagged with). This is the reliable source for the
    # prebuilt images most installs run. Fall back to the installed wheel's
    # metadata, then to "unknown".
    env_version = os.environ.get("RUNESTONE_VERSION")
    if env_version:
        return env_version
    try:
        return importlib.metadata.version("bookserver")
    except Exception:
        return "unknown"


async def build_checkin_payload() -> dict:
    """Assemble the exact (anonymous) check-in payload.

    Contains only: a random per-install id, the version, the operator's
    self-declared region/institution, the list of base courses served, and
    bucketed (never exact) course/student counts. No personal data, no IP.
    """
    return {
        "instance_id": await get_or_create_instance_id(),
        "version": _server_version(),
        "region": settings.telemetry_region,
        "institution": settings.telemetry_institution,
        "base_courses": await gather_served_books(),
        "course_count_bucket": bucket_count(await count_courses()),
        "student_count_bucket": bucket_count(await count_enrolled_students()),
    }


# ---------------------------------------------------------------------------
# Receiver side (central runestone.academy)
# ---------------------------------------------------------------------------


async def upsert_installation(payload: dict) -> None:
    """Insert or update the Installation record for an incoming check-in.

    Matched by ``instance_id``: ``first_seen`` is set once, ``last_seen`` on
    every check-in. Deliberately ignores any network/IP information -- the
    only location stored is the self-declared ``region`` in the payload.

    :param payload: The validated check-in payload.
    :type payload: dict
    """
    now = datetime.datetime.utcnow()
    base_courses = json.dumps(payload.get("base_courses", []))
    async with async_session.begin() as session:
        row = (
            (
                await session.execute(
                    select(Installation).where(
                        Installation.instance_id == payload["instance_id"]
                    )
                )
            )
            .scalars()
            .first()
        )
        if row is None:
            session.add(
                Installation(
                    instance_id=payload["instance_id"],
                    region=payload.get("region", ""),
                    version=payload.get("version", ""),
                    base_courses=base_courses,
                    course_count_bucket=payload.get("course_count_bucket", ""),
                    student_count_bucket=payload.get("student_count_bucket", ""),
                    institution=payload.get("institution", ""),
                    first_seen=now,
                    last_seen=now,
                )
            )
        else:
            row.region = payload.get("region", "")
            row.version = payload.get("version", "")
            row.base_courses = base_courses
            row.course_count_bucket = payload.get("course_count_bucket", "")
            row.student_count_bucket = payload.get("student_count_bucket", "")
            row.institution = payload.get("institution", "")
            row.last_seen = now
    rslogger.info(f"telemetry check-in recorded for instance {payload['instance_id']}")
