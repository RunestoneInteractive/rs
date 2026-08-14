"""
Functional tests for GET /logger/get_source_code returning is_binary.

Binary files (e.g. a compiled .jar) are stored base64 in source_code with
is_binary set; text files leave it False.  The endpoint must surface that so
the client knows to hand the contents to a server (Jobe) verbatim.
"""

import pytest

from rsptx.db.crud import update_source_code

pytestmark = pytest.mark.asyncio(loop_scope="session")

COURSE = "test_course_1"


async def test_get_source_code_returns_is_binary_for_binary(
    auth_book_client, init_test_db
):
    """A binary source_code row comes back with is_binary true."""
    await update_source_code(
        acid="endpoint_binary_jar",
        filename="helper.jar",
        course_id=COURSE,
        main_code="UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA==",
        is_binary=True,
    )
    resp = await auth_book_client.get(
        "/logger/get_source_code",
        params={"course_id": COURSE, "acid": "endpoint_binary_jar"},
    )
    assert resp.status_code == 200
    detail = resp.json()["detail"]
    assert detail["filename"] == "helper.jar"
    assert detail["file_contents"] == "UEsDBBQAAAAIAAAAAAAAAAAAAAAAAAAAAA=="
    assert detail["is_binary"] is True


async def test_get_source_code_returns_false_is_binary_for_text(
    auth_book_client, init_test_db
):
    """A plain text row comes back with is_binary false."""
    await update_source_code(
        acid="endpoint_text_file",
        filename="notes.txt",
        course_id=COURSE,
        main_code="hello world",
    )
    resp = await auth_book_client.get(
        "/logger/get_source_code",
        params={"course_id": COURSE, "acid": "endpoint_text_file"},
    )
    assert resp.status_code == 200
    detail = resp.json()["detail"]
    assert detail["filename"] == "notes.txt"
    assert detail["is_binary"] is False


async def test_get_source_code_missing_row_returns_null_is_binary(
    auth_book_client, init_test_db
):
    """A missing row yields nulls, including is_binary."""
    resp = await auth_book_client.get(
        "/logger/get_source_code",
        params={"course_id": COURSE, "acid": "endpoint_does_not_exist"},
    )
    assert resp.status_code == 200
    detail = resp.json()["detail"]
    assert detail["file_contents"] is None
    assert detail["is_binary"] is None
