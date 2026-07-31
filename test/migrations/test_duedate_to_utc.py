"""Round trip for the duedate -> UTC migration (c4e8a1f7b2d9).

Runs the real ``upgrade()``/``downgrade()`` bodies against the test database
inside a transaction that is always rolled back, with a stand-in for alembic's
``op``. Postgres DDL is transactional, so the backfill table the migration
creates disappears with the rollback too.
"""

import datetime
import importlib.util
import os
import sys
from pathlib import Path

import pytest
import sqlalchemy as sa

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "migrations"
    / "versions"
    / "c4e8a1f7b2d9_duedate_to_utc.py"
)

# (label, timezone, local wall clock, expected stored UTC)
CASES = [
    ("chicago-winter", "America/Chicago", "2026-01-15 23:59:00", "2026-01-16 05:59:00"),
    ("chicago-summer", "America/Chicago", "2026-07-15 23:59:00", "2026-07-16 04:59:00"),
    ("berlin", "Europe/Berlin", "2026-03-01 12:00:00", "2026-03-01 11:00:00"),
    ("kolkata", "Asia/Kolkata", "2026-05-10 09:30:00", "2026-05-10 04:00:00"),
    ("tokyo", "Asia/Tokyo", "2026-02-01 08:00:00", "2026-01-31 23:00:00"),
    ("explicit-utc", "UTC", "2026-04-01 17:00:00", "2026-04-01 17:00:00"),
    ("null-tz", None, "2026-04-01 17:00:00", "2026-04-01 17:00:00"),
]


@pytest.fixture
def conn():
    """A connection in a transaction that is never committed."""
    url = os.environ["TEST_DBURL"]
    engine = sa.create_engine(url, future=True)
    connection = engine.connect()
    try:
        yield connection
    finally:
        connection.rollback()
        connection.close()
        engine.dispose()


@pytest.fixture
def migration(conn):
    """The migration module, with ``op`` bound to the test connection."""
    spec = importlib.util.spec_from_file_location("duedate_mig", MIGRATION)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["duedate_mig"] = mod
    spec.loader.exec_module(mod)

    class FakeOp:
        @staticmethod
        def get_bind():
            return conn

        @staticmethod
        def execute(stmt):
            return conn.execute(sa.text(stmt) if isinstance(stmt, str) else stmt)

    mod.op = FakeOp
    return mod


@pytest.fixture
def seeded(conn):
    """Insert one course per timezone plus its assignments. Returns ids."""
    ids = {}
    # The shared test database is seeded with courses that have no timezone and
    # far-future deadlines, which the live-course guard rightly objects to.
    # Give those a timezone so each test controls the precondition it is
    # actually exercising. Rolled back with everything else.
    conn.execute(
        sa.text(
            "UPDATE courses SET timezone = 'UTC' "
            " WHERE timezone IS NULL "
            "   AND id IN (SELECT course FROM assignments)"
        )
    )

    course_ids = {}
    for label, tz, local, _expected in CASES:
        if tz not in course_ids:
            course_ids[tz] = conn.execute(
                sa.text(
                    "INSERT INTO courses (course_name, base_course, timezone, "
                    "     term_start_date, login_required, allow_pairs, "
                    "     downloads_enabled, courselevel, institution) "
                    "VALUES (:n, :n, :tz, '2026-01-01', 'F', 'F', 'F', '', '') "
                    "RETURNING id"
                ),
                {"n": f"duedate-utc-test-{tz or 'null'}", "tz": tz},
            ).scalar()
        ids[label] = conn.execute(
            sa.text(
                "INSERT INTO assignments (course, name, duedate, visible, "
                "     released, from_source, points) "
                "VALUES (:c, :n, :d, 'F', 'F', 'F', 10) RETURNING id"
            ),
            {
                "c": course_ids[tz],
                "n": f"duedate-utc-test-{label}",
                "d": datetime.datetime.fromisoformat(local),
            },
        ).scalar()
    return ids, course_ids


def _duedates(conn, ids):
    rows = conn.execute(
        sa.text("SELECT id, duedate FROM assignments WHERE id = ANY(:ids)"),
        {"ids": list(ids.values())},
    ).fetchall()
    by_id = {r.id: r.duedate for r in rows}
    return {label: by_id[aid] for label, aid in ids.items()}


def test_upgrade_converts_course_local_to_utc(conn, migration, seeded):
    ids, _ = seeded
    migration.upgrade()
    after = _duedates(conn, ids)
    for label, _tz, _local, expected in CASES:
        assert after[label] == datetime.datetime.fromisoformat(expected), label


def test_upgrade_leaves_utc_and_null_timezone_courses_untouched(conn, migration, seeded):
    ids, _ = seeded
    before = _duedates(conn, ids)
    migration.upgrade()
    after = _duedates(conn, ids)
    assert after["explicit-utc"] == before["explicit-utc"]
    assert after["null-tz"] == before["null-tz"]


def test_upgrade_backfills_null_timezone_to_utc(conn, migration, seeded):
    _, course_ids = seeded
    null_course = course_ids[None]
    assert conn.execute(
        sa.text("SELECT timezone FROM courses WHERE id = :id"), {"id": null_course}
    ).scalar() is None

    migration.upgrade()

    assert (
        conn.execute(
            sa.text("SELECT timezone FROM courses WHERE id = :id"), {"id": null_course}
        ).scalar()
        == "UTC"
    )
    assert conn.execute(
        sa.text(
            "SELECT 1 FROM duedate_utc_tz_backfill WHERE course_id = :id"
        ),
        {"id": null_course},
    ).scalar() == 1


def test_upgrade_records_only_backfilled_courses(conn, migration, seeded):
    _, course_ids = seeded
    migration.upgrade()
    recorded = {
        r.course_id
        for r in conn.execute(
            sa.text("SELECT course_id FROM duedate_utc_tz_backfill")
        )
    }
    assert course_ids[None] in recorded
    # A course that already said 'UTC' must not be recorded, or the downgrade
    # would wrongly set its timezone back to NULL.
    assert course_ids["UTC"] not in recorded


def test_downgrade_restores_duedates_and_timezones(conn, migration, seeded):
    ids, course_ids = seeded
    before = _duedates(conn, ids)

    migration.upgrade()
    migration.downgrade()

    assert _duedates(conn, ids) == before
    assert conn.execute(
        sa.text("SELECT timezone FROM courses WHERE id = :id"),
        {"id": course_ids[None]},
    ).scalar() is None
    assert conn.execute(
        sa.text("SELECT timezone FROM courses WHERE id = :id"),
        {"id": course_ids["America/Chicago"]},
    ).scalar() == "America/Chicago"


def test_downgrade_drops_the_backfill_table(conn, migration, seeded):
    migration.upgrade()
    assert conn.execute(
        sa.text("SELECT to_regclass('duedate_utc_tz_backfill')")
    ).scalar() is not None
    migration.downgrade()
    assert conn.execute(
        sa.text("SELECT to_regclass('duedate_utc_tz_backfill')")
    ).scalar() is None


def test_unresolvable_timezone_on_a_course_with_assignments_is_rejected(
    conn, migration, seeded
):
    _, course_ids = seeded
    conn.execute(
        sa.text("UPDATE courses SET timezone = 'Mars/Olympus' WHERE id = :id"),
        {"id": course_ids["America/Chicago"]},
    )
    with pytest.raises(RuntimeError, match="Mars/Olympus"):
        migration.upgrade()


def test_unresolvable_timezone_on_a_course_without_assignments_does_not_block(
    conn, migration, seeded
):
    conn.execute(
        sa.text(
            "INSERT INTO courses (course_name, base_course, timezone, "
            "     term_start_date, login_required, allow_pairs, "
            "     downloads_enabled, courselevel, institution) "
            "VALUES ('duedate-utc-test-empty', 'duedate-utc-test-empty', "
            "        'Mars/Olympus', '2026-01-01', 'F', 'F', 'F', '', '')"
        )
    )
    migration.upgrade()  # must not raise


# Live courses with no timezone
# -----------------------------
# A NULL timezone is left alone and backfilled to 'UTC'. That is harmless for a
# finished course, but a course with deadlines still ahead of it would have its
# typed wall clock silently start being read as UTC. Setting the timezone first
# converts it correctly, so the migration blocks rather than let that ordering
# be got wrong.


def _add_course(conn, name, timezone, duedate):
    course_id = conn.execute(
        sa.text(
            "INSERT INTO courses (course_name, base_course, timezone, "
            "     term_start_date, login_required, allow_pairs, "
            "     downloads_enabled, courselevel, institution) "
            "VALUES (:n, :n, :tz, '2026-01-01', 'F', 'F', 'F', '', '') "
            "RETURNING id"
        ),
        {"n": name, "tz": timezone},
    ).scalar()
    conn.execute(
        sa.text(
            "INSERT INTO assignments (course, name, duedate, visible, "
            "     released, from_source, points) "
            "VALUES (:c, :n, :d, 'F', 'F', 'F', 10)"
        ),
        {"c": course_id, "n": f"{name}-assignment", "d": duedate},
    )
    return course_id


def _future():
    return datetime.datetime.now(datetime.timezone.utc).replace(
        tzinfo=None
    ) + datetime.timedelta(days=30)


def _past():
    return datetime.datetime.now(datetime.timezone.utc).replace(
        tzinfo=None
    ) - datetime.timedelta(days=30)


def test_live_course_without_a_timezone_blocks_the_upgrade(conn, migration, seeded):
    _add_course(conn, "duedate-utc-test-live-null", None, _future())

    with pytest.raises(RuntimeError, match="duedate-utc-test-live-null"):
        migration.upgrade()


def test_the_block_names_the_fix(conn, migration, seeded):
    _add_course(conn, "duedate-utc-test-live-null-2", None, _future())

    with pytest.raises(RuntimeError, match="Set courses.timezone"):
        migration.upgrade()


def test_a_finished_course_without_a_timezone_does_not_block(conn, migration, seeded):
    # The seeded null-tz course is already in the past; add another for clarity.
    _add_course(conn, "duedate-utc-test-done-null", None, _past())

    migration.upgrade()  # must not raise


def test_setting_the_timezone_lets_the_upgrade_proceed(conn, migration, seeded):
    course_id = _add_course(conn, "duedate-utc-test-fixed", None, _future())

    with pytest.raises(RuntimeError):
        migration.upgrade()

    conn.execute(
        sa.text("UPDATE courses SET timezone = 'America/Chicago' WHERE id = :id"),
        {"id": course_id},
    )

    migration.upgrade()  # must not raise


def test_the_env_override_allows_the_upgrade(conn, migration, seeded, monkeypatch):
    _add_course(conn, "duedate-utc-test-override", None, _future())
    monkeypatch.setenv(migration.ALLOW_NULL_TIMEZONE_ENV, "1")

    migration.upgrade()  # must not raise


def test_the_env_override_only_accepts_exactly_one(conn, migration, seeded, monkeypatch):
    _add_course(conn, "duedate-utc-test-override-2", None, _future())
    monkeypatch.setenv(migration.ALLOW_NULL_TIMEZONE_ENV, "yes")

    with pytest.raises(RuntimeError):
        migration.upgrade()
