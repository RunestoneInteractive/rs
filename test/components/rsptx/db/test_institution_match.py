"""
Tests for institution fuzzy matching. These exercise the pure scoring function,
so they need no database.
"""

import pytest

from rsptx.db.crud.course import institution_match_score

THRESHOLD = 0.75


def matches(needle, candidate):
    return institution_match_score(needle, candidate) >= THRESHOLD


@pytest.mark.parametrize(
    "needle,candidate",
    [
        # A bare distinctive word finds the full name -- the original bug.
        ("Luther", "Luther College"),
        ("luther", "LUTHER COLLEGE"),
        ("Luther", "Luther College, Decorah IA"),
        ("Luther College", "Luther College"),
        # Abbreviations and punctuation.
        ("Univ of Illinois", "University of Illinois"),
        ("U of Illinois", "University of Illinois"),
        ("St Olaf", "Saint Olaf College"),
        ("Texas A&M", "Texas A and M University"),
        # Acronyms.
        ("MIT", "Massachusetts Institute of Technology"),
        ("UNC", "University of North Carolina"),
        # Typos and partial names.
        ("Luthar College", "Luther College"),
        ("Nazarath", "Nazareth College"),
        ("Univ of Illinois Urbana", "University of Illinois at Urbana-Champaign"),
    ],
)
def test_matches(needle, candidate):
    assert matches(needle, candidate), institution_match_score(needle, candidate)


@pytest.mark.parametrize(
    "needle,candidate",
    [
        # The bug in the other direction: a shared generic word is not a match.
        ("Luther College", "Nazareth College"),
        ("Luther College", "Boston College"),
        ("Luther", "Nazareth College"),
        ("University of Iowa", "University of Idaho"),
        ("Michigan State University", "Ohio State University"),
        ("MIT", "Michigan Technological University"),
        ("Luther College", ""),
        ("", "Luther College"),
    ],
)
def test_non_matches(needle, candidate):
    assert not matches(needle, candidate), institution_match_score(needle, candidate)


def test_exact_outranks_longer():
    """An exact name should sort above a name that merely contains it."""
    exact = institution_match_score("Luther College", "Luther College")
    longer = institution_match_score("Luther College", "Luther College Online Academy")
    assert exact > longer


def test_unrelated_school_sharing_a_name_ranks_last():
    """
    "Luther Burbank High School" does contain everything the reader typed, so it
    stays in the results, but it must rank below the school they meant.
    """
    meant = institution_match_score("Luther College", "Luther College")
    other = institution_match_score("Luther College", "Luther Burbank High School")
    assert meant > other


def test_scores_are_bounded():
    for needle, candidate in [
        ("Luther", "Luther College"),
        ("zzz", "Luther College"),
        ("community college", "Kirkwood Community College"),
    ]:
        assert 0.0 <= institution_match_score(needle, candidate) <= 1.0
