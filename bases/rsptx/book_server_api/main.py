# *********************************
# |docname| - Define the BookServer
# *********************************
# :index:`docs to write`: notes on this design. :index:`question`: Why is there an empty module named ``dependencies.py``?
"""
Overview
--------

This module contains the main FastAPI app and the routers for the book server.

routers are used to organize the code for the book server.  
They are a way to group related routes together.  See `FastAPI Routers <https://fastapi.tiangolo.com/tutorial/bigger-applications/#routers>`_.
We define routers for the following:

* Retrieve results of questions - :mod:`rsptx.book_server_api.routers.assessment` 
* Serve book files - :mod:`rsptx.book_server_api.routers.books`
* Save activities from book interactions - :mod:`rsptx.book_server_api.routers.rslogging`
* Authentication :mod:`rsptx.book_server_api.routers.auth`
* Web Socket handling for peer instruction - :mod:`rsptx.book_server_api.routers.discuss`
* Code Coach - :mod:`rsptx.book_server_api.routers.coach`


This module also contains code for startup and shutdown events.  See `FastAPI Startup and Shutdown Events <https://fastapi.tiangolo.com/tutorial/bigger-applications/#startup-and-shutdown-events>`_.

Finally some middleware is defined here.  See `FastAPI Middleware <https://fastapi.tiangolo.com/tutorial/middleware/>`_.

Detailed Module Description
---------------------------

"""
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
from contextlib import asynccontextmanager
import datetime
import json
import os
import pathlib
import traceback
import socket

# Third-party imports
# -------------------
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from rsptx.configuration import settings
from rsptx.db.async_session import init_models, term_models
from rsptx.lp_sim_builder.feedback import init_graders
from .routers import assessment
from .routers import auth
from .routers import books
from .routers import coach
from .routers import course
from .routers import rslogging
from .routers import rsproxy
from .routers import discuss
from rsptx.auth.session import auth_manager
from rsptx.exceptions.core import add_exception_handlers
from rsptx.templates import template_folder

# FastAPI setup
# =============
# _`setting root_path`: see `root_path <root_path>`; this approach comes from `github <https://github.com/tiangolo/uvicorn-gunicorn-fastapi-docker/issues/55#issuecomment-879903517>`_.
kwargs = {}
if root_path := os.environ.get("ROOT_PATH"):
    kwargs["root_path"] = root_path

# Here is the place to put startup and shutdown logic.
# This is not for "one-time" things as this runs for every instance of worker at its
# startup and shutdown time.  For example, we don't want to initialize the database here.
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the ML model
    rslogger.info("Book Server is Starting Up")
    init_graders()
    yield
    # Clean up the ML models and release the resources
    rslogger.info("Book Server is Shutting Down")
    await term_models()


app = FastAPI(lifespan=lifespan, **kwargs)  # type: ignore

rslogger.info(f"Serving books from {settings.book_path}.\n")

# Install the auth_manager as middleware This will make the user
# part of the request ``request.state.user`` `See FastAPI_Login Advanced <https://fastapi-login.readthedocs.io/advanced_usage/>`_
auth_manager.useRequest(app)

# Routing
# -------
#
# .. _included routing:
#
# Included
# ^^^^^^^^
app.include_router(rslogging.router)
app.include_router(books.router)
app.include_router(assessment.router)
app.include_router(auth.router)
app.include_router(discuss.router)
app.include_router(coach.router)
app.include_router(course.router)
app.include_router(rsproxy.router)

# We can mount various "apps" with mount.  Anything that gets to this server with /staticAssets
# will serve staticfiles - StaticFiles class implements the same interface as a FastAPI app.
# See `FastAPI static files <https://fastapi.tiangolo.com/tutorial/static-files/>`_
# maybe we could use this inside the books router but I'm not sure...
# There is so much monkey business with nginx routing of various things with /static/ in the
# path that it is clearer to mount this at something NOT called static
# WARNING this works in a dev build but does not work in production.  Need to supply a path to a folder containing the static files.  I imagine the same is true for the templates!  The build script should use  importlib.resources to find the files and copy them.

base_dir = pathlib.Path(template_folder)
app.mount(
    "/staticAssets", StaticFiles(directory=base_dir / "staticAssets"), name="static"
)


add_exception_handlers(app)
