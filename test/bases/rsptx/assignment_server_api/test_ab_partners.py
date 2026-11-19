"""
Unit tests for the A/B helpers ``verbal_partners`` (who a verbal-condition
student is told to talk to), ``ab_unassigned_students`` (enrolled students the
split left out, who are told why) and ``late_ab_voters`` (students who voted
after the split ran). All are pure functions, so no DB is needed.
"""

from rsptx.assignment_server_api.routers.peer import (
    ab_unassigned_students,
    late_ab_voters,
    verbal_partners,
)


def test_verbal_partners_excludes_self_and_uses_names():
    groups = [{"amy", "bob", "cat"}]
    names = {"amy": "Amy A", "bob": "Bob B", "cat": "Cat C"}
    assert verbal_partners("amy", groups, names, {"amy", "bob", "cat"}) == [
        "Bob B",
        "Cat C",
    ]


def test_verbal_partners_combines_every_group_with_the_student():
    # amy recorded talking to bob, and dan recorded talking to amy
    groups = [{"amy", "bob"}, {"dan", "amy"}, {"eve", "fay"}]
    assert verbal_partners("amy", groups, {}, {"amy", "bob", "dan"}) == ["bob", "dan"]


def test_verbal_partners_falls_back_to_username():
    groups = [{"amy", "bob"}]
    # bob has a blank display name
    assert verbal_partners("amy", groups, {"bob": ""}, {"bob"}) == ["bob"]


def test_verbal_partners_none_recorded():
    assert verbal_partners("amy", [{"bob", "cat"}], {}, {"bob", "cat"}) == []


def test_late_voters_are_answerers_without_a_condition():
    answerers = ["amy", "bob", "late1", "late2", "prof"]
    in_experiment = {"amy", "bob", "absent_partner"}
    assert late_ab_voters(answerers, in_experiment, "prof") == ["late1", "late2"]


def test_no_late_voters():
    assert late_ab_voters(["amy", "bob"], {"amy", "bob"}, "prof") == []


def test_unassigned_students_are_enrolled_but_in_neither_condition():
    roster = ["amy", "bob", "cat", "dan", "prof"]
    assert ab_unassigned_students(roster, ["amy"], ["bob"], "prof") == [
        "cat",
        "dan",
    ]


def test_no_unassigned_students():
    assert ab_unassigned_students(["amy", "bob"], ["amy"], ["bob"], "prof") == []


def test_verbal_partners_skips_past_partners_not_voting_today():
    # cole recorded amy as a partner days ago but isn't in class today
    groups = [{"amy", "dee"}, {"cole", "amy"}]
    names = {"cole": "cole cool", "dee": "donna d"}
    assert verbal_partners("amy", groups, names, {"amy", "dee"}) == ["donna d"]


def test_verbal_partners_none_present():
    assert verbal_partners("amy", [{"amy", "cole"}], {}, {"amy"}) == []
