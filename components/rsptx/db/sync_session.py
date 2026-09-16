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
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.orm import sessionmaker

# Local application imports
# -------------------------
from rsptx.configuration.core import settings, BookServerConfig, DatabaseType


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
# The single, process-wide synchronous engine. Import this rather than calling
# ``create_engine`` yourself: every call builds a *new* connection pool, and an
# engine created inside a request handler is never disposed, so its connections
# are released only when the engine is garbage collected. A handful of those per
# request is enough to exhaust pgbouncer's pool and PostgreSQL's
# ``max_connections``.
#
# ``sync_pool_settings`` is empty for SQLite, whose default pool does not accept
# these arguments.
engine = create_engine(
    settings._sync_database_url,
    connect_args=connect_args,
    **settings.sync_pool_settings,
    **extra_settings,
)
# This creates the SessionLocal class.  An actual session is an instance of this class.
sync_session = sessionmaker(engine, class_=Session, expire_on_commit=False)
