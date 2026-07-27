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

The ids of the courses whose timezone was backfilled are recorded in
``duedate_utc_tz_backfill`` so ``downgrade()`` can restore NULL for exactly
those courses and no others.  That table is dropped by ``downgrade()``.

``downgrade()`` recomputes the local time from the stored UTC value rather than
restoring a snapshot, so assignments created or edited after the upgrade are
converted correctly too.  The round trip is exact unless a course's timezone is
changed while the upgrade is in effect.
"""

import logging
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
