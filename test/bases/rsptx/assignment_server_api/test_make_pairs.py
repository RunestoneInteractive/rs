"""
Unit tests for ``split_ab_conditions`` — the verbal-cluster / A-B condition
splitting helper extracted from ``make_pairs``.

The helper is a pure function (no DB, no async), so these tests import it
directly and pass a seeded ``random.Random`` for deterministic results.
"""

import random

from rsptx.assignment_server_api.routers.peer import split_ab_conditions


def _group_of(sid, peeps_in_person, peeps_in_chat):
    """Return 'person', 'chat', or None for where ``sid`` landed."""
    if sid in peeps_in_person:
        return "person"
    if sid in peeps_in_chat:
        return "chat"
    return None


def _assert_partition(answerers, in_person_groups, peeps_in_person, peeps_in_chat):
    """Common invariants: the result is a disjoint partition with no dups, and
    every answerer is placed somewhere."""
    assert not (
        set(peeps_in_person) & set(peeps_in_chat)
    ), "conditions must be disjoint"
    assert len(peeps_in_person) == len(set(peeps_in_person)), "no dup in person"
    assert len(peeps_in_chat) == len(set(peeps_in_chat)), "no dup in chat"
    for a in answerers:
        assert _group_of(a, peeps_in_person, peeps_in_chat) is not None


def test_singletons_go_to_chat():
    """Students with no recorded verbal partner can only go to text chat."""
    answerers = ["A", "B"]
    person, chat = split_ab_conditions(answerers, [], rng=random.Random(0))
    assert person == []
    assert sorted(chat) == ["A", "B"]


def test_nonvoting_partner_kept_in_same_condition():
    """A recorded verbal partner who did not vote is still assigned the same
    condition as the voter, never split into text chat."""
    answerers = ["A"]  # B is in A's verbal group but did not vote
    in_person_groups = [{"A", "B"}]
    person, chat = split_ab_conditions(
        answerers, in_person_groups, rng=random.Random(0)
    )
    # A single multi-person cluster: both land in the verbal condition together.
    assert sorted(person) == ["A", "B"]
    assert chat == []
    assert _group_of("A", person, chat) == _group_of("B", person, chat)


def test_verbal_partners_share_a_condition():
    """Every member of a recorded verbal group ends up in the same condition."""
    in_person_groups = [{"A", "B"}, {"C", "D"}]
    answerers = ["A", "B", "C", "D"]
    person, chat = split_ab_conditions(
        answerers, in_person_groups, rng=random.Random(1)
    )
    _assert_partition(answerers, in_person_groups, person, chat)
    for grp in in_person_groups:
        conditions = {_group_of(s, person, chat) for s in grp}
        assert len(conditions) == 1, f"group {grp} was split across conditions"


def test_overlapping_groups_stay_disjoint():
    """Overlapping recorded groups must not duplicate a student across clusters
    or conditions (the ``grp -= clustered`` guard)."""
    in_person_groups = [{"A", "B"}, {"B", "C"}]
    answerers = ["A", "B", "C"]
    person, chat = split_ab_conditions(
        answerers, in_person_groups, rng=random.Random(2)
    )
    _assert_partition(answerers, in_person_groups, person, chat)
    assert sorted(person + chat) == ["A", "B", "C"]
    # A and B were seeded together; they must share a condition.
    assert _group_of("A", person, chat) == _group_of("B", person, chat)


def test_at_least_one_in_each_condition_when_possible():
    """With two multi-person clusters, both conditions are populated."""
    in_person_groups = [{"A", "B"}, {"C", "D"}]
    answerers = ["A", "B", "C", "D"]
    person, chat = split_ab_conditions(
        answerers, in_person_groups, rng=random.Random(3)
    )
    assert person, "verbal condition should not be empty"
    assert chat, "chat condition should not be empty"


def test_single_multi_cluster_not_left_chat_only():
    """A lone multi-person cluster seeds the verbal side rather than going to
    chat, so the verbal condition is never empty when it could be populated."""
    in_person_groups = [{"A", "B", "C"}]
    answerers = ["A", "B", "C"]
    person, chat = split_ab_conditions(
        answerers, in_person_groups, rng=random.Random(4)
    )
    assert sorted(person) == ["A", "B", "C"]
    assert chat == []


def test_balanced_split_across_many_groups():
    """Greedy placement keeps the two conditions roughly balanced in size."""
    in_person_groups = [{f"s{i}", f"s{i}b"} for i in range(10)]
    answerers = [s for grp in in_person_groups for s in grp]
    person, chat = split_ab_conditions(
        answerers, in_person_groups, rng=random.Random(5)
    )
    _assert_partition(answerers, in_person_groups, person, chat)
    # 10 two-person clusters, 20 students; greedy keeps the halves within one
    # cluster (2 students) of each other.
    assert abs(len(person) - len(chat)) <= 2


def test_deterministic_with_seeded_rng():
    """Same inputs + same seed produce identical output."""
    in_person_groups = [{"A", "B"}, {"C", "D"}, {"E"}]
    answerers = ["A", "B", "C", "D", "E"]
    r1 = split_ab_conditions(answerers, in_person_groups, rng=random.Random(7))
    r2 = split_ab_conditions(answerers, in_person_groups, rng=random.Random(7))
    assert r1 == r2


def test_empty_input():
    """No answerers yields two empty conditions."""
    person, chat = split_ab_conditions([], [], rng=random.Random(0))
    assert person == []
    assert chat == []
