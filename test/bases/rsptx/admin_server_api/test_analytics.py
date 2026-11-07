"""
Test the analytics report helpers used by the Chapter Activity report.
"""

import pandas as pd

from rsptx.admin_server_api.routers import analytics
from rsptx.admin_server_api.routers.analytics import (
    _splice_states,
    _student_answer_groups,
    _question_grade_comments,
    _chapter_clause,
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


def test_chapter_clause_binds_the_label_instead_of_interpolating_it():
    """The chapter label comes from a request body, so it must not reach the SQL."""
    params = {"base_course": "fopp"}
    clause = _chapter_clause("questions.chapter", "GeneralIntro", params)

    assert clause == "and questions.chapter = %(chapter)s"
    assert params["chapter"] == "GeneralIntro"


def test_chapter_clause_passes_quotes_through_as_data():
    """A label that would have closed the old f-string quote stays a value."""
    params = {}
    clause = _chapter_clause("questions.chapter", "x' or 'a'='a", params)

    assert "or" not in clause
    assert params["chapter"] == "x' or 'a'='a"


def test_chapter_clause_for_all_adds_nothing():
    """'all' means no filter, and must not leave a stray bind parameter behind."""
    params = {"base_course": "fopp"}

    assert _chapter_clause("questions.chapter", "all", params) == ""
    assert "chapter" not in params


def test_question_grade_comments_hide_bookkeeping_words(monkeypatch):
    rows = pd.DataFrame(
        {
            "div_id": ["q1", "q2", "q3", "q4"],
            "comment": ["Nice work", "autograded", "manually graded", None],
        }
    )
    monkeypatch.setattr(analytics.pd, "read_sql_query", lambda *a, **k: rows)
    comments = _question_grade_comments("c", "s", ["q1", "q2", "q3", "q4"])
    assert comments["q1"] == "Nice work"
    assert comments["q2"] == ""
    assert comments["q3"] == ""
    assert comments["q4"] == ""


def test_question_grade_comments_without_questions_skips_the_query(monkeypatch):
    def fail(*a, **k):
        raise AssertionError("queried with no questions")

    monkeypatch.setattr(analytics.pd, "read_sql_query", fail)
    assert _question_grade_comments("c", "s", []) == {}


class _Course:
    course_name = "c"


def test_splice_states_reads_the_students_latest_and_pre_deadline_state(monkeypatch):
    calls = []

    def fake_query(sql, engine, params):
        calls.append((sql, params))
        state = '{"n": 2}' if "deadline" in sql.split("WHERE")[1] else '{"n": 3}'
        return pd.DataFrame({"answer": [state]})

    monkeypatch.setattr(analytics.pd, "read_sql_query", fake_query)
    q = {"name": "sel", "selected": "doenet1"}
    states = _splice_states(_Course(), "stu", q, deadline=pd.Timestamp("2026-01-01"))
    assert states == {"latest": {"n": 3}, "beforeDeadline": {"n": 2}}
    assert all(p["sid"] == "stu" and p["div_id"] == "doenet1" for _, p in calls)


def test_splice_states_without_answers_or_deadline(monkeypatch):
    monkeypatch.setattr(
        analytics.pd, "read_sql_query", lambda *a, **k: pd.DataFrame({"answer": []})
    )
    q = {"name": "doenet1", "selected": None}
    states = _splice_states(_Course(), "stu", q, deadline=None)
    assert states == {"latest": None, "beforeDeadline": None}


class _BookCourse:
    course_name = "c"
    base_course = "b"
    course_id = 1


def test_student_answer_groups_groups_by_subchapter_and_skips_listed_selections(
    monkeypatch,
):
    def row(name, qtype, chapter, sub, selected=None, sel_type=None):
        return {
            "name": name,
            "question_type": qtype,
            "htmlsrc": f"<div>{name}</div>",
            "chapter_name": chapter,
            "subchapter_name": sub,
            "selected_name": selected,
            "selected_htmlsrc": f"<div>{selected}</div>" if selected else None,
            "selected_type": sel_type,
        }

    rows = pd.DataFrame(
        [
            row("mc1", "mchoice", "Ch 1", "Intro"),
            row("sel1", "selectquestion", "Ch 1", "Intro", "bank1", "mchoice"),
            row("sel2", "selectquestion", "Ch 1", "Intro", "mc1", "mchoice"),
            row("ac1", "activecode", "Ch 2", "Loops"),
        ]
    )
    monkeypatch.setattr(analytics.pd, "read_sql_query", lambda *a, **k: rows)
    detail = [{"Exercise": "mc1", "Attempts": 2, "Correct": "Yes"}]

    groups = _student_answer_groups(_BookCourse(), "stu", detail)

    assert [(g["chapter"], g["subchapter"]) for g in groups] == [
        ("Ch 1", "Intro"),
        ("Ch 2", "Loops"),
    ]
    intro = groups[0]["questions"]
    # sel2 picked mc1, which the student worked on and is already listed.
    assert [q["name"] for q in intro] == ["mc1", "sel1"]
    assert intro[0]["attempts"] == 2 and intro[0]["correct"] == "Yes"
    assert intro[1]["selected"] == "bank1"
    assert intro[1]["htmlsrc"] == "<div>bank1</div>"
    assert groups[1]["questions"][0]["attempts"] == 0
