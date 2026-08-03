"""
Tests for book CRUD operations (page progress counts, chapters, subchapters).
"""

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.crud import (
    create_question,
    create_useinfo_entry,
    fetch_page_activity_counts,
)
from rsptx.db.models import QuestionValidator, UseinfoValidation
from rsptx.response_helpers.core import canonical_utcnow

COURSE = "test_course_1"
USER = "testuser1"
CHAPTER = "progress_chap"
SUBCHAPTER = "progress_sub"


async def _make_question(name: str, question_type: str, optional: bool = False):
    return await create_question(
        QuestionValidator(
            base_course=COURSE,
            name=name,
            chapter=CHAPTER,
            subchapter=SUBCHAPTER,
            author=USER,
            timestamp=canonical_utcnow(),
            question_type=question_type,
            optional=optional,
            is_private=False,
            from_source=True,
            review_flag=False,
        )
    )


@pytest.fixture(scope="session")
async def progress_page(init_test_db):
    """A page with two activities, one optional activity, and its own page row.

    The page row is what ``_add_page_question``/``addPageToDB`` write for every
    subchapter at book build time: question_type "page", named for the chapter
    and subchapter titles rather than for any div on the page.
    """
    await _make_question("progress_q1", "mchoice")
    await _make_question("progress_q2", "activecode")
    await _make_question("progress_q_optional", "mchoice", optional=True)
    await _make_question("Progress Chapter/Progress Subchapter", "page")
    await create_useinfo_entry(
        UseinfoValidation(
            timestamp=canonical_utcnow(),
            sid=USER,
            event="mChoice",
            act="answer:1",
            div_id="progress_q1",
            course_id=COURSE,
        )
    )


async def _counts():
    return await fetch_page_activity_counts(CHAPTER, SUBCHAPTER, COURSE, COURSE, USER)


async def test_page_row_is_keyed_as_page(progress_page):
    """The subchapter's own question row comes back under the key ``page``.

    PageProgressBar adds a ``page`` entry when the dict has none, so returning
    this row under its question name made it look like an extra activity and
    every page reported one more activity than it had.
    """
    counts = await _counts()
    assert "page" in counts
    assert "Progress Chapter/Progress Subchapter" not in counts


async def test_activity_count_excludes_optional_questions(progress_page):
    """Only the two required activities plus the page pseudo-activity are counted."""
    counts = await _counts()
    assert set(counts) == {"page", "progress_q1", "progress_q2"}


async def test_interacted_activities_are_marked(progress_page):
    """A div the student has a useinfo row for is 1; everything else is 0."""
    counts = await _counts()
    assert counts["progress_q1"] == 1
    assert counts["progress_q2"] == 0
    # The page row's name never appears as a useinfo div_id -- page views are
    # logged under the page's path -- so the page entry is always 0. The client
    # counts the page as attempted on its own.
    assert counts["page"] == 0
