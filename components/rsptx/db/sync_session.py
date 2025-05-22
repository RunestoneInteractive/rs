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
engine = create_engine(
    settings._sync_database_url, connect_args=connect_args, **extra_settings
)
# This creates the SessionLocal class.  An actual session is an instance of this class.
sync_session = sessionmaker(engine, class_=Session, expire_on_commit=False)
