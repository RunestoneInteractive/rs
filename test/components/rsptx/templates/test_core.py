from types import SimpleNamespace

import pytest

import datetime

import jinja2


from rsptx.templates import core
from rsptx.templates.core import (
    format_course_datetime,
    get_shared_templates,
    install_filters,
)

# A deadline of 11:59 PM on 2026-09-01 in America/Chicago (CDT, UTC-5) is
# stored as 2026-09-02 04:59 UTC. Every case below starts from that stored
# value, so a correct conversion has to give the wall clock back.
STORED_UTC = datetime.datetime(2026, 9, 2, 4, 59)


def test_sample():
    assert core is not None


@pytest.mark.parametrize(
    ("github_url", "expected"),
    [
        (
            "https://github.com/RunestoneInteractive/thinkcspy",
            "https://github.com/RunestoneInteractive/thinkcspy",
        ),
        (None, "No GitHub repository is recorded for this book."),
    ],
)
def test_editlibrary_displays_source_repository(github_url, expected):
    templates = core.get_jinja_templates("")
    template = templates.env.get_template("author/editlibrary.html")

    rendered = template.render(
        form=[],
        book="thinkcspy",
        course=SimpleNamespace(course_name="thinkcspy"),
        github_url=github_url,
    )

    assert expected in rendered


@pytest.mark.parametrize(
    "timezone,expected",
    [
        ("America/Chicago", "Sep 01, 2026 11:59 PM CDT"),
        ("Europe/Berlin", "Sep 02, 2026 06:59 AM CEST"),
        ("Asia/Kolkata", "Sep 02, 2026 10:29 AM IST"),  # half hour offset
        ("Asia/Tokyo", "Sep 02, 2026 01:59 PM JST"),
        ("UTC", "Sep 02, 2026 04:59 AM UTC"),
    ],
)
def test_renders_stored_utc_in_the_course_timezone(timezone, expected):
    assert format_course_datetime(STORED_UTC, timezone) == expected


def test_daylight_saving_is_taken_from_the_date_not_the_zone():
    # The same course is UTC-6 in January and UTC-5 in July. Both render as
    # 11:59 PM local, which is only true if the offset comes from the date.
    winter = datetime.datetime(2026, 1, 16, 5, 59)  # 2026-01-15 23:59 CST
    summer = datetime.datetime(2026, 7, 16, 4, 59)  # 2026-07-15 23:59 CDT
    assert (
        format_course_datetime(winter, "America/Chicago") == "Jan 15, 2026 11:59 PM CST"
    )
    assert (
        format_course_datetime(summer, "America/Chicago") == "Jul 15, 2026 11:59 PM CDT"
    )


def test_a_course_with_no_timezone_is_treated_as_utc():
    # Matches the duedate migration, which backfills NULL to 'UTC'.
    assert format_course_datetime(STORED_UTC, None) == "Sep 02, 2026 04:59 AM UTC"
    assert format_course_datetime(STORED_UTC, "") == "Sep 02, 2026 04:59 AM UTC"


def test_unrecognized_timezone_falls_back_instead_of_raising():
    # courses.timezone is only validated when set through the settings UI, so a
    # bad value must not take the page down.
    assert (
        format_course_datetime(STORED_UTC, "Mars/Olympus")
        == "Sep 02, 2026 04:59 AM UTC"
    )


def test_none_renders_as_empty_string():
    assert format_course_datetime(None, "America/Chicago") == ""


def test_non_datetime_passes_through():
    # Some callers hand in a value that was already formatted upstream.
    assert format_course_datetime("Sep 01", "America/Chicago") == "Sep 01"


def test_custom_format_is_honored():
    assert (
        format_course_datetime(STORED_UTC, "America/Chicago", fmt="%Y-%m-%d %H:%M")
        == "2026-09-01 23:59 CDT"
    )


def test_show_timezone_false_omits_the_abbreviation():
    assert (
        format_course_datetime(
            STORED_UTC, "America/Chicago", fmt="%Y-%m-%d", show_timezone=False
        )
        == "2026-09-01"
    )


def test_date_only_display_still_shifts_the_day():
    # The reason date-only fields cannot skip the conversion: this deadline is
    # September 2nd in UTC but September 1st for the course.
    assert format_course_datetime(
        STORED_UTC, "America/Chicago", fmt="%Y-%m-%d", show_timezone=False
    ) != STORED_UTC.strftime("%Y-%m-%d")


def test_aware_datetime_is_not_double_shifted():
    aware = STORED_UTC.replace(tzinfo=datetime.timezone.utc)
    assert format_course_datetime(aware, "America/Chicago") == format_course_datetime(
        STORED_UTC, "America/Chicago"
    )


def test_install_filters_registers_course_datetime():
    env = jinja2.Environment()
    assert "course_datetime" not in env.filters
    install_filters(env)
    assert env.filters["course_datetime"] is format_course_datetime


def test_shared_templates_have_the_filter_registered():
    # Every server builds templates through this factory, so the filter has to
    # be present or `| course_datetime` raises at render time.
    env = get_shared_templates().env
    assert "course_datetime" in env.filters
    rendered = env.from_string("{{ d | course_datetime(tz) }}").render(
        d=STORED_UTC, tz="America/Chicago"
    )
    assert rendered == "Sep 01, 2026 11:59 PM CDT"
