"""Round trip for the source_code is_binary migration (e5f6a7b8c9d0).

Runs the real ``upgrade()``/``downgrade()`` bodies against the test database
inside a transaction that is always rolled back, with a stand-in for alembic's
``op``. Postgres DDL is transactional, so the added column disappears with the
rollback too.
"""

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

    class FakeOp:
        @staticmethod
        def get_bind():
            return conn

        @staticmethod
        def execute(stmt):
            return conn.execute(sa.text(stmt) if isinstance(stmt, str) else stmt)

        @staticmethod
        def add_column(table, column):
            stmt = (
                f"ALTER TABLE {table} ADD COLUMN "
                f"{column.name} {str(column.type)}"
            )
            conn.execute(sa.text(stmt))

        @staticmethod
        def drop_column(table, column):
            name = column if isinstance(column, str) else column.name
            conn.execute(sa.text(f"ALTER TABLE {table} DROP COLUMN {name}"))

    mod.op = FakeOp
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
