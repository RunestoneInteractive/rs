"""
Tests for the question_type -> answer table mapping.

A type missing from the map has no answer table, which means its answers are
invisible to the grader and skipped by a re-grade (issue #1250: doenet and
builder-created iframe questions were missing).
"""

import pytest

from rsptx.grading_helpers.answer_tables import (
    IFRAME_QUESTION_TYPES,
    QTYPE_TO_TABLE,
    answer_table_for,
)


@pytest.mark.parametrize(
    "question_type,expected_table",
    [
        # Everything embedded in a SPLICE-speaking iframe shares one table,
        # matching what the SpliceWrapper logs and what legacy rs_grading did.
        ("splice", "splice_answers"),
        ("doenet", "splice_answers"),
        ("iframe", "splice_answers"),
        ("webwork", "webwork_answers"),
        ("mchoice", "mchoice_answers"),
        ("activecode", "unittest_answers"),
    ],
)
def test_answer_table_for_known_types(question_type, expected_table):
    model, table_name = answer_table_for(question_type)
    assert table_name == expected_table
    assert model is not None
    assert model.__tablename__ == expected_table


def test_answer_table_for_unknown_type():
    assert answer_table_for("no-such-type") == (None, None)


def test_every_iframe_type_is_mapped():
    """The grader renders these as an embedded activity; each still needs a
    table or there would be no attempt history to replay into it."""
    for question_type in IFRAME_QUESTION_TYPES:
        assert QTYPE_TO_TABLE.get(question_type) == "splice_answers"


def test_every_mapped_table_resolves_to_a_model():
    """A typo in a table name would silently disable that question type."""
    for question_type in QTYPE_TO_TABLE:
        model, table_name = answer_table_for(question_type)
        assert model is not None, f"{question_type} -> {table_name} has no model"


def test_grader_and_regrade_share_one_map():
    """Both readers must agree; they used to keep separate copies that drifted."""
    from rsptx.assignment_server_api.routers import grader
    from rsptx.grading_helpers import regrade

    assert regrade.QTYPE_TO_TABLE is QTYPE_TO_TABLE
    assert grader._answer_table_for("doenet") is answer_table_for("doenet")[0]
