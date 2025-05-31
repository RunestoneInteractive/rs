# ******************************
# |docname| - Session Management
# ******************************
# The main thing in this file is to create the auth manager and to provide a ``user_loader``
# The auth manager uses the ``user_loader`` on every route that requires authentication
# The way we do protected routes in FastAPI is to include a parameter on the endpoint
# ``user=Depends(auth_manager)`` This will cause the JWT token (provided in a cookie)
# OR in a header to be validated.  If the token is valid then the user will be looked
# up in the database using the ``load_user`` function in this file.
# see `./routers/auth.py` for more detail.

# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
from typing import Awaitable, Callable, cast, Optional

# Third-party imports
# -------------------
from fastapi import Request
from fastapi.exceptions import HTTPException
from fastapi_login import LoginManager

# Local application imports
# -------------------------
from rsptx.configuration import settings
from rsptx.db.crud import fetch_instructor_courses, fetch_user
from rsptx.db.models import AuthUserValidator


class NotAuthenticatedException(Exception):
    pass


# Note -- when we upgrade to fastapi-login >= 1.10 we can use the following
# not_authenticated_exception = NotAuthenticatedException in the constructor

class RSLoginManager(LoginManager):
    """
    Custom LoginManager class to force access token cookie to be SameSite=None so that iframe embedding and redirects from LTI tools work properly.
    """
    def set_cookie(self, response, token):
        response.set_cookie(key=self.cookie_name, value=token, httponly=True, samesite="None", secure=True)

try:
    auth_manager = RSLoginManager(
        settings.jwt_secret,
        "/auth/validate",
        use_cookie=True,
        custom_exception=NotAuthenticatedException,
    )
except:
    auth_manager = RSLoginManager(
        settings.jwt_secret,
        "/auth/validate",
        use_cookie=True,
        not_authenticated_exception=NotAuthenticatedException,
    )

auth_manager.cookie_name = "access_token"


@auth_manager.user_loader()  # type: ignore
async def _load_user(user_id: str) -> AuthUserValidator:
    """
    fetch a user object from the database. This is designed to work with the
    original web2py auth_user schema but make it easier to migrate to a new
    database by simply returning a user object.
    """
    return await fetch_user(user_id)


# The ``user_loader`` decorator doesn't propagate type hints. Fix this manually.
load_user = cast(Callable[[str], Awaitable[AuthUserValidator]], _load_user)


async def is_instructor(
    request: Request, user: Optional[AuthUserValidator] = None
) -> bool:
    """Check to see if the current user is an instructor for the current course

    :param request: The request object
    :type request: Request
    :raises HTTPException: If the user is not present, raise an exception
    :return: True if the user is an instructor, False otherwise
    :rtype: bool
    """
    if user is None:
        user = request.state.user
    if user is None:
        raise HTTPException(401)
    elif len(await fetch_instructor_courses(user.id, user.course_id)) > 0:
        return True
    else:
        return False
