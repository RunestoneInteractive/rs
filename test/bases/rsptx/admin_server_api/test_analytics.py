"""
Test the analytics report helpers used by the Chapter Activity report.
"""

import pandas as pd

from rsptx.admin_server_api.routers.analytics import (
    _format_duedate,
    _pad_with_enrolled,
    _student_label,
)


def test_student_label_matches_pivot_format():
    """The backfill label must match the label built from the log data."""
    data = pd.DataFrame(
        [{"sid": "ekussman", "first_name": "Erin", "last_name": "Kussman"}]
    )
    from_data = (
        data["last_name"] + ", " + data["first_name"] + " (" + data["sid"] + ")"
    ).iloc[0]

    assert _student_label("Kussman", "Erin", "ekussman") == from_data


def test_pad_with_enrolled_adds_missing_students():
    """A student with no recorded activity still gets a column."""
    pt = pd.DataFrame({"Kussman, Erin (ekussman)": [3, 1]}, index=["1.1", "1.2"])

    padded = _pad_with_enrolled(
        pt, ["Kussman, Erin (ekussman)", "Cline, Elijah (elijahcline)"], 0
    )

    assert list(padded.columns) == [
        "Cline, Elijah (elijahcline)",
        "Kussman, Erin (ekussman)",
    ]
    assert padded["Cline, Elijah (elijahcline)"].tolist() == [0, 0]
    # students who did work keep their counts
    assert padded["Kussman, Erin (ekussman)"].tolist() == [3, 1]


def test_pad_with_enrolled_leaves_timestamp_cells_blank():
    """Timestamp tables get a blank cell rather than a bogus 0."""
    pt = pd.DataFrame({"Kussman, Erin (ekussman)": ["2026-01-05"]}, index=["1.1"])

    padded = _pad_with_enrolled(pt, ["Cline, Elijah (elijahcline)"], None)

    assert padded["Cline, Elijah (elijahcline)"].isna().all()


def test_pad_with_enrolled_is_case_insensitively_sorted():
    """Columns come back in the same case-insensitive order the pivot uses."""
    pt = pd.DataFrame({"barnes, al (abarnes)": [1], "Adams, Bo (badams)": [2]})

    padded = _pad_with_enrolled(pt, ["Cole, Di (dcole)"], 0)

    assert list(padded.columns) == [
        "Adams, Bo (badams)",
        "barnes, al (abarnes)",
        "Cole, Di (dcole)",
    ]


def test_pad_with_enrolled_no_roster_is_a_noop():
    """An empty roster leaves the table alone (beyond column sorting)."""
    pt = pd.DataFrame({"Kussman, Erin (ekussman)": [3]})

    padded = _pad_with_enrolled(pt, [], 0)

    assert list(padded.columns) == ["Kussman, Erin (ekussman)"]
    assert padded["Kussman, Erin (ekussman)"].tolist() == [3]


# _format_duedate
# ---------------
# duedate is stored as naive UTC and these reports show a date only, so the
# value has to be shifted into the course timezone before the date is taken --
# a late-evening deadline falls on the following day in UTC.


def test_format_duedate_shifts_into_the_course_timezone():
    # 2026-09-02 04:59 UTC is 2026-09-01 in Chicago.
    stamp = pd.Timestamp("2026-09-02 04:59:00")
    assert _format_duedate(stamp, "America/Chicago") == "2026-09-01"


def test_format_duedate_without_a_timezone_stays_utc():
    stamp = pd.Timestamp("2026-09-02 04:59:00")
    assert _format_duedate(stamp, None) == "2026-09-02"


def test_format_duedate_handles_pandas_null():
    # pd.NaT is not caught by an `is None` check and would otherwise render as
    # the string "NaT".
    assert _format_duedate(pd.NaT, "America/Chicago") == ""
    assert _format_duedate(None, "America/Chicago") == ""


def test_format_duedate_omits_any_timezone_label():
    stamp = pd.Timestamp("2026-09-02 04:59:00")
    assert _format_duedate(stamp, "America/Chicago") == "2026-09-01"
    assert "CDT" not in _format_duedate(stamp, "America/Chicago")
