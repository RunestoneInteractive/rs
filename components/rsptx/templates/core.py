import datetime
from pathlib import Path
from typing import Optional, Union
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import jinja2
from fastapi.templating import Jinja2Templates

template_folder = Path(__file__).parent.absolute()

# Assignment due dates render as a date and time with no seconds; the timezone
# abbreviation is appended separately by format_course_datetime.
DEFAULT_DATETIME_FORMAT = "%b %d, %Y %I:%M %p"


def _resolve_timezone(name: Optional[str]) -> datetime.tzinfo:
    """Turn a course timezone name into a tzinfo, falling back to UTC.

    A course with no timezone is treated as UTC, matching the due date
    migration. An unrecognized name also falls back rather than raising -- a
    bad timezone string should not take a page down.
    """
    if not name:
        return datetime.timezone.utc
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return datetime.timezone.utc


def format_course_datetime(
    value: Union[datetime.datetime, None],
    course_timezone: Optional[str] = None,
    fmt: str = DEFAULT_DATETIME_FORMAT,
    show_timezone: bool = True,
) -> str:
    """Render a naive UTC datetime as wall clock time in the course timezone.

    Datetimes are stored as naive UTC throughout the database. A deadline is a
    property of the course rather than of whoever is looking at it, so it is
    displayed in the course's own timezone, with the abbreviation shown so the
    reader knows which clock it refers to.

    Registered as the ``course_datetime`` Jinja filter::

        {{ assignment.duedate | course_datetime(course.timezone) }}
    """
    if value is None:
        return ""
    if not isinstance(value, datetime.datetime):
        # Already formatted upstream, or not a datetime at all -- pass through.
        return str(value)

    if value.tzinfo is None:
        value = value.replace(tzinfo=datetime.timezone.utc)
    local = value.astimezone(_resolve_timezone(course_timezone))

    rendered = local.strftime(fmt)
    if show_timezone:
        abbreviation = local.strftime("%Z")
        if abbreviation:
            rendered = f"{rendered} {abbreviation}"
    return rendered


def install_filters(env: jinja2.Environment) -> jinja2.Environment:
    """Register Runestone's shared Jinja filters on an environment."""
    env.filters["course_datetime"] = format_course_datetime
    return env


def get_shared_templates() -> Jinja2Templates:
    """Return Jinja templates for the shared template folder.

    Use this instead of constructing ``Jinja2Templates`` directly so that
    every server gets the shared filters.
    """
    templates = Jinja2Templates(directory=template_folder)
    install_filters(templates.env)
    return templates


def get_jinja_templates(book_path: str) -> Jinja2Templates:
    """Return Jinja templates that search book-specific and shared paths."""
    loader = jinja2.ChoiceLoader(
        [
            jinja2.FileSystemLoader(book_path),
            jinja2.FileSystemLoader(template_folder),
        ]
    )
    env = jinja2.Environment(
        loader=loader,
        autoescape=jinja2.select_autoescape(["html", "xml"]),
    )
    install_filters(env)
    return Jinja2Templates(env=env)
