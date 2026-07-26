"""
Test the analytics report helpers used by the Chapter Activity report.
"""

import pandas as pd

from rsptx.admin_server_api.routers.analytics import (
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
