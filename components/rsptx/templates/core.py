import datetime
from pathlib import Path
from typing import Optional, Union
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import jinja2
from fastapi.templating import Jinja2Templates
from markupsafe import Markup, escape

template_folder = Path(__file__).parent.absolute()

# Assignment due dates render as a date and time with no seconds; the timezone
# abbreviation is appended separately by format_course_datetime.
DEFAULT_DATETIME_FORMAT = "%b %d, %Y %I:%M %p"

# Formats understood by both course_datetime_tag and staticAssets/js/localize-times.js.
# The Python side renders the no-JS fallback, the JS side the localized text.
DATETIME_STYLES = {
    "long": "%b %d, %Y %I:%M %p",
    "short": "%Y-%m-%d %H:%M",
}


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

    Datetimes are stored as naive UTC throughout the database. Deadlines are
    normally shown on the *reader's* clock (see ``course_datetime_tag``), so
    this is used where that is not possible or not wanted: the no-JS fallback
    text and tooltip of a ``<time>`` element, date-only instructor reports
    where a browser-local shift could move the date onto the neighbouring day,
    and anything rendered without a browser at all such as a CSV export.

    The timezone abbreviation is appended so the reader always knows which
    clock the value refers to.

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


def course_datetime_tag(
    value: Union[datetime.datetime, None],
    course_timezone: Optional[str] = None,
    style: str = "long",
    empty: str = "",
) -> Markup:
    """Render a ``<time>`` element that JS rewrites into the viewer's timezone.

    Deadlines are shown on the reader's own clock so that a student who is
    travelling -- or simply enrolled from another timezone -- never has to do
    the conversion themselves under time pressure.

    The server cannot know the browser's timezone, so the element carries the
    instant in UTC and ``staticAssets/js/localize-times.js`` rewrites the text
    on load. The text rendered here is the course-local time, which is what
    remains visible without JavaScript; the course time is also kept in the
    ``title`` so a student comparing notes with classmates or an instructor can
    still see the frame the course itself uses.

    Registered as the ``course_datetime_tag`` Jinja global::

        {{ course_datetime_tag(assignment.duedate, course.timezone) }}
    """
    if value is None:
        return Markup(escape(empty))
    if not isinstance(value, datetime.datetime):
        # Already formatted upstream -- nothing to localize.
        return Markup(escape(value))

    fmt = DATETIME_STYLES.get(style, DATETIME_STYLES["long"])
    course_text = format_course_datetime(value, course_timezone, fmt=fmt)

    stamp = (
        value
        if value.tzinfo is not None
        else value.replace(tzinfo=datetime.timezone.utc)
    )
    iso = stamp.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    return Markup(
        '<time datetime="{iso}" data-rs-localize="{style}" title="{title}">'
        "{text}</time>"
    ).format(
        iso=escape(iso),
        style=escape(style),
        title=escape(f"{course_text} course time"),
        text=escape(course_text),
    )


def install_filters(env: jinja2.Environment) -> jinja2.Environment:
    """Register Runestone's shared Jinja filters and globals on an environment."""
    env.filters["course_datetime"] = format_course_datetime
    env.globals["course_datetime_tag"] = course_datetime_tag
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
