"""store assignment duedate in UTC

Revision ID: c4e8a1f7b2d9
Revises: 3bfddd662428
Create Date: 2026-07-27 10:12:04.331902

``assignments.duedate`` has always been a naive datetime holding *course-local*
wall clock time, while ``visible_on``, ``hidden_on`` and every answer timestamp
are naive UTC.  This migration shifts ``duedate`` to naive UTC so the column is
consistent with the rest of the schema and no conversion is needed at grading
time.

Only courses with an explicit ``courses.timezone`` are shifted.  The column is
nullable and was added in ``8f857bdfef19`` (2025-10-07) without a backfill, so
most legacy courses are NULL and have no defensible source timezone for their
due dates.  Those rows are left byte-identical and their timezone is backfilled
to ``'UTC'``, which matches the fallback the application already used when no
timezone and no browser cookie were available.

Leaving a NULL-timezone course alone is only harmless once its deadlines have
passed.  A course still running would keep the wall clock its instructor typed
while that value starts being read as UTC, so ``upgrade()`` refuses to run
while any NULL-timezone course has a due date in the future.  Setting
``courses.timezone`` on those courses first converts them correctly along with
everyone else; doing it afterwards is far more work, because by then the due
dates are fixed instants and nothing records which zone they were meant to be
in.  Set ``DUEDATE_UTC_ALLOW_NULL_TIMEZONE=1`` to proceed anyway and have those
deadlines treated as UTC.

The ids of the courses whose timezone was backfilled are recorded in
``duedate_utc_tz_backfill`` so ``downgrade()`` can restore NULL for exactly
those courses and no others.  That table is dropped by ``downgrade()``.

``downgrade()`` recomputes the local time from the stored UTC value rather than
restoring a snapshot, so assignments created or edited after the upgrade are
converted correctly too.  The round trip is exact unless a course's timezone is
changed while the upgrade is in effect.
"""

import logging
import os
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4e8a1f7b2d9"
down_revision: Union[str, None] = "3bfddd662428"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


logger = logging.getLogger("alembic.runtime.migration")

BACKFILL_TABLE = "duedate_utc_tz_backfill"

# Escape hatch for the live-course guard below, for the case where an
# operator has decided those courses really should be treated as UTC.
ALLOW_NULL_TIMEZONE_ENV = "DUEDATE_UTC_ALLOW_NULL_TIMEZONE"

# Postgres ``AT TIME ZONE`` is direction sensitive:
#   naive timestamp  AT TIME ZONE 'zone' -> timestamptz (reads the naive value as
#                                           wall clock in 'zone')
#   timestamptz      AT TIME ZONE 'zone' -> naive timestamp (renders the instant
#                                           as wall clock in 'zone')
# so local -> UTC is (duedate AT TIME ZONE course_tz) AT TIME ZONE 'UTC'.

LOCAL_TO_UTC = sa.text(
    """
    UPDATE assignments a
       SET duedate = (a.duedate AT TIME ZONE c.timezone) AT TIME ZONE 'UTC'
      FROM courses c
     WHERE a.course = c.id
       AND a.duedate IS NOT NULL
       AND c.timezone IS NOT NULL
       AND c.timezone <> 'UTC'
    """
)

UTC_TO_LOCAL = sa.text(
    """
    UPDATE assignments a
       SET duedate = (a.duedate AT TIME ZONE 'UTC') AT TIME ZONE c.timezone
      FROM courses c
     WHERE a.course = c.id
       AND a.duedate IS NOT NULL
       AND c.timezone IS NOT NULL
       AND c.timezone <> 'UTC'
    """
)

# Only courses that actually own assignments can break the conversion, so a bad
# timezone on an empty course is not worth blocking a deploy over.
BAD_TIMEZONES = sa.text(
    """
    SELECT c.id, c.course_name, c.timezone
      FROM courses c
     WHERE c.timezone IS NOT NULL
       AND EXISTS (SELECT 1 FROM assignments a WHERE a.course = c.id)
       AND NOT EXISTS (
             SELECT 1 FROM pg_timezone_names t
              WHERE lower(t.name) = lower(c.timezone)
           )
     ORDER BY c.id
    """
)


def _assert_timezones_are_resolvable(conn) -> None:
    """Fail with an actionable message instead of a bare Postgres error.

    ``AT TIME ZONE`` aborts the whole statement on an unrecognized zone name.
    ``courses.timezone`` is validated against the IANA database when set through
    the course settings UI, but the LTI and legacy paths do not go through that
    validator, so check before touching any rows.
    """
    bad = conn.execute(BAD_TIMEZONES).fetchall()
    if bad:
        detail = ", ".join(
            f"course {r.id} ({r.course_name!r}) = {r.timezone!r}" for r in bad
        )
        raise RuntimeError(
            "Cannot convert assignment due dates to UTC: these courses have "
            f"assignments and a timezone Postgres does not recognize: {detail}. "
            "Fix or clear courses.timezone for them and re-run the migration."
        )


LIVE_NULL_TIMEZONE_COURSES = sa.text(
    """
    SELECT c.id, c.course_name, max(a.duedate) AS latest_duedate
      FROM courses c
      JOIN assignments a ON a.course = c.id
     WHERE c.timezone IS NULL
     GROUP BY c.id, c.course_name
    HAVING max(a.duedate) > (now() AT TIME ZONE 'UTC')
     ORDER BY max(a.duedate) DESC
    """
)


def _assert_no_live_courses_without_a_timezone(conn) -> None:
    """Refuse to convert a still-running course that has no timezone.

    A NULL timezone is left alone by this migration and backfilled to 'UTC',
    which is harmless for a finished course but not for one with deadlines
    still ahead of it: its due dates keep the wall clock an instructor typed
    while that value starts being read as UTC.

    Setting ``courses.timezone`` before running this migration converts those
    courses correctly along with everyone else's. Doing it afterwards is much
    more work, because by then the due dates are fixed instants and nothing
    records which zone they were meant to be in -- so block here rather than
    let the ordering be got wrong silently.

    The comparison is approximate: due dates are still course-local at this
    point, so a course is judged live to within its UTC offset. That is well
    inside the granularity this check cares about.
    """
    if os.environ.get(ALLOW_NULL_TIMEZONE_ENV) == "1":
        logger.warning(
            "%s=1: converting due dates even though some live courses have no "
            "timezone. Their deadlines will be read as UTC.",
            ALLOW_NULL_TIMEZONE_ENV,
        )
        return

    live = conn.execute(LIVE_NULL_TIMEZONE_COURSES).fetchall()
    if live:
        detail = "; ".join(
            f"course {r.id} ({r.course_name!r}) latest due {r.latest_duedate}"
            for r in live
        )
        raise RuntimeError(
            "Cannot convert assignment due dates to UTC: these courses have "
            f"deadlines in the future but no timezone set: {detail}. Set "
            "courses.timezone for them and re-run -- their due dates will then "
            "convert correctly. To proceed anyway and have their deadlines "
            f"treated as UTC, set {ALLOW_NULL_TIMEZONE_ENV}=1."
        )


def _backfill_table_exists(conn) -> bool:
    return (
        conn.execute(
            sa.text("SELECT to_regclass(:name)"), {"name": BACKFILL_TABLE}
        ).scalar()
        is not None
    )


def upgrade() -> None:
    conn = op.get_bind()

    _assert_timezones_are_resolvable(conn)
    _assert_no_live_courses_without_a_timezone(conn)

    shifted = conn.execute(LOCAL_TO_UTC).rowcount
    logger.info("duedate -> UTC: shifted %s assignment(s)", shifted)

    # Record which courses we are about to backfill so the downgrade can put
    # NULL back for exactly those, and not for courses that already said 'UTC'.
    conn.execute(
        sa.text(
            f"CREATE TABLE IF NOT EXISTS {BACKFILL_TABLE} "
            "(course_id integer PRIMARY KEY)"
        )
    )
    conn.execute(
        sa.text(
            f"INSERT INTO {BACKFILL_TABLE} (course_id) "
            "SELECT id FROM courses WHERE timezone IS NULL "
            "ON CONFLICT (course_id) DO NOTHING"
        )
    )
    backfilled = conn.execute(
        sa.text("UPDATE courses SET timezone = 'UTC' WHERE timezone IS NULL")
    ).rowcount
    logger.info("duedate -> UTC: backfilled timezone on %s course(s)", backfilled)


def downgrade() -> None:
    conn = op.get_bind()

    _assert_timezones_are_resolvable(conn)

    # Restore NULL first, so those courses are excluded from the conversion
    # below exactly as they were excluded on the way up.
    if _backfill_table_exists(conn):
        restored = conn.execute(
            sa.text(
                "UPDATE courses SET timezone = NULL "
                f"WHERE id IN (SELECT course_id FROM {BACKFILL_TABLE})"
            )
        ).rowcount
        logger.info(
            "duedate -> local: restored NULL timezone on %s course(s)", restored
        )
    else:
        logger.warning(
            "%s is missing; leaving courses.timezone as-is. Due dates will still "
            "be converted back to course-local time.",
            BACKFILL_TABLE,
        )

    shifted = conn.execute(UTC_TO_LOCAL).rowcount
    logger.info("duedate -> local: shifted %s assignment(s)", shifted)

    op.execute(f"DROP TABLE IF EXISTS {BACKFILL_TABLE}")
