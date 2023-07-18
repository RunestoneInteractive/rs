# **********************************
# |docname| - Database configuration
# **********************************
# Set up database configuration in this file
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
# None.
#
# Third-party imports
# -------------------
# Use asyncio for SQLAlchemy -- see `SQLAlchemy Asynchronous I/O (asyncio) <https://docs.sqlalchemy.org/en/14/orm/extensions/asyncio.html>`_.
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.sql import select

# Local application imports
# -------------------------
from rsptx.configuration.core import settings, BookServerConfig, DatabaseType
from rsptx.logging import rslogger


if settings.database_type == DatabaseType.SQLite:
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

# The polling in `../../test/test_runestone_components.py` produces a HUGE amount of output when echo is true.
extra_settings = (
    {}
    if settings.book_server_config == BookServerConfig.test
    else dict(echo=settings.db_echo)
)
engine = create_async_engine(
    settings.database_url, connect_args=connect_args, **extra_settings
)
# This creates the SessionLocal class.  An actual session is an instance of this class.
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# This creates the base class we will use to create models
Base = declarative_base()


async def init_models():
    async with engine.begin() as conn:
        # Never, ever drop tables in a production environment!
        if (
            settings.book_server_config
            in [BookServerConfig.development, BookServerConfig.test]
            and settings.drop_tables == "Yes"
        ):
            await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


# Look for any records that violate non-null constraints. TODO: when/where should we call this? Or should it be removed?
async def check_not_null():
    rslogger.info("Searching for NOT NULL constraint violations..."),
    not_null_count = 0
    async with async_session() as session:
        for table_name, table in Base.metadata.tables.items():
            for column in table.columns:
                if not column.nullable:
                    # SQLAlchemy requires ``==`` to correctly create the query; it can't overload the ``is`` operator.
                    query = select(table).where(column == None)  # noqa: E711.
                    res = (await session.execute(query)).fetchall()
                    if res:
                        not_null_count += 1
                        rslogger.error(
                            f"Column {table_name}.{column.key} has {len(res)} NULL records, such as:"
                        )
                        for row in res[0:9]:

                            def shorten(s):
                                s = str(s)
                                return s if len(s) < 20 else f"{s[0:20]}..."

                            # The result isn't an ORM object, so use this to display it.
                            s = ", ".join(f"{k}={shorten(row[k])}" for k in row.keys())
                            rslogger.error(f"  {s}")
    rslogger.info(f"Done; found {not_null_count} columns with constraint violations.")


# If the engine isn't disposed of, then a PostgreSQL database will remain in a pseudo-locked state, refusing to drop or truncate tables (see `bookserver_session`).
async def term_models():
    await engine.dispose()


# Dependency
async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
