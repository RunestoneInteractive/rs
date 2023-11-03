# *********************************
# |docname| - Define the BookServer
# *********************************
# :index:`docs to write`: notes on this design. :index:`question`: Why is there an empty module named ``dependencies.py``?
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
from .routers import student
from .routers import instructor
from rsptx.configuration import settings
from rsptx.exceptions.core import add_exception_handlers
from rsptx.logging import rslogger
from rsptx.templates import template_folder

# FastAPI setup
# =============
# _`setting root_path`: see `root_path <root_path>`; this approach comes from `github <https://github.com/tiangolo/uvicorn-gunicorn-fastapi-docker/issues/55#issuecomment-879903517>`_.
kwargs = {}
if root_path := os.environ.get("ROOT_PATH"):
    kwargs["root_path"] = root_path
app = FastAPI(**kwargs)  # type: ignore
rslogger.info(f"Serving books from {settings.book_path}.\n")


# We can mount various "apps" with mount.  Anything that gets to this server with /staticAssets
# will serve staticfiles - StaticFiles class implements the same interface as a FastAPI app.
# See `FastAPI static files <https://fastapi.tiangolo.com/tutorial/static-files/>`_
# maybe we could use this inside the books router but I'm not sure...
# There is so much monkey business with nginx routing of various things with /static/ in the
# path that it is clearer to mount this at something NOT called static
# WARNING this works in a dev build but does not work in production.  Need to supply a path to a folder containing the static files.  I imagine the same is true for the templates!  The build script should use  pkg_resources to find the files and copy them.
# staticdir = pkg_resources.resource_filename("book_server_api", "staticAssets")
base_dir = pathlib.Path(template_folder)
app.mount(
    "/staticAssets", StaticFiles(directory=base_dir / "staticAssets"), name="static"
)


app.include_router(student.router)
app.include_router(instructor.router)

# DRY: this is the same as in book_server_api and other servers
# load a common set of middleware/exception handlers.
add_exception_handlers(app)
