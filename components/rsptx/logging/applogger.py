"""
Configure logging for the application
=====================================

We keep the logging configuration quite simple as we want everything to go to stdout
so that the docker logs command will work.  We also want to be able to set the log level
from the environment variable ``LOG_LEVEL```.  The default is ``INFO``.
"""

#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import logging
import sys

# Third-party imports
# -------------------
# None.
#
# Local application imports
# -------------------------
# None.
#
#
# Logging
# =======
rslogger = logging.getLogger("runestone")
rslogger.setLevel(logging.DEBUG)

handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter(
    "%(levelname)s - %(asctime)s - %(filename)s - %(funcName)s:%(lineno)d - %(message)s"
)
handler.setFormatter(formatter)
rslogger.addHandler(handler)

# To turn on debugging for FastAPI and the database package:
#
# .. code:: Python
#   :number-lines:
#
#   from fastapi.logger import logger
#   import logging
#   logger.setLevel(logging.DEBUG)
#
# Otherwise, FastAPI logs at the default level.
# There is good info `here <https://medium.com/@PhilippeGirard5/fastapi-logging-f6237b84ea64>`__ on setting up logging.  There is also good info on hooking into the gunicorn logging system when you deploy `here  <https://pawamoy.github.io/posts/unify-logging-for-a-gunicorn-uvicorn-app/>`__.
