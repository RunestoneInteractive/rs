"""
The dash server's database engine.

``rsptx.db.sync_session`` has an engine already, but importing it runs
``rsptx.db``'s package init, which pulls in the async stack and every crud
module.  This server only needs a synchronous connection, so it builds its own
single, process-wide engine from the same settings.
"""

from sqlalchemy import create_engine

from rsptx.configuration import settings

engine = create_engine(settings._sync_database_url, **settings.sync_pool_settings)
