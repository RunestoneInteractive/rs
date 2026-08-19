"""
Tests for cross-course assignment sharing and import.

A course's assignments are discoverable outside it only when the course has
opted in on its Course Settings page, or when the course is a book -- a book's
material needs no opt-in. Importing one copies the assignment into the target
course and links its exercises where they already live -- the same thing adding an
exercise from another course does. Readings do not survive a change of book,
so a cross-book import leaves them behind.
"""

import datetime
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from zoneinfo import ZoneInfo  # noqa: E402

from rsptx.db.crud import (  # noqa: E402
    create_assignment,
    create_assignment_question,
    create_course,
    create_course_attribute,
    create_instructor_course_entry,
    create_question,
    fetch_course,
    import_assignment,
    import_course_assignments,
    search_assignments,
    search_shareable_courses,
    fetch_assignment_for_preview,
    fetch_shareable_assignment_tree,
    term_start_utc,
)
from rsptx.db.crud.user import create_user  # noqa: E402
from rsptx.db.models import (  # noqa: E402
    Assignment,
    AssignmentQuestionValidator,
    AssignmentValidator,
    AuthUserValidator,
    CoursesValidator,
    Question,
    QuestionValidator,
)
from rsptx.db.async_session import async_session  # noqa: E402
from rsptx.validation.schemas import AssignmentsSearchRequest  # noqa: E402
from rsptx.response_helpers.core import canonical_utcnow  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from sqlalchemy import func, select, update  # noqa: E402

SRC_COURSE = "sharing_src_course"
DST_COURSE = "sharing_dst_course"
SAME_BOOK_COURSE = "sharing_same_book_course"
CLOSED_COURSE = "sharing_closed_course"
SRC_BOOK = "thinkcspy"
DST_BOOK = "fopp"
CHICAGO = "America/Chicago"


async def _make_course(name, base_course, term_start, timezone=None):
    await create_course(
        CoursesValidator(
            course_name=name,
            base_course=base_course,
            term_start_date=term_start,
            login_required=False,
            allow_pairs=False,
            downloads_enabled=False,
            courselevel="",
            institution="Test University",
            new_server=True,
            timezone=timezone,
        )
    )
    return await fetch_course(name)


async def _share_assignments(course_id):
    """Opt a course in to offering its assignments, as Course Settings does."""
    await create_course_attribute(course_id, "share_assignments", "true")


async def _make_user(username):
    return await create_user(
        AuthUserValidator(
            username=username,
            first_name="test",
            last_name="user",
            password="xxx",
            email=f"{username}@example.com",
            course_name="overview",
            course_id=1,
            donated=True,
            active=True,
            accept_tcp=True,
            created_on=datetime.datetime(2020, 1, 1),
            modified_on=datetime.datetime(2020, 1, 1),
            registration_key="",
            registration_id="",
            reset_password_key="",
        )
    )


async def _make_assignment(
    course_id, name, is_private, duedate=None, points=10, from_source=False
):
    return await create_assignment(
        AssignmentValidator(
            course=course_id,
            name=name,
            points=points,
            released=False,
            description=f"{name} description",
            duedate=duedate or datetime.datetime(2099, 1, 1),
            visible=True,
            from_source=from_source,
            is_peer=False,
            is_timed=False,
            current_index=0,
            peer_async_visible=False,
            kind="Regular",
            is_private=is_private,
        )
    )


async def _make_question(base_course, name, question_type="mchoice"):
    return await create_question(
        QuestionValidator(
            base_course=base_course,
            name=name,
            chapter="ch1",
            subchapter="sub1",
            author="sharing_owner",
            question="Shared question?",
            timestamp=canonical_utcnow(),
            question_type=question_type,
            is_private=False,
            from_source=False,
            review_flag=False,
            htmlsrc="<p>hello</p>",
        )
    )


async def _attach(assignment_id, question_id, points, priority, reading=False):
    await create_assignment_question(
        AssignmentQuestionValidator(
            assignment_id=assignment_id,
            question_id=question_id,
            points=points,
            activities_required=0,
            reading_assignment=reading,
            sorting_priority=priority,
            which_to_grade="best_answer",
            autograde="pct_correct",
            timed=False,
        )
    )


async def _question_count(base_course):
    async with async_session() as session:
        return (
            await session.execute(
                select(func.count())
                .select_from(Question)
                .where(Question.base_course == base_course)
            )
        ).scalar()


@pytest.fixture(scope="session")
async def sharing_world(init_test_db):
    """Two instructors in unrelated courses that use different books.

    ``src`` has opted in to sharing and ``closed`` has not, which is the whole
    distinction now that the decision belongs to the course rather than to each
    assignment. Neither is a base course: those have always been copyable by
    anyone, so using one would mask the opt-in entirely.
    """
    owner = await _make_user("sharing_owner")
    importer = await _make_user("sharing_importer")

    src = await _make_course(SRC_COURSE, SRC_BOOK, datetime.date(2026, 1, 12), CHICAGO)
    closed = await _make_course(
        CLOSED_COURSE, SRC_BOOK, datetime.date(2026, 1, 12), CHICAGO
    )
    dst = await _make_course(DST_COURSE, DST_BOOK, datetime.date(2026, 8, 24), CHICAGO)
    same_book = await _make_course(
        SAME_BOOK_COURSE, SRC_BOOK, datetime.date(2026, 8, 24), CHICAGO
    )

    await create_instructor_course_entry(owner.id, src.id)
    await create_instructor_course_entry(owner.id, closed.id)
    await create_instructor_course_entry(importer.id, dst.id)
    await create_instructor_course_entry(importer.id, same_book.id)

    await _share_assignments(src.id)

    shared = await _make_assignment(src.id, "Shared Homework", is_private=False)
    # In a course that never opted in. Nobody outside it should see this.
    unshared = await _make_assignment(closed.id, "Unshared Exam", is_private=True)

    # The book's own course. Its assignments are "official": nobody opted in on
    # its behalf, and nobody should have to for the book's material to be
    # findable. The course is deliberately left without the sharing attribute,
    # to prove the base-course exemption is what surfaces them.
    book = await fetch_course(SRC_BOOK)
    official = await _make_assignment(book.id, "Official Chapter 1", is_private=True)
    generated = await _make_assignment(
        book.id, "Official Timed Exam", is_private=False, from_source=True
    )

    question = await _make_question(SRC_BOOK, "sharing_q1")
    await _attach(shared.id, question.id, points=7, priority=0)
    await _attach(official.id, question.id, points=5, priority=0)

    return {
        "owner": owner,
        "importer": importer,
        "src": src,
        "closed": closed,
        "dst": dst,
        "same_book": same_book,
        "book": book,
        "shared": shared,
        "unshared": unshared,
        "official": official,
        "generated": generated,
        "question": question,
    }


def _names(result):
    return {a["name"] for a in result["assignments"]}


def _row(result, name):
    """The one result row with this name, so a test can read its flags.

    Every assignment in this module gets a distinct name, which keeps a lookup
    by name unambiguous even though the fixture is session-scoped and results
    accumulate as the file runs.
    """
    return next(a for a in result["assignments"] if a["name"] == name)


def _named(name, **kwargs):
    """Search criteria scoped to a single assignment by name.

    A test that asserts "this is visible" has to say which one it means. The
    whole suite shares one database, ``test_course_1`` is seeded as a base
    course, and a base course's assignments are visible to everyone -- so every
    other test module's assignments are legitimately in these results, and an
    unfiltered first page depends on which modules ran first. Scoping by name
    keeps these assertions about visibility rather than about page size.
    """
    return AssignmentsSearchRequest(
        filters={"name": {"value": name, "matchMode": "equals"}}, **kwargs
    )


async def _search_as_importer(sharing_world, name):
    """Search for one assignment by name, targeting the importer's course."""
    return await search_assignments(
        _named(name),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
        target_course_id=sharing_world["dst"].id,
    )


# search_assignments
# ------------------


async def test_search_finds_a_shared_assignment_from_a_foreign_course(sharing_world):
    result = await search_assignments(
        _named("Shared Homework"),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert "Shared Homework" in _names(result)


async def test_search_hides_a_course_that_has_not_opted_in(sharing_world):
    """Sharing is off until a course turns it on, and it covers the course."""
    result = await search_assignments(
        _named("Unshared Exam"),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert "Unshared Exam" not in _names(result)


async def test_search_still_shows_the_owner_their_own_unshared_course(sharing_world):
    """Your own material never vanishes from your own search results."""
    result = await search_assignments(
        _named("Unshared Exam"),
        user_id=sharing_world["owner"].id,
    )
    assert "Unshared Exam" in _names(result)


async def test_search_excludes_the_requesters_current_course(sharing_world):
    """The current course is where results land, so listing it is noise."""
    await _make_assignment(
        sharing_world["dst"].id, "Local Assignment", is_private=False
    )
    result = await search_assignments(
        AssignmentsSearchRequest(),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert "Local Assignment" not in _names(result)


async def test_search_can_be_limited_to_one_book(sharing_world):
    result = await search_assignments(
        _named("Shared Homework", base_course=DST_BOOK),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["same_book"].id,
    )
    assert "Shared Homework" not in _names(result)

    result = await search_assignments(
        _named("Shared Homework", base_course=SRC_BOOK),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert "Shared Homework" in _names(result)


async def test_search_can_be_limited_to_my_own_courses(sharing_world):
    """Material from courses you teach, rather than the whole platform.

    Independent of the book filter: the importer's two courses are on different
    books, so "mine" and "this book" are not the same set.
    """
    await _make_assignment(
        sharing_world["same_book"].id, "Only Mine Homework", is_private=False
    )

    mine = await search_assignments(
        AssignmentsSearchRequest(only_my_courses=True, limit=100),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert "Only Mine Homework" in _names(mine)
    # From a course the importer has nothing to do with.
    assert "Shared Homework" not in _names(mine)

    everything = await search_assignments(
        AssignmentsSearchRequest(limit=100),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert "Shared Homework" in _names(everything)


async def test_only_my_courses_finds_nothing_for_someone_who_teaches_nothing(
    sharing_world,
):
    """An empty course list has to mean "nothing", not "no filter"."""
    stranger = await _make_user("sharing_stranger")

    result = await search_assignments(
        AssignmentsSearchRequest(only_my_courses=True, limit=100),
        user_id=stranger.id,
    )
    assert result["assignments"] == []
    assert result["pagination"]["total"] == 0


async def test_search_filters_by_course_name(sharing_world):
    result = await search_assignments(
        AssignmentsSearchRequest(
            filters={"course_name": {"value": SRC_COURSE, "matchMode": "equals"}}
        ),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert _names(result) == {"Shared Homework"}


async def test_global_filter_requires_every_term_to_match(sharing_world):
    matching = await search_assignments(
        AssignmentsSearchRequest(filters={"global": {"value": "Shared Homework"}}),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert "Shared Homework" in _names(matching)

    # "Homework" matches but "nonsenseterm" does not, so neither should the row.
    narrowed = await search_assignments(
        AssignmentsSearchRequest(
            filters={"global": {"value": "Homework nonsenseterm"}}
        ),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert "Shared Homework" not in _names(narrowed)


async def test_search_reports_question_count_and_book_title(sharing_world):
    result = await search_assignments(
        AssignmentsSearchRequest(
            filters={"name": {"value": "Shared Homework", "matchMode": "equals"}}
        ),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    row = result["assignments"][0]
    assert row["question_count"] == 1
    assert row["base_course"] == SRC_BOOK
    assert row["course_name"] == SRC_COURSE


async def test_search_paginates(sharing_world):
    page = await search_assignments(
        AssignmentsSearchRequest(limit=1, page=0),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert len(page["assignments"]) == 1
    assert page["pagination"]["total"] >= 1
    assert page["pagination"]["pages"] == page["pagination"]["total"]


# Official (base course) assignments
# ----------------------------------


async def test_search_lists_a_books_own_assignment_without_a_sharing_flag(
    sharing_world,
):
    """A book's material is findable without anyone opting in.

    Requiring the flag would have kept every official assignment invisible: the
    import path has always exempted base courses, but search did not, so they
    were importable by id and unlistable -- and no book author has a UI to flip
    the flag anyway.
    """
    official = await search_assignments(
        _named("Official Chapter 1"),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert "Official Chapter 1" in _names(official)
    assert _row(official, "Official Chapter 1")["is_official"] is True

    # An ordinary shared assignment is not official just because it is listed.
    shared = await search_assignments(
        _named("Shared Homework"),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert _row(shared, "Shared Homework")["is_official"] is False


async def test_search_hides_an_assignment_generated_from_the_book_source(sharing_world):
    """``from_source`` rows are rebuilt from the book's markup on every build.

    A copy is a snapshot that starts drifting the moment the book changes, so
    they are not advertised -- even this one, which is marked shareable.
    """
    result = await search_assignments(
        AssignmentsSearchRequest(limit=100),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert "Official Timed Exam" not in _names(result)


async def test_the_callers_own_books_official_assignments_lead(sharing_world):
    """The elevation itself, and its limit.

    Only the caller's own book leads. Elevating every book's official set would
    put nineteen other books' material ahead of what an instructor's colleagues
    actually share, which is the opposite of not losing things.
    """
    other_book = await fetch_course(DST_BOOK)
    await _make_assignment(other_book.id, "Other Book Official", is_private=True)

    result = await search_assignments(
        AssignmentsSearchRequest(limit=100, sorting={"field": "name", "order": 1}),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
        prefer_base_course=SRC_BOOK,
    )
    rows = result["assignments"]
    leads = [row["is_official"] and row["base_course"] == SRC_BOOK for row in rows]

    assert leads[0] is True
    # Every row from the caller's book comes before every other row.
    assert leads == sorted(leads, reverse=True)

    # Official, but from a book this instructor does not teach, so it waits its
    # turn with everything else.
    other = next(r for r in rows if r["name"] == "Other Book Official")
    assert other["is_official"] is True
    assert leads[rows.index(other)] is False


async def test_preview_marks_an_official_assignment(sharing_world):
    preview = await fetch_assignment_for_preview(
        sharing_world["official"].id,
        user_id=sharing_world["importer"].id,
        target_course=sharing_world["dst"],
    )
    assert preview["is_official"] is True


# import_assignment
# -----------------


async def test_import_links_the_source_question_across_books(sharing_world):
    """The exercise is referred to where it lives, not duplicated.

    Copying it was the earlier design, and it could not work: the div id that
    identifies an exercise in the DOM, in useinfo and in grading is baked into
    the stored HTML, which a copy does not rewrite.
    """
    result = await import_assignment(
        source_assignment_id=sharing_world["shared"].id,
        target_course=sharing_world["dst"],
        importing_user=sharing_world["importer"],
    )

    preview = await fetch_assignment_for_preview(
        result.assignment.id, user_id=sharing_world["importer"].id
    )
    assert preview["question_count"] == 1
    linked = preview["questions"][0]
    assert linked["id"] == sharing_world["question"].id
    # The source's per-question points survive the trip.
    assert linked["points"] == 7
    assert result.name == "Shared Homework"
    assert result.skipped_readings == 0


async def test_import_reuses_the_question_when_the_book_is_the_same(sharing_world):
    result = await import_assignment(
        source_assignment_id=sharing_world["shared"].id,
        target_course=sharing_world["same_book"],
        importing_user=sharing_world["importer"],
    )

    preview = await fetch_assignment_for_preview(
        result.assignment.id, user_id=sharing_world["importer"].id
    )
    assert preview["questions"][0]["id"] == sharing_world["question"].id


async def test_import_adds_no_questions_to_the_target_book(sharing_world):
    """Nothing new lands in the importer's book.

    Copies used to accumulate there -- one duplicate per import, left orphaned
    in the book's exercise pool when the imported assignment was deleted.
    """
    before = await _question_count(DST_BOOK)

    await import_assignment(
        source_assignment_id=sharing_world["shared"].id,
        target_course=sharing_world["dst"],
        importing_user=sharing_world["importer"],
    )

    assert await _question_count(DST_BOOK) == before


async def test_imported_assignment_is_hidden_and_not_reshared(sharing_world):
    result = await import_assignment(
        source_assignment_id=sharing_world["shared"].id,
        target_course=sharing_world["dst"],
        importing_user=sharing_world["importer"],
    )
    assert result.assignment.visible is False
    # Importing something shared does not sign you up for sharing it onward.
    assert result.assignment.is_private is True


async def test_importing_twice_does_not_collide_on_name(sharing_world):
    first = await import_assignment(
        source_assignment_id=sharing_world["shared"].id,
        target_course=sharing_world["dst"],
        importing_user=sharing_world["importer"],
    )
    second = await import_assignment(
        source_assignment_id=sharing_world["shared"].id,
        target_course=sharing_world["dst"],
        importing_user=sharing_world["importer"],
    )
    assert first.name != second.name
    assert second.name.startswith("Shared Homework (Copy")

    # Both point at the one question; the second import has nothing to rename.
    for imported in (first, second):
        preview = await fetch_assignment_for_preview(
            imported.assignment.id, user_id=sharing_world["importer"].id
        )
        assert preview["questions"][0]["id"] == sharing_world["question"].id


async def test_import_shifts_the_due_date_by_the_offset_from_term_start(sharing_world):
    """The copy keeps its local wall clock time across a DST change.

    The source term starts in January (CST) and the target in August (CDT); a
    naive subtraction lands an hour off and can roll onto the next day.
    """
    stored = (
        datetime.datetime(2026, 1, 20, 23, 59, tzinfo=ZoneInfo(CHICAGO))
        .astimezone(datetime.timezone.utc)
        .replace(tzinfo=None)
    )
    source_assignment = await _make_assignment(
        sharing_world["src"].id, "Dated Homework", is_private=False, duedate=stored
    )

    imported = (
        await import_assignment(
            source_assignment_id=source_assignment.id,
            target_course=sharing_world["dst"],
            importing_user=sharing_world["importer"],
        )
    ).assignment

    local = (
        imported.duedate.replace(tzinfo=datetime.timezone.utc)
        .astimezone(ZoneInfo(CHICAGO))
        .strftime("%Y-%m-%d %H:%M")
    )
    assert local == "2026-09-01 23:59"

    offset = imported.duedate - term_start_utc(
        sharing_world["dst"].term_start_date, CHICAGO
    )
    assert offset == stored - term_start_utc(
        sharing_world["src"].term_start_date, CHICAGO
    )


async def test_import_keeps_the_original_duedate_when_a_course_timezone_is_invalid(
    sharing_world,
):
    """A timezone the tz database no longer recognizes should not sink the import.

    An instructor can end up with a course timezone that zoneinfo later stops
    recognizing (a deprecated alias dropped from the tz database). The due
    date shift depends on being able to resolve that zone, so it is skipped
    rather than raising -- the assignment still imports, just without a
    re-dated due date, and the caller gets a warning to relay.
    """
    bad_tz_course = await _make_course(
        "sharing_bad_tz_course",
        SRC_BOOK,
        datetime.date(2026, 1, 12),
        "Not/A_Real_Zone",
    )
    await create_instructor_course_entry(sharing_world["owner"].id, bad_tz_course.id)
    await _share_assignments(bad_tz_course.id)

    stored = datetime.datetime(2026, 1, 20, 23, 59)
    source_assignment = await _make_assignment(
        bad_tz_course.id, "Bad Timezone Homework", is_private=False, duedate=stored
    )

    result = await import_assignment(
        source_assignment_id=source_assignment.id,
        target_course=sharing_world["dst"],
        importing_user=sharing_world["importer"],
    )

    assert result.assignment.duedate == stored
    assert result.duedate_warning is not None
    assert "timezone" in result.duedate_warning.lower()


# Already imported
# ----------------


async def test_import_records_where_the_copy_came_from(sharing_world):
    """The breadcrumb everything below reads back."""
    source = await _make_assignment(
        sharing_world["src"].id, "Traceable Homework", is_private=False
    )

    result = await import_assignment(
        source_assignment_id=source.id,
        target_course=sharing_world["dst"],
        importing_user=sharing_world["importer"],
    )
    assert result.assignment.imported_from_assignment_id == source.id


async def test_search_marks_an_assignment_already_imported_here(sharing_world):
    source = await _make_assignment(
        sharing_world["src"].id, "Marked Homework", is_private=False
    )

    before = _row(
        await _search_as_importer(sharing_world, "Marked Homework"), "Marked Homework"
    )
    assert before["already_imported"] is False
    assert before["imported_as"] is None

    imported = await import_assignment(
        source_assignment_id=source.id,
        target_course=sharing_world["dst"],
        importing_user=sharing_world["importer"],
    )

    after = _row(
        await _search_as_importer(sharing_world, "Marked Homework"), "Marked Homework"
    )
    assert after["already_imported"] is True
    # Named so the instructor can go find the copy they already have.
    assert after["imported_as"] == imported.name


async def test_the_mark_survives_renaming_the_copy(sharing_world):
    """Why this keys off a stored source id and not the name.

    Renaming an imported assignment is the first thing an instructor is likely
    to do to it, and name matching would lose track of it immediately.
    """
    source = await _make_assignment(
        sharing_world["src"].id, "Renamed Homework", is_private=False
    )
    imported = await import_assignment(
        source_assignment_id=source.id,
        target_course=sharing_world["dst"],
        importing_user=sharing_world["importer"],
    )

    async with async_session.begin() as session:
        await session.execute(
            update(Assignment)
            .where(Assignment.id == imported.assignment.id)
            .values(name="Week 4, revised")
        )

    row = _row(
        await _search_as_importer(sharing_world, "Renamed Homework"), "Renamed Homework"
    )
    assert row["already_imported"] is True
    assert row["imported_as"] == "Week 4, revised"


async def test_the_mark_is_scoped_to_the_course_being_imported_into(sharing_world):
    """A copy in one of your courses says nothing about another of them."""
    source = await _make_assignment(
        sharing_world["src"].id, "Per Course Homework", is_private=False
    )
    await import_assignment(
        source_assignment_id=source.id,
        target_course=sharing_world["dst"],
        importing_user=sharing_world["importer"],
    )

    criteria = AssignmentsSearchRequest(
        filters={"name": {"value": "Per Course Homework", "matchMode": "equals"}}
    )
    other_course = await search_assignments(
        criteria,
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["same_book"].id,
        target_course_id=sharing_world["same_book"].id,
    )
    assert _row(other_course, "Per Course Homework")["already_imported"] is False


async def test_search_marks_nothing_without_a_target_course(sharing_world):
    """No course to have imported into, so the question does not arise."""
    result = await search_assignments(
        AssignmentsSearchRequest(limit=100),
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
    )
    assert all(a["already_imported"] is False for a in result["assignments"])


async def test_preview_says_when_a_copy_is_already_in_your_course(sharing_world):
    source = await _make_assignment(
        sharing_world["src"].id, "Previewed Twice", is_private=False
    )

    before = await fetch_assignment_for_preview(
        source.id,
        user_id=sharing_world["importer"].id,
        target_course=sharing_world["dst"],
    )
    assert before["already_imported"] is False

    imported = await import_assignment(
        source_assignment_id=source.id,
        target_course=sharing_world["dst"],
        importing_user=sharing_world["importer"],
    )

    after = await fetch_assignment_for_preview(
        source.id,
        user_id=sharing_world["importer"].id,
        target_course=sharing_world["dst"],
    )
    assert after["already_imported"] is True
    assert after["imported_as"] == imported.name

    # Browsing with no target course: nothing to have imported into.
    untargeted = await fetch_assignment_for_preview(
        source.id, user_id=sharing_world["importer"].id
    )
    assert untargeted["already_imported"] is False
    assert untargeted["imported_as"] is None


# Readings
# --------


async def _assignment_with_a_reading(sharing_world, name):
    """A source assignment holding one exercise and one reading."""
    assignment = await _make_assignment(sharing_world["src"].id, name, is_private=False)
    exercise = await _make_question(SRC_BOOK, f"{name} exercise")
    page = await _make_question(SRC_BOOK, f"{name} page", question_type="page")
    await _attach(assignment.id, exercise.id, points=3, priority=0)
    await _attach(assignment.id, page.id, points=4, priority=1, reading=True)
    return assignment


async def test_a_cross_book_import_leaves_readings_behind(sharing_world):
    """A reading names a subchapter of its own book.

    Linked into a course reading a different book, it would point students at a
    page they do not have and would be graded by counting activity that can
    never happen there.
    """
    source = await _assignment_with_a_reading(sharing_world, "Mixed Homework")

    result = await import_assignment(
        source_assignment_id=source.id,
        target_course=sharing_world["dst"],
        importing_user=sharing_world["importer"],
    )
    assert result.skipped_readings == 1

    preview = await fetch_assignment_for_preview(
        result.assignment.id, user_id=sharing_world["importer"].id
    )
    assert [q["name"] for q in preview["questions"]] == ["Mixed Homework exercise"]
    # Points follow what actually came across, not the source's total of 7.
    assert result.assignment.points == 3


async def test_a_same_book_import_keeps_readings(sharing_world):
    source = await _assignment_with_a_reading(sharing_world, "Mixed Homework 2")

    result = await import_assignment(
        source_assignment_id=source.id,
        target_course=sharing_world["same_book"],
        importing_user=sharing_world["importer"],
    )
    assert result.skipped_readings == 0

    preview = await fetch_assignment_for_preview(
        result.assignment.id, user_id=sharing_world["importer"].id
    )
    assert len(preview["questions"]) == 2
    assert result.assignment.points == 7


# search_shareable_courses
# ------------------------


def _course_names(result):
    return [c["course_name"] for c in result["courses"]]


def _course(result, name):
    return next(c for c in result["courses"] if c["course_name"] == name)


async def test_shareable_courses_lists_courses_with_something_to_offer(sharing_world):
    result = await search_shareable_courses(
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
        limit=100,
    )
    assert SRC_COURSE in _course_names(result)
    assert _course(result, SRC_COURSE)["shareable_count"] >= 1
    assert _course(result, SRC_COURSE)["is_official"] is False


async def test_shareable_courses_puts_the_callers_book_first(sharing_world):
    """An instructor looking for material for their book should not have to
    search for the book itself."""
    result = await search_shareable_courses(
        user_id=sharing_world["importer"].id,
        prefer_base_course=SRC_BOOK,
        exclude_course_id=sharing_world["dst"].id,
        limit=100,
    )
    assert _course_names(result)[0] == SRC_BOOK
    assert _course(result, SRC_BOOK)["is_official"] is True


async def test_shareable_courses_counts_only_what_can_be_taken(sharing_world):
    """The build-generated assignment is excluded here too, so the count is not
    a promise the course page then breaks."""
    result = await search_shareable_courses(
        user_id=sharing_world["importer"].id,
        exclude_course_id=sharing_world["dst"].id,
        limit=100,
    )
    # "Official Chapter 1" counts; "Official Timed Exam" does not.
    assert _course(result, SRC_BOOK)["shareable_count"] == 1


async def test_shareable_courses_searches_name_and_institution(sharing_world):
    matching = await search_shareable_courses(
        user_id=sharing_world["importer"].id,
        search="sharing_src",
        limit=100,
    )
    assert _course_names(matching) == [SRC_COURSE]

    missing = await search_shareable_courses(
        user_id=sharing_world["importer"].id,
        search="sharing_src nonsenseterm",
        limit=100,
    )
    assert missing["courses"] == []


async def test_shareable_courses_can_be_limited_to_my_own(sharing_world):
    result = await search_shareable_courses(
        user_id=sharing_world["importer"].id,
        only_my_courses=True,
        exclude_course_id=sharing_world["dst"].id,
        limit=100,
    )
    assert SAME_BOOK_COURSE in _course_names(result)
    assert SRC_COURSE not in _course_names(result)


# fetch_shareable_assignment_tree
# -------------------------------


def _tree_course(result, name):
    return next(c for c in result["courses"] if c["course_name"] == name)


async def test_tree_nests_assignments_under_their_course(sharing_world):
    """Both levels in one response, so expanding a course is not a round trip."""
    result = await fetch_shareable_assignment_tree(
        user_id=sharing_world["importer"].id,
        target_course=sharing_world["dst"],
        search=SRC_COURSE,
        limit=100,
    )
    course = _tree_course(result, SRC_COURSE)
    assert "Shared Homework" in [a["name"] for a in course["assignments"]]
    assert course["shareable_count"] == len(course["assignments"])


async def test_tree_marks_what_is_already_imported(sharing_world):
    source = await _make_course(
        "sharing_tree_source", SRC_BOOK, datetime.date(2026, 1, 12), CHICAGO
    )
    await _share_assignments(source.id)
    assignment = await _make_assignment(source.id, "Tree Homework", is_private=False)

    before = await fetch_shareable_assignment_tree(
        user_id=sharing_world["importer"].id,
        target_course=sharing_world["dst"],
        search="sharing_tree_source",
        limit=100,
    )
    assert (
        _tree_course(before, "sharing_tree_source")["assignments"][0][
            "already_imported"
        ]
        is False
    )

    await import_assignment(
        source_assignment_id=assignment.id,
        target_course=sharing_world["dst"],
        importing_user=sharing_world["importer"],
    )

    after = await fetch_shareable_assignment_tree(
        user_id=sharing_world["importer"].id,
        target_course=sharing_world["dst"],
        search="sharing_tree_source",
        limit=100,
    )
    row = _tree_course(after, "sharing_tree_source")["assignments"][0]
    assert row["already_imported"] is True
    assert row["imported_as"] == "Tree Homework"


async def test_tree_puts_the_callers_own_book_first(sharing_world):
    """Only the caller's book. Another book's official set is no more relevant
    to this instructor than a colleague's course."""
    result = await fetch_shareable_assignment_tree(
        user_id=sharing_world["importer"].id,
        target_course=sharing_world["same_book"],
        limit=100,
    )
    assert result["courses"][0]["course_name"] == SRC_BOOK


# import_course_assignments
# -------------------------


async def test_bulk_import_takes_a_whole_course(sharing_world):
    """The reason this page exists: a colleague's semester in one action."""
    source = await _make_course(
        "sharing_bulk_source", SRC_BOOK, datetime.date(2026, 1, 12), CHICAGO
    )
    target = await _make_course(
        "sharing_bulk_target", SRC_BOOK, datetime.date(2026, 8, 24), CHICAGO
    )
    await _share_assignments(source.id)
    await create_instructor_course_entry(sharing_world["importer"].id, target.id)
    for name in ("Bulk One", "Bulk Two", "Bulk Three"):
        await _make_assignment(source.id, name, is_private=False)

    result = await import_course_assignments(
        source_course_id=source.id,
        target_course=target,
        importing_user=sharing_world["importer"],
    )
    assert sorted(result.imported) == ["Bulk One", "Bulk Three", "Bulk Two"]
    assert result.skipped_existing == []
    assert result.failed == []


async def test_bulk_import_skips_what_you_already_took(sharing_world):
    """Re-running after the source course adds one should take the new one only."""
    source = await _make_course(
        "sharing_bulk_source2", SRC_BOOK, datetime.date(2026, 1, 12), CHICAGO
    )
    target = await _make_course(
        "sharing_bulk_target2", SRC_BOOK, datetime.date(2026, 8, 24), CHICAGO
    )
    await _share_assignments(source.id)
    await create_instructor_course_entry(sharing_world["importer"].id, target.id)
    await _make_assignment(source.id, "Bulk Original", is_private=False)

    first = await import_course_assignments(
        source_course_id=source.id,
        target_course=target,
        importing_user=sharing_world["importer"],
    )
    assert first.imported == ["Bulk Original"]

    await _make_assignment(source.id, "Bulk Added Later", is_private=False)

    second = await import_course_assignments(
        source_course_id=source.id,
        target_course=target,
        importing_user=sharing_world["importer"],
    )
    assert second.imported == ["Bulk Added Later"]
    assert second.skipped_existing == ["Bulk Original"]


async def test_bulk_import_can_be_told_not_to_skip(sharing_world):
    source = await _make_course(
        "sharing_bulk_source3", SRC_BOOK, datetime.date(2026, 1, 12), CHICAGO
    )
    target = await _make_course(
        "sharing_bulk_target3", SRC_BOOK, datetime.date(2026, 8, 24), CHICAGO
    )
    await _share_assignments(source.id)
    await create_instructor_course_entry(sharing_world["importer"].id, target.id)
    await _make_assignment(source.id, "Bulk Again", is_private=False)

    await import_course_assignments(
        source_course_id=source.id,
        target_course=target,
        importing_user=sharing_world["importer"],
    )
    second = await import_course_assignments(
        source_course_id=source.id,
        target_course=target,
        importing_user=sharing_world["importer"],
        skip_existing=False,
    )
    assert second.skipped_existing == []
    # Name de-duplication is import_assignment's, not this function's.
    assert second.imported[0].startswith("Bulk Again (Copy")


async def test_opting_in_shares_the_whole_course(sharing_world):
    """All or nothing, which is the cost of moving the decision to the course.

    ``is_private`` no longer withholds an assignment from a course that has
    opted in -- the exam comes across with everything else. That is why the
    Course Settings copy says so in as many words.
    """
    source = await _make_course(
        "sharing_bulk_source4", SRC_BOOK, datetime.date(2026, 1, 12), CHICAGO
    )
    target = await _make_course(
        "sharing_bulk_target4", SRC_BOOK, datetime.date(2026, 8, 24), CHICAGO
    )
    await _share_assignments(source.id)
    await create_instructor_course_entry(sharing_world["importer"].id, target.id)
    await _make_assignment(source.id, "Bulk Shared", is_private=False)
    await _make_assignment(source.id, "Bulk Exam", is_private=True)
    await _make_assignment(
        source.id, "Bulk Generated", is_private=False, from_source=True
    )

    result = await import_course_assignments(
        source_course_id=source.id,
        target_course=target,
        importing_user=sharing_world["importer"],
    )
    # Generated from the book source, so still left behind.
    assert sorted(result.imported) == ["Bulk Exam", "Bulk Shared"]


async def test_bulk_import_takes_a_books_official_set(sharing_world):
    """Starting a course from the book's own assignments."""
    target = await _make_course(
        "sharing_bulk_official", SRC_BOOK, datetime.date(2026, 8, 24), CHICAGO
    )
    await create_instructor_course_entry(sharing_world["importer"].id, target.id)

    result = await import_course_assignments(
        source_course_id=sharing_world["book"].id,
        target_course=target,
        importing_user=sharing_world["importer"],
    )
    assert "Official Chapter 1" in result.imported
    # Generated from the book source, so not taken even in bulk.
    assert "Official Timed Exam" not in result.imported


async def test_bulk_import_refuses_to_import_a_course_into_itself(sharing_world):
    with pytest.raises(HTTPException) as excinfo:
        await import_course_assignments(
            source_course_id=sharing_world["dst"].id,
            target_course=sharing_world["dst"],
            importing_user=sharing_world["importer"],
        )
    assert excinfo.value.status_code == 400


# Authorization
# -------------


async def test_importing_from_a_course_that_has_not_opted_in_is_rejected(sharing_world):
    with pytest.raises(HTTPException) as excinfo:
        await import_assignment(
            source_assignment_id=sharing_world["unshared"].id,
            target_course=sharing_world["dst"],
            importing_user=sharing_world["importer"],
        )
    # 404 rather than 403 so the response does not confirm the assignment exists.
    assert excinfo.value.status_code == 404


async def test_previewing_from_a_course_that_has_not_opted_in_is_rejected(
    sharing_world,
):
    with pytest.raises(HTTPException) as excinfo:
        await fetch_assignment_for_preview(
            sharing_world["unshared"].id, user_id=sharing_world["importer"].id
        )
    assert excinfo.value.status_code == 404


async def test_the_owner_may_still_import_from_their_own_unshared_course(sharing_world):
    """Instructing the source course is enough, opted in or not."""
    result = await import_assignment(
        source_assignment_id=sharing_world["unshared"].id,
        target_course=sharing_world["src"],
        importing_user=sharing_world["owner"],
    )
    assert result.assignment.id is not None


# Preview
# -------


async def test_preview_marks_a_cross_book_import(sharing_world):
    cross_book = await fetch_assignment_for_preview(
        sharing_world["shared"].id,
        user_id=sharing_world["importer"].id,
        target_course=sharing_world["dst"],
    )
    assert cross_book["is_cross_book"] is True
    # Exercises cross book boundaries, so an exercise-only assignment loses
    # nothing -- the flag alone is not a warning that something is missing.
    assert cross_book["skipped_readings"] == 0
    assert all(q["will_import"] for q in cross_book["questions"])

    same_book = await fetch_assignment_for_preview(
        sharing_world["shared"].id,
        user_id=sharing_world["importer"].id,
        target_course=sharing_world["same_book"],
    )
    assert same_book["is_cross_book"] is False


async def test_preview_flags_the_readings_a_cross_book_import_will_drop(sharing_world):
    """Said before importing, so the gap is a choice rather than a surprise."""
    source = await _assignment_with_a_reading(sharing_world, "Mixed Homework 3")

    cross_book = await fetch_assignment_for_preview(
        source.id,
        user_id=sharing_world["importer"].id,
        target_course=sharing_world["dst"],
    )
    assert cross_book["skipped_readings"] == 1
    assert [q["will_import"] for q in cross_book["questions"]] == [True, False]

    same_book = await fetch_assignment_for_preview(
        source.id,
        user_id=sharing_world["importer"].id,
        target_course=sharing_world["same_book"],
    )
    assert same_book["skipped_readings"] == 0
    assert all(q["will_import"] for q in same_book["questions"])


async def test_preview_without_a_target_course_drops_nothing(sharing_world):
    """The browsing case: no target yet, so no book to compare against."""
    source = await _assignment_with_a_reading(sharing_world, "Mixed Homework 4")

    preview = await fetch_assignment_for_preview(
        source.id, user_id=sharing_world["importer"].id
    )
    assert preview["is_cross_book"] is False
    assert preview["skipped_readings"] == 0
