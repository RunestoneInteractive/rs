import datetime
import json
import socket
import traceback
import os

from fastapi import Request, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import ValidationError


from rsptx.auth.session import auth_manager, NotAuthenticatedException
from rsptx.configuration import settings
from rsptx.db.crud import create_traceback
from rsptx.logging import rslogger
from rsptx.response_helpers.core import canonical_utcnow

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
                request.state.tz_offset = vals["tz_offset"]
                rslogger.info(f"Timzone offset: {request.state.tz_offset}")
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
        Return detail on a 401 response when user is not logged in
        """
        rslogger.debug("User is not logged in, redirecting")
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=jsonable_encoder(
                {"detail": "You need to be logged in to Runestone to access this resource"}
            ),
        )
        # If we want to redirect the user to a login page which we really do not...
        # return RedirectResponse(url=f"{settings.login_url}")

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

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=jsonable_encoder({"detail": exc}),
        )
