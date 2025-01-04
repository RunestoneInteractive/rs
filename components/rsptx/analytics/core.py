import inspect
from rsptx.db.crud import create_useinfo_entry
from rsptx.db.models import UseinfoValidation, AuthUserValidator
from rsptx.response_helpers.core import canonical_utcnow


async def log_this_function(
    user: AuthUserValidator, name: str = None, extra_data: dict = None
) -> None:
    # get the name of the current function

    # func = inspect.currentframe().f_code.co_name
    if name is None:
        caller_frame = inspect.stack()[1]
        func = caller_frame.function
    else:
        func = name

    extra = "view"
    if extra_data:
        for k, v in extra_data.items():
            extra += f"_{k}_{v}"

    log_entry = UseinfoValidation(
        timestamp=canonical_utcnow(),
        event="endpoint",
        div_id=func,
        act=extra,
        sid=user.username,
        course_id=user.course_name,
    )
    await create_useinfo_entry(log_entry)
