import json
import socket
import traceback
import os
from urllib.parse import quote

from fastapi import Request, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import ValidationError


from rsptx.auth.session import NotAuthenticatedException
from rsptx.configuration import settings
from rsptx.db.crud import create_traceback
from rsptx.logging import rslogger
from rsptx.response_helpers.core import canonical_utcnow
from rsptx.templates import template_folder


def add_exception_handlers(app):
    """
    Add exception handlers to the app
    """

    #
    # If the user supplies a timezone offset we'll store it in the RS_info cookie
    # lots of API calls need this so rather than having each process the cookie
    # we'll drop the value into request.state this will make it generally avilable
    #
    @app.middleware("http")
    async def get_session_object(request: Request, call_next) -> Response:
        """
        This middleware is called on every request.  It is used to parse the RS_info cookie
        and add information from that cookie to the request.state object. This makes it
        easier than having to manually parse the cookie in every request.

        :param request: The fastapi request object
        :type request: Request
        :param call_next: the next function in the middleware chain
        :type call_next: _type_
        :return: A response object
        :rtype: Response
        """
        tz_cookie = request.cookies.get("RS_info")
        rslogger.debug(f"In timezone middleware cookie is {tz_cookie}")
        if tz_cookie:
            try:
                vals = json.loads(tz_cookie)
                if "tz_offset" in vals:
                    request.state.tz_offset = vals["tz_offset"]
                if "timezone" in vals:
                    request.state.timezone = vals["timezone"]
                    rslogger.info(f"User timezone set to {vals['timezone']}")
            except Exception as e:
                rslogger.error(f"Failed to parse cookie data {tz_cookie} error was {e}")
        response = await call_next(request)
        return response

    # Fast API makes it very easy to handle different error types in an
    # elegant way through the use of middleware to catch particular
    # exception types. The following handles the case where the Dependency
    # is not satisfied for a user on an endpoint that requires a login.
    @app.exception_handler(NotAuthenticatedException)
    def auth_exception_handler(request: Request, exc: NotAuthenticatedException):
        """
        Handle requests from users who are not logged in.

        API clients (which send ``Accept: application/json`` or otherwise do
        not ask for HTML) receive a 401 with JSON detail.  Browser page
        requests are instead redirected to ``settings.login_url``, preserving
        the originally requested path in a ``next`` query parameter.
        """
        wants_html = "text/html" in request.headers.get("accept", "")
        if wants_html:
            rslogger.debug("User is not logged in, redirecting to login page")
            # The proxy (Caddy/nginx) strips the routing prefix (e.g. /ns)
            # before forwarding, so request.url is missing it. When the proxy
            # supplies the untouched public URI via X-Original-URI, use that so
            # the post-login redirect returns to the externally-visible URL.
            next_url = request.headers.get("x-original-uri")
            if not next_url:
                next_url = request.url.path
                if request.url.query:
                    next_url += f"?{request.url.query}"
            rslogger.debug(
                f"Redirecting to {settings.login_url}?next={quote(next_url)}"
            )
            return RedirectResponse(
                url=f"{settings.login_url}?next={quote(next_url)}",
                status_code=status.HTTP_302_FOUND,
            )

        rslogger.debug("User is not logged in, returning 401")
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=jsonable_encoder(
                {
                    "detail": "You need to be logged in to Runestone to access this resource"
                }
            ),
        )

    # See:  https://fastapi.tiangolo.com/tutorial/handling-errors/#use-the-requestvalidationerror-body
    # for more details on validation errors.
    @app.exception_handler(ValidationError)
    def level2_validation_handler(request: Request, exc: ValidationError):
        """
        Most validation errors are caught immediately, but we do some
        secondary validation when populating our xxx_answers tables
        this catches those and returns a 422
        """
        rslogger.error(exc)

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=jsonable_encoder({"detail": exc.errors()}),
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        """
        A generic handler for uncaught errors.  This will write the raw traceback info
        to a file as well as storing it in the database.
        """
        rslogger.error("UNHANDLED ERROR")
        rslogger.error(exc)
        date = canonical_utcnow().strftime("%Y_%m_%d-%I.%M.%S_%p")
        with open(f"{settings.error_path}/{date}_traceback.txt", "w") as f:
            traceback.print_tb(exc.__traceback__, file=f)
            f.write(f"Error Message: \n{str(exc)}")
        os.chmod(f"{settings.error_path}/{date}_traceback.txt", 0o766)
        # alternatively lets write the traceback info to the database!
        # TODO: get local variable information
        # find a way to get the request body without throwing an error on await request.json()
        #
        await create_traceback(exc, request, socket.gethostname())

        # browsers get HTML responses, API clients get JSON
        if "text/html" in request.headers.get("accept", ""):
            context = {
                "course": "",
                "request": request,
                "detail": str(exc),
                "timestamp": date,
            }

            templates = Jinja2Templates(directory=template_folder)
            return templates.TemplateResponse("error_page.html", context)
        else:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=jsonable_encoder({"detail": str(exc)}),
            )
