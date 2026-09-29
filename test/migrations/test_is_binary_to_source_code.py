"""Round trip for the source_code is_binary migration (e5f6a7b8c9d0).

Runs the real ``upgrade()``/``downgrade()`` bodies against the test database
inside a transaction that is always rolled back, with a real alembic
``Operations`` bound to that connection. Postgres DDL is transactional, so the
added column disappears with the rollback too.
"""

import importlib.util
import os
import sys
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "migrations"
    / "versions"
    / "e5f6a7b8c9d0_add_is_binary_to_source_code.py"
)


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
    spec = importlib.util.spec_from_file_location("is_binary_mig", MIGRATION)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["is_binary_mig"] = mod
    spec.loader.exec_module(mod)
    mod.op = Operations(MigrationContext.configure(conn))
    return mod


def _columns(conn):
    return {
        r.column_name
        for r in conn.execute(
            sa.text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'source_code'"
            )
        )
    }


def _drop_is_binary(conn):
    """Restore the 'before migration' schema if a prior test run left it."""
    if "is_binary" in _columns(conn):
        conn.execute(sa.text("ALTER TABLE source_code DROP COLUMN is_binary"))


def test_upgrade_adds_is_binary(conn, migration):
    _drop_is_binary(conn)
    assert "is_binary" not in _columns(conn)
    migration.upgrade()
    assert "is_binary" in _columns(conn)


def test_downgrade_drops_is_binary(conn, migration):
    _drop_is_binary(conn)
    migration.upgrade()
    assert "is_binary" in _columns(conn)
    migration.downgrade()
    assert "is_binary" not in _columns(conn)


def test_upgrade_backfills_existing_rows(conn, migration):
    """An existing row reads 'F' after the upgrade, and the column is NOT NULL."""
    _drop_is_binary(conn)
    conn.execute(
        sa.text(
            "INSERT INTO source_code (acid, course_id, main_code, filename) "
            "VALUES ('pre_migration', 'test_course_1', 'x', 'x.txt')"
        )
    )

    migration.upgrade()

    assert (
        conn.execute(
            sa.text(
                "SELECT is_binary FROM source_code WHERE acid = 'pre_migration'"
            )
        ).scalar()
        == "F"
    )
    assert (
        conn.execute(
            sa.text(
                "SELECT is_nullable FROM information_schema.columns "
                "WHERE table_name = 'source_code' AND column_name = 'is_binary'"
            )
        ).scalar()
        == "NO"
    )
