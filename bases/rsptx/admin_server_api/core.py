# *********************************
# |docname| - Define the AdminSErver
# *********************************
#

#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import os
import pathlib

# Third-party imports
# -------------------
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

# Local application imports
# -------------------------
from rsptx.exceptions.core import add_exception_handlers
from rsptx.templates import template_folder
from rsptx.auth.session import auth_manager

from .routers import lti1p3
from .routers import instructor

# FastAPI setup
# =============
# copied from assignment_server_api
kwargs = {}
if root_path := os.environ.get("ROOT_PATH"):
    kwargs["root_path"] = root_path
app = FastAPI(**kwargs)  # type: ignore

# Anything that gets to this server with /staticAssets gets served from the staticAssets folder
template_dir = pathlib.Path(template_folder)
app.mount(
    "/staticAssets", StaticFiles(directory=template_dir / "staticAssets"), name="static"
)
auth_manager.attach_middleware(app)


app.include_router(lti1p3.router)
app.include_router(instructor.router)

# load a common set of middleware/exception handlers
add_exception_handlers(app)
