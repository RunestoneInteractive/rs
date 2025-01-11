#
# Decorators to help with common validations in FastAPI endpoints
#

from functools import wraps

from fastapi import HTTPException, status
from rsptx.auth.session import auth_manager, is_instructor

from rsptx.db.crud import fetch_course


def instructor_role_required():
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extracting Request and User from kwargs
            request = kwargs.get("request")
            user = await auth_manager(request)

            if (
                not user
                or not getattr(user, "id", None)
                or not getattr(user, "course_id", None)
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid user or missing attributes",
                )

            user_is_instructor = await is_instructor(request, user=user)
            if not user_is_instructor:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User is not an instructor",
                )
            # Pass the resolved user along if it is in kwargs
            if "user" in kwargs:
                kwargs["user"] = user
            # Continue execution of the original function
            return await func(*args, **kwargs)

        return wrapper

    return decorator


def with_course():
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extracting Request and User from kwargs
            request = kwargs.get("request")
            user = await auth_manager(request)

            # Checking the presence of the user and course_name
            if not user or not getattr(user, "course_name", None):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid user or missing course_name",
                )

            # Loading the course
            course = await fetch_course(user.course_name)
            if not course:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Course not found",
                )

            # Adding the course to kwargs
            kwargs["course"] = course

            # Executing the wrapped function
            return await func(*args, **kwargs)

        return wrapper

    return decorator
