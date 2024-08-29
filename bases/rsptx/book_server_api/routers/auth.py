# ******************************************************
# |docname| - Validation and Authentication
# ******************************************************
# Provide a login page and validation endpoint to allow a student to login to the
# Runestone book server.  This assumes that a student has registered using the
# old web2py registration system.  So we provide validation of the user name and
# password.
#
# See:  `FastAPI Login <https://fastapi-login.readthedocs.io/advanced_usage/>`_
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
from datetime import timedelta
from typing import Optional, Annotated

#
# Third-party imports
# -------------------
from fastapi import APIRouter, Depends, Request, Response, status  # noqa F401
from fastapi_login.exceptions import InvalidCredentialsException
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from pydal.validators import CRYPT
from pydantic import StringConstraints

# Local application imports
# -------------------------
from rsptx.auth.session import load_user, auth_manager, is_instructor
from rsptx.logging import rslogger
from rsptx.configuration import settings
from rsptx.db.crud import (
    create_user,
    fetch_users_for_course,
    fetch_course,
    fetch_course_instructors,
)
from rsptx.db.models import AuthUserValidator
from ..localconfig import local_settings
from rsptx.response_helpers.core import make_json_response

# Routing
# =======
# See `APIRouter config` for an explanation of this approach.
router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

templates = Jinja2Templates(
    directory=f"{local_settings._book_server_path}/templates{router.prefix}"
)


# .. _login:
#
# login
# -----
@router.get("/login", response_class=HTMLResponse)
def login_form(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@router.post("/validate")
async def login(
    data: OAuth2PasswordRequestForm = Depends(),
):  # , response_class=RedirectResponse
    # ideally we would put back the response_class parameter but its
    # just a hint to the doc system and right now causing the docs
    # to crash.  Added to an issue for FastAPI on github.
    # ):
    """
    This is called as the result of a login form being submitted.
    If authentication is successful an access token is created and stored
    in a session cookie.  This session cookie is used for all protected routes.
    The ``auth_manager`` is provided by `../session.py` which also explains how
    to setup a protected route.
    """
    username = data.username
    password = data.password

    rslogger.debug(f"username = {username}")
    user = await load_user(username)
    rslogger.debug(user)
    # um = UserManagerWeb2Py()
    if not user:
        # raise InvalidCredentialsException
        return RedirectResponse("/auth/login")
    else:
        rslogger.debug(f"Got a user {user.username} check password")
        # The password in the web2py database is formatted as follows:
        # alg$salt$hash
        # We need to grab the salt and provide that to the CRYPT function
        # which we import from pydal for now.  Once we are completely off of
        # web2py then this will change. The ``web2py_private_key`` is an environment
        # variable that comes from the ``private/auth.key`` file.
        salt = user.password.split("$")[1]
        crypt = CRYPT(key=settings.web2py_private_key, salt=salt)
        crypted_password = str(crypt(password)[0])
        if crypted_password != user.password:
            raise InvalidCredentialsException

    access_token = auth_manager.create_access_token(
        data={"sub": user.username}, expires=timedelta(hours=12)
    )
    redirect_to = f"/books/published/{user.course_name}/index.html"
    rslogger.debug(f"Sending user to {redirect_to}")
    response = RedirectResponse(redirect_to)
    # *Important* We need to set the cookie here for the redirect in order for
    # the next page to validate.  This will also set the cookie in the browser
    # for future pages.
    auth_manager.set_cookie(response, access_token)
    return response


# To log out, simply delete the cookie containing auth information.
@router.get("/logout")
async def logout(response_class: RedirectResponse):
    # Send the user to the login page after the logout.
    response = RedirectResponse("/auth/login")
    response.delete_cookie(auth_manager.cookie_name)
    return response


# todo: Write a second version of validate that returns the token as json
# this can be used by the docs/testing system.


@router.post("/newuser")
async def register(user: AuthUserValidator) -> Optional[AuthUserValidator]:
    res = await create_user(user)
    return res


@router.get("/course_students")
async def get_course_students(
    request: Request,
    user: AuthUserValidator = Depends(auth_manager),
    response_class=JSONResponse,
):
    """
    Get a list of students in a course.
    This is used by the group submission feature.

    """  
    course = await fetch_course(user.course_name)
    if course.course_name == course.base_course:
        user_is_instructor = await is_instructor(request, user=user)
        if not user_is_instructor:
            return make_json_response(
                status=status.HTTP_401_UNAUTHORIZED, detail="not an instructor"
            )

    students = await fetch_users_for_course(course.course_name)
    instructors = await fetch_course_instructors(course.course_name)
    iset = set()
    for i in instructors:
        iset.add(i.id)

    searchdict = {}
    for row in students:
        if row.id not in iset:
            name = row.first_name + " " + row.last_name
            username = row.username
            searchdict[str(username)] = name

    return make_json_response(
        status=status.HTTP_200_OK,
        detail={"students": searchdict},
    )

