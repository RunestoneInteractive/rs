from types import SimpleNamespace

import pytest

import datetime

import jinja2


from rsptx.templates import core
from rsptx.templates.core import (
    course_datetime_tag,
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


# course_datetime_tag
# -------------------
# Deadlines render on the reader's own clock, so the server emits a <time>
# element carrying the UTC instant and JS rewrites the text. The text rendered
# here is the no-JS fallback and must still be correct and labelled.


def test_tag_carries_the_utc_instant_and_course_local_fallback():
    tag = str(course_datetime_tag(STORED_UTC, "America/Chicago"))
    assert 'datetime="2026-09-02T04:59:00Z"' in tag
    assert ">Sep 01, 2026 11:59 PM CDT</time>" in tag


def test_tag_marks_itself_for_localization_with_a_style():
    assert 'data-rs-localize="long"' in str(course_datetime_tag(STORED_UTC, "UTC"))
    assert 'data-rs-localize="short"' in str(
        course_datetime_tag(STORED_UTC, "UTC", style="short")
    )


def test_tag_short_style_uses_the_short_format():
    assert ">2026-09-01 23:59 CDT</time>" in str(
        course_datetime_tag(STORED_UTC, "America/Chicago", style="short")
    )


def test_tag_keeps_course_time_in_the_title():
    tag = str(course_datetime_tag(STORED_UTC, "America/Chicago"))
    assert 'title="Sep 01, 2026 11:59 PM CDT course time"' in tag


def test_tag_unknown_style_falls_back_to_long():
    assert ">Sep 01, 2026 11:59 PM CDT</time>" in str(
        course_datetime_tag(STORED_UTC, "America/Chicago", style="nonsense")
    )


def test_tag_renders_the_empty_placeholder_for_none():
    assert str(course_datetime_tag(None, "UTC")) == ""
    assert str(course_datetime_tag(None, "UTC", empty="N/A")) == "N/A"


def test_tag_escapes_the_empty_placeholder():
    assert (
        str(course_datetime_tag(None, "UTC", empty="<b>x</b>"))
        == "&lt;b&gt;x&lt;/b&gt;"
    )


def test_tag_passes_through_an_already_formatted_value():
    assert str(course_datetime_tag("Sep 01", "UTC")) == "Sep 01"


def test_tag_does_not_double_shift_an_aware_datetime():
    aware = STORED_UTC.replace(tzinfo=datetime.timezone.utc)
    assert str(course_datetime_tag(aware, "America/Chicago")) == str(
        course_datetime_tag(STORED_UTC, "America/Chicago")
    )


def test_tag_is_registered_as_a_jinja_global():
    env = get_shared_templates().env
    assert "course_datetime_tag" in env.globals
    rendered = env.from_string("{{ course_datetime_tag(d, tz) }}").render(
        d=STORED_UTC, tz="America/Chicago"
    )
    # Markup, so the element is not escaped into text.
    assert rendered.startswith("<time ")
