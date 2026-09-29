"""Tests for the is_binary round-trip through the source_code crud layer.

Binary files (e.g. a compiled .jar) are stored base64 in ``main_code`` with
``is_binary`` set; text files leave it False.  This covers the crud functions
that store and fetch those rows.
"""

import pytest

from rsptx.db.crud import fetch_source_code, update_source_code

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_update_source_code_stores_is_binary(init_test_db):
    """A binary file's is_binary flag is stored and returned."""
    await update_source_code(
        acid="test_binary_jar",
        filename="helper.jar",
        course_id="test_course_1",
        main_code="UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==",
        is_binary=True,
    )
    row = await fetch_source_code(
        base_course="test_course_1",
        course_name="test_course_1",
        acid="test_binary_jar",
    )
    assert row is not None
    assert row.is_binary is True
    assert row.filename == "helper.jar"


async def test_update_source_code_defaults_text_to_false(init_test_db):
    """A plain text file keeps is_binary False."""
    await update_source_code(
        acid="test_text_file",
        filename="notes.txt",
        course_id="test_course_1",
        main_code="hello world",
    )
    row = await fetch_source_code(
        base_course="test_course_1",
        course_name="test_course_1",
        acid="test_text_file",
    )
    assert row is not None
    assert row.is_binary is False


async def test_update_source_code_changes_is_binary_on_existing_row(init_test_db):
    """Updating an existing row changes its is_binary flag."""
    await update_source_code(
        acid="test_replace_jar",
        filename="helper.jar",
        course_id="test_course_1",
        main_code="first",
    )
    await update_source_code(
        acid="test_replace_jar",
        filename="helper.jar",
        course_id="test_course_1",
        main_code="second",
        is_binary=True,
    )
    row = await fetch_source_code(
        base_course="test_course_1",
        course_name="test_course_1",
        acid="test_replace_jar",
    )
    assert row.is_binary is True
    assert row.main_code == "second"
