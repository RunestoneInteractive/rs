"""
Tests for course CRUD operations.
"""

import datetime
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from rsptx.db.crud import fetch_course, fetch_course_by_id, create_course
from rsptx.db.models import CoursesValidator

NEW_COURSE_NAME = "crud_test_course"


@pytest.fixture(scope="session")
async def new_course(init_test_db):
    """Create a transient test course for the duration of this module."""
    course = await create_course(
        CoursesValidator(
            course_name=NEW_COURSE_NAME,
            base_course="overview",
            term_start_date=datetime.date(2024, 1, 1),
            login_required=False,
            allow_pairs=False,
            downloads_enabled=False,
            courselevel="",
            institution="Test University",
            new_server=True,
        )
    )
    yield course


async def test_fetch_seeded_course(test_course):
    """test_course_1 must exist after seed."""
    assert test_course is not None
    assert test_course.course_name == "test_course_1"


async def test_create_course(new_course):
    """Created course is returned with an id."""
    assert new_course is not None
    assert new_course.id is not None
    assert new_course.course_name == NEW_COURSE_NAME


async def test_fetch_course_by_name(new_course):
    """Fetching by name returns the newly created course."""
    fetched = await fetch_course(NEW_COURSE_NAME)
    assert fetched is not None
    assert fetched.course_name == NEW_COURSE_NAME
    assert fetched.institution == "Test University"


async def test_fetch_course_by_id(new_course):
    """Fetching by id returns the same course."""
    fetched = await fetch_course_by_id(new_course.id)
    assert fetched is not None
    assert fetched.course_name == NEW_COURSE_NAME


async def test_fetch_nonexistent_course():
    """Fetching a missing course returns None-wrapped validator."""
    result = await fetch_course("this_course_does_not_exist_xyz")
    assert result is None or result.course_name is None


# ---------------------------------------------------------------------------
# fetch_courses_by_start_date -- scopes bulk maintenance (rsmanage fixtotals)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
async def dated_courses(init_test_db):
    """Three courses across three terms, to exercise the date window."""
    from rsptx.db.crud import create_course

    made = []
    for name, start in [
        ("fixtotals_old_term", datetime.date(2020, 1, 15)),
        ("fixtotals_mid_term", datetime.date(2024, 8, 20)),
        ("fixtotals_new_term", datetime.date(2026, 1, 10)),
    ]:
        made.append(
            await create_course(
                CoursesValidator(
                    course_name=name,
                    base_course="overview",
                    term_start_date=start,
                    login_required=False,
                    allow_pairs=False,
                    downloads_enabled=False,
                    courselevel="",
                    institution="Test University",
                    new_server=True,
                )
            )
        )
    yield made


async def test_since_excludes_earlier_terms(dated_courses):
    from rsptx.db.crud import fetch_courses_by_start_date

    names = {
        c.course_name
        for c in await fetch_courses_by_start_date(since=datetime.date(2024, 1, 1))
    }
    assert "fixtotals_old_term" not in names
    assert "fixtotals_mid_term" in names
    assert "fixtotals_new_term" in names


async def test_until_excludes_later_terms(dated_courses):
    from rsptx.db.crud import fetch_courses_by_start_date

    names = {
        c.course_name
        for c in await fetch_courses_by_start_date(until=datetime.date(2024, 12, 31))
    }
    assert "fixtotals_old_term" in names
    assert "fixtotals_mid_term" in names
    assert "fixtotals_new_term" not in names


async def test_since_and_until_bound_a_single_term(dated_courses):
    from rsptx.db.crud import fetch_courses_by_start_date

    names = {
        c.course_name
        for c in await fetch_courses_by_start_date(
            since=datetime.date(2024, 1, 1), until=datetime.date(2024, 12, 31)
        )
    }
    assert names & {
        "fixtotals_old_term",
        "fixtotals_mid_term",
        "fixtotals_new_term",
    } == {"fixtotals_mid_term"}


async def test_boundaries_are_inclusive(dated_courses):
    from rsptx.db.crud import fetch_courses_by_start_date

    exact = datetime.date(2024, 8, 20)
    names = {
        c.course_name
        for c in await fetch_courses_by_start_date(since=exact, until=exact)
    }
    assert "fixtotals_mid_term" in names


async def test_base_courses_are_not_silently_dropped(dated_courses):
    """A maintenance sweep must not skip a course just because it happens to be
    its own base course -- that convention is not a guarantee, and skipping one
    would under-repair without saying so."""
    from rsptx.db.crud import fetch_courses_by_start_date

    names = {c.course_name for c in await fetch_courses_by_start_date()}
    assert "overview" in names


async def test_results_are_ordered_by_term_start(dated_courses):
    from rsptx.db.crud import fetch_courses_by_start_date

    rows = await fetch_courses_by_start_date(since=datetime.date(2019, 1, 1))
    dates = [c.term_start_date for c in rows]
    assert dates == sorted(dates)


# ---------------------------------------------------------------------------
# is_course_instructor -- the redis-cached instructor check
# ---------------------------------------------------------------------------


class _FakeRedis:
    """Just enough of redis.asyncio for the instructor cache."""

    def __init__(self, fail=False):
        self.store = {}
        self.fail = fail

    async def get(self, key):
        if self.fail:
            from redis.exceptions import ConnectionError

            raise ConnectionError("redis is down")
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value.encode()

    async def delete(self, key):
        self.store.pop(key, None)


@pytest.fixture(scope="session")
async def instructor_cache_courses(init_test_db):
    """Two courses of our own, so instructor rows here touch no other test."""
    made = []
    for name in ("instructor_cache_a", "instructor_cache_b", "instructor_cache_c"):
        made.append(
            await create_course(
                CoursesValidator(
                    course_name=name,
                    base_course="overview",
                    term_start_date=datetime.date(2026, 1, 1),
                    login_required=False,
                    allow_pairs=False,
                    downloads_enabled=False,
                    courselevel="",
                    institution="Test University",
                    new_server=True,
                )
            )
        )
    return made


async def test_is_course_instructor_uncached(test_user, instructor_cache_courses):
    """With no cache (the test config) the answer comes from the database."""
    from rsptx.db.crud import create_course_instructor, is_course_instructor

    course_id = instructor_cache_courses[2].id
    assert await is_course_instructor(test_user.id, course_id) is False
    await create_course_instructor(course_id, test_user.id)
    assert await is_course_instructor(test_user.id, course_id) is True


async def test_is_course_instructor_cache_invalidated_by_writers(
    test_user, instructor_cache_courses, monkeypatch
):
    """A cached answer is served until a writer clears it."""
    from rsptx.db.crud import course as course_crud

    fake = _FakeRedis()
    monkeypatch.setattr(course_crud, "_instructor_cache", lambda: fake)
    course_id = instructor_cache_courses[0].id

    assert await course_crud.is_course_instructor(test_user.id, course_id) is False
    key = course_crud._instructor_key(test_user.id, course_id)
    assert fake.store[key] == b"0"

    await course_crud.create_instructor_course_entry(test_user.id, course_id)
    assert key not in fake.store
    assert await course_crud.is_course_instructor(test_user.id, course_id) is True
    assert fake.store[key] == b"1"

    await course_crud.delete_course_instructor(course_id, test_user.id)
    assert key not in fake.store
    assert await course_crud.is_course_instructor(test_user.id, course_id) is False


async def test_is_course_instructor_falls_back_when_redis_fails(
    test_user, instructor_cache_courses, monkeypatch
):
    """A redis outage must not turn into an error or a wrong answer."""
    from rsptx.db.crud import course as course_crud

    monkeypatch.setattr(course_crud, "_instructor_cache", lambda: _FakeRedis(True))
    course_id = instructor_cache_courses[1].id
    await course_crud.create_course_instructor(course_id, test_user.id)
    assert await course_crud.is_course_instructor(test_user.id, course_id) is True
