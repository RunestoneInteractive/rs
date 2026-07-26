# ******************************************************
# |docname| - Authentication
# ******************************************************
# Logging in and out happen on the admin server (``/admin/auth/login`` and
# ``/admin/auth/logout``); this router only carries the leftovers that other
# book-server features depend on.
#
# See:  `FastAPI Login <https://fastapi-login.readthedocs.io/advanced_usage/>`_
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
from typing import Optional

#
# Third-party imports
# -------------------
from fastapi import APIRouter, Depends, Request, Response, status  # noqa F401
from fastapi.responses import JSONResponse

# Local application imports
# -------------------------
from rsptx.auth.session import auth_manager, is_instructor
from rsptx.db.crud import (
    create_user,
    fetch_users_for_course,
    fetch_course,
    fetch_course_instructors,
)
from rsptx.db.models import AuthUserValidator
from rsptx.response_helpers.core import make_json_response

# Routing
# =======
# See `APIRouter config` for an explanation of this approach.
router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


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
