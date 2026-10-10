from typing import Dict, List, Optional
from collections import namedtuple
from datetime import datetime
from sqlalchemy import select, update, distinct, func
from ..models import (
    Chapter,
    ChapterValidator,
    SubChapter,
    SubChapterValidator,
    Question,
    UserState,
    UserStateValidator,
    UserSubChapterProgress,
    UserSubChapterProgressValidator,
    UserChapterProgress,
    UserChapterProgressValidator,
    UserInteraction,
    AuthUserValidator,
)
from ..async_session import async_session
from rsptx.response_helpers.core import canonical_utcnow
from rsptx.logging import rslogger
from .course import fetch_course
from .interactions import (
    fetch_touched_div_ids,
    page_interaction_key,
    since_term_start,
)
from rsptx.validation import schemas


async def get_book_chapters(course_name: str) -> List[ChapterValidator]:
    """
    Retrieve all chapters for a given course (course_name)

    :param course_name: str, the name of the course
    :return: List[ChapterValidator], a list of ChapterValidator objects representing the chapters
    """
    query = (
        select(Chapter)
        .where(Chapter.course_id == course_name)
        .order_by(Chapter.chapter_num)
    )
    async with async_session() as session:
        res = await session.execute(query)
        return [ChapterValidator.from_orm(x) for x in res.scalars().fetchall()]


async def fetch_subchapters(course, chap):
    """
    Retrieve all subchapters for a given chapter.

    :param course: str, the name of the course
    :param chap: str, the label of the chapter
    :return: ResultProxy, the result of the query
    """
    # Note: we are joining two tables so this query will not result in an defined in schemas.py
    # instead it will simply produce a bunch of tuples with the columns in the order given in the
    # select statement.
    query = (
        select(SubChapter.sub_chapter_label, SubChapter.sub_chapter_name)
        .where(
            (Chapter.id == SubChapter.chapter_id)
            & (Chapter.course_id == course)
            & (Chapter.chapter_label == chap)
        )
        .order_by(SubChapter.sub_chapter_num)
    )

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        # **Note** with this kind of query you do NOT want to call ``.scalars()`` on the result
        return res


async def fetch_chapter_for_subchapter(subchapter: str, base_course: str) -> str:
    """
    Used for pretext books where the subchapter is unique across the book
    due to the flat structure produced by pretext build.  In this case the
    old RST structure where we get the chapter and subchapter from the URL
    /book/chapter/subchapter.html gives us the wrong answer of the book.
    """

    query = (
        select(Chapter.chapter_label)
        .join(SubChapter, Chapter.id == SubChapter.chapter_id)
        .where(
            (Chapter.course_id == base_course)
            & (SubChapter.sub_chapter_label == subchapter)
        )
    )
    async with async_session() as session:
        chapter_label = await session.execute(query)
        return chapter_label.scalars().first()


async def get_book_subchapters(course_name: str) -> List[SubChapterValidator]:
    """
    Retrieve all subchapters for a given course (course_name)

    :param course_name: str, the name of the course
    :return: List[SubChapterValidator], a list of SubChapterValidator objects
    """
    query = (
        select(SubChapter)
        .join(Chapter)
        .where(
            (Chapter.course_id == course_name) & (SubChapter.chapter_id == Chapter.id)
        )
        .order_by(Chapter.chapter_num, SubChapter.sub_chapter_num)
    )
    async with async_session() as session:
        rslogger.debug(f"{query=}")
        res = await session.execute(query)
        return [SubChapterValidator.from_orm(x) for x in res.scalars().fetchall()]


async def count_reading_activities(
    chapter: str,
    subchapter: str,
    base_course: str,
    course_name: str,
    sid: str,
    deadline: Optional[datetime] = None,
) -> int:
    """Count the activities one student has completed on one reading page.

    This is the server-side twin of the reading progress bar (``PageProgressBar``
    in bookfuncs.js), which is what decides whether a reading is done: the page
    itself counts as one activity, attempted the moment the reader opens it,
    plus one for every non-optional activity on the page they have interacted
    with.  Interacting with the same activity twice still counts once.

    Read from ``user_interactions``: the page view is the row under
    ``page_interaction_key(chapter, subchapter)``, and an activity counts when
    the student touched it at all.  With a deadline, what matters is whether
    the *first* interaction came before it.

    :param chapter: the chapter label (``questions.chapter``).
    :param subchapter: the subchapter label (``questions.subchapter``).
    :param base_course: the base course the questions belong to.
    :param course_name: the course to count in.
    :param sid: the student's username.
    :param deadline: when given, activity after it does not count.
    :return: the number of activities attempted, the page itself included.
    """
    # Same filter as the progress bar: only activities that came from the book
    # source and are not marked optional are ones the reader was asked to do.
    # The page's own question row is not an activity -- it is counted by the
    # page view below.
    activity_names = select(Question.name).where(
        (Question.subchapter == subchapter)
        & (Question.chapter == chapter)
        & (Question.from_source == True)  # noqa: E712
        & (
            (Question.optional == False)  # noqa: E712
            | (Question.optional.is_(None))  # noqa: E711
        )
        & (Question.base_course == base_course)
        & (Question.question_type != "page")
    )
    page_key = page_interaction_key(chapter, subchapter)
    query = (
        select(
            func.count(distinct(UserInteraction.div_id)).filter(
                UserInteraction.div_id != page_key
            ),
            func.count().filter(UserInteraction.div_id == page_key),
        )
        .join(*since_term_start())
        .where(
            (UserInteraction.course_name == course_name)
            & (UserInteraction.sid == sid)
            & (
                UserInteraction.div_id.in_(activity_names)
                | (UserInteraction.div_id == page_key)
            )
        )
    )
    if deadline is not None:
        query = query.where(UserInteraction.first_interaction <= deadline)

    async with async_session() as session:
        activities, page_views = (await session.execute(query)).one()

    return int(activities or 0) + (1 if page_views else 0)


async def fetch_page_activity_counts(
    chapter: str, subchapter: str, base_course: str, course_name: str, username: str
) -> Dict[str, int]:
    """
    Used for the progress bar at the bottom of each page.  This function
    finds all of the components for a particular page (chaper/subchapter)
    and then finds out which of those elements the student has interacted
    with.  It returns a dictionary of {divid: 0/1}

    Every subchapter also owns a question row of its own, with
    ``question_type == "page"`` and a name of ``chapter title/subchapter title``
    (see ``_add_page_question`` in build_tools and ``addPageToDB`` in
    componentdb).  That row is not an activity the reader can do, but it does
    belong in this dict: the progress bar counts the page itself as one item,
    attempted as soon as the page is opened, which is what lets a page with no
    activities on it still be completed.  It is returned under the key ``page``,
    which is the key the client uses for that pseudo-activity -- otherwise
    PageProgressBar adds a ``page`` entry of its own on top of it and every page
    reports one more activity than it has.
    """

    where_clause_common = (
        (Question.subchapter == subchapter)
        & (Question.chapter == chapter)
        & (Question.from_source == True)  # noqa: E712
        & (
            (Question.optional == False)  # noqa: E712
            | (Question.optional.is_(None))  # noqa: E711
        )
        & (Question.base_course == base_course)
    )

    query = select(Question).where(where_clause_common)

    async with async_session() as session:
        page_divids = await session.execute(query)
    rslogger.debug(f"PDVD {page_divids}")
    div_counts = {
        ("page" if q.question_type == "page" else q.name): 0
        for q in page_divids.scalars()
    }
    # Which of them this student has touched.  The "page" entry is left at 0:
    # the client marks the page itself as attempted once it loads.
    for div_id in await fetch_touched_div_ids(
        course_name, username, [name for name in div_counts if name != "page"]
    ):
        div_counts[div_id] = 1

    return div_counts


# User Progress
# -------------


async def create_user_state_entry(user_id: int, course_name: str) -> UserStateValidator:
    """
    Create a new UserState entry with the given user id (user_id) and course name (course_name)

    :param user_id: int, the id of the user
    :param course_name: str, the name of the course
    :return: UserStateValidator, the newly created UserStateValidator object
    """
    new_us = UserState(user_id=user_id, course_name=course_name)
    async with async_session.begin() as session:
        session.add(new_us)
    return UserStateValidator.from_orm(new_us)


async def update_user_state(user_data: schemas.LastPageData):
    """
    Update the UserState entry with the given user data (user_data)

    :param user_data: LastPageData, the LastPageData object representing the user data
    """
    ud = user_data.dict()
    # LastPageData contains information for both user_state and user_sub_chapter_progress tables
    # we do not need the completion flag in the user_state table
    ud.pop("completion_flag")
    rslogger.debug(f"user data = {ud}")
    stmt = (
        update(UserState)
        .where(
            (UserState.user_id == user_data.user_id)
            & (UserState.course_name == user_data.course_name)
        )
        .values(**ud)
    )
    async with async_session.begin() as session:
        await session.execute(stmt)
    rslogger.debug("SUCCESS")


async def update_sub_chapter_progress(user_data: schemas.LastPageData):
    """
    Update the UserSubChapterProgress entry with the given user data (user_data)

    :param user_data: LastPageData, the LastPageData object representing the user data
    """
    ud = user_data.dict()
    ud.pop("last_page_url")
    ud.pop("last_page_scroll_location")
    ud.pop("last_page_accessed_on")
    ud["status"] = ud.pop("completion_flag")
    ud["chapter_id"] = ud.pop("last_page_chapter")
    ud["sub_chapter_id"] = ud.pop("last_page_subchapter")
    if ud["status"] > -1:
        ud["end_date"] = canonical_utcnow()

    stmt = (
        update(UserSubChapterProgress)
        .where(
            (UserSubChapterProgress.user_id == user_data.user_id)
            & (UserSubChapterProgress.chapter_id == user_data.last_page_chapter)
            & (UserSubChapterProgress.sub_chapter_id == user_data.last_page_subchapter)
            & (
                (UserSubChapterProgress.course_name == user_data.course_name)
                | (
                    UserSubChapterProgress.course_name.is_(None)
                )  # Back fill for old entries without course
            )
        )
        .values(**ud)
    )
    async with async_session.begin() as session:
        await session.execute(stmt)


async def fetch_last_page(user: AuthUserValidator, course_name: str):
    """
    Retrieve the last page accessed by the given user (user) for the given course name (course_name)

    :param user: AuthUserValidator, the AuthUserValidator object representing the user
    :param course_name: str, the name of the course
    :return: Tuple[str, str, str, str, str], a tuple representing the last page accessed
    """
    course = await fetch_course(course_name)

    query = (
        select(
            UserState.last_page_url,
            UserState.last_page_hash,
            Chapter.chapter_name,
            UserState.last_page_scroll_location,
            SubChapter.sub_chapter_name,
        )
        .where(
            (UserState.user_id == user.id)
            & (UserState.last_page_chapter == Chapter.chapter_label)
            & (UserState.course_name == course.course_name)
            & (SubChapter.chapter_id == Chapter.id)
            & (UserState.last_page_subchapter == SubChapter.sub_chapter_label)
            & (Chapter.course_id == course.base_course)
        )
        .order_by(UserState.last_page_accessed_on.desc())
    )

    async with async_session() as session:
        res = await session.execute(query)
        # for A query like this one with columns from multiple tables
        # res.first() returns a tuple
        rslogger.debug(f"LP {res}")
        PageData = namedtuple("PageData", [col for col in res.keys()])  # type: ignore
        rdata = res.first()
        rslogger.debug(f"{rdata=}")
        if rdata:
            return PageData(*rdata)
        else:
            return None


async def fetch_user_sub_chapter_progress(
    user, last_page_chapter=None, last_page_subchapter=None
) -> List[UserSubChapterProgressValidator]:
    """
    Retrieve the UserSubChapterProgress entries for the given user (user) and optional chapter and subchapter.

    :param user: AuthUserValidator, the AuthUserValidator object representing the user
    :param last_page_chapter: str, the chapter label of the last page accessed (optional)
    :param last_page_subchapter: str, the subchapter label of the last page accessed (optional)
    :return: List[UserSubChapterProgressValidator], a list of UserSubChapterProgressValidator objects
    """
    where_clause = (UserSubChapterProgress.user_id == user.id) & (
        UserSubChapterProgress.course_name == user.course_name
    )

    if last_page_chapter:
        where_clause = (
            where_clause
            & (UserSubChapterProgress.chapter_id == last_page_chapter)
            & (UserSubChapterProgress.sub_chapter_id == last_page_subchapter)
        )

    query = select(UserSubChapterProgress).where(where_clause)

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return [
            UserSubChapterProgressValidator.from_orm(x)
            for x in res.scalars().fetchall()
        ]


async def create_user_sub_chapter_progress_entry(
    user, last_page_chapter, last_page_subchapter, status=-1
) -> UserSubChapterProgressValidator:
    """
    Create a new UserSubChapterProgress entry with the given user (user), chapter label (last_page_chapter),
    subchapter label (last_page_subchapter), and status (status)

    :param user: AuthUserValidator, the AuthUserValidator object representing the user
    :param last_page_chapter: str, the chapter label of the last page accessed
    :param last_page_subchapter: str, the subchapter label of the last page accessed
    :param status: int, the completion status (default is -1)
    :return: UserSubChapterProgressValidator, the newly created UserSubChapterProgressValidator object
    """
    new_uspe = UserSubChapterProgress(
        user_id=user.id,
        chapter_id=last_page_chapter,
        sub_chapter_id=last_page_subchapter,
        status=status,
        start_date=canonical_utcnow(),
        course_name=user.course_name,
    )
    async with async_session.begin() as session:
        session.add(new_uspe)
    return UserSubChapterProgressValidator.from_orm(new_uspe)


async def fetch_user_chapter_progress(
    user, last_page_chapter: str
) -> UserChapterProgressValidator:
    """
    Retrieve the UserChapterProgress entry for the given user (user) and chapter label (last_page_chapter).

    :param user: AuthUserValidator, the AuthUserValidator object representing the user
    :param last_page_chapter: str, the chapter label of the last page accessed
    :return: UserChapterProgressValidator, the UserChapterProgressValidator object
    """
    query = select(UserChapterProgress).where(
        (
            UserChapterProgress.user_id == str(user.id)
        )  # TODO: this is bad! the DB has user.id as a string!
        & (UserChapterProgress.chapter_id == last_page_chapter)
    )

    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        return UserChapterProgressValidator.from_orm(res.scalars().first())


async def fetch_user_chapter_progress_for(
    user, chapter_labels: List[str]
) -> Dict[str, UserChapterProgressValidator]:
    """
    Retrieve the user's UserChapterProgress entries for several chapters at once.

    :param user: AuthUserValidator, the user
    :param chapter_labels: the chapter labels to look up
    :return: a dict mapping chapter label to its UserChapterProgressValidator;
        chapters with no entry are absent
    """
    if not chapter_labels:
        return {}
    query = (
        select(UserChapterProgress)
        .where(
            (UserChapterProgress.user_id == str(user.id))  # stored as a string
            & (UserChapterProgress.chapter_id.in_(chapter_labels))
        )
        .order_by(UserChapterProgress.id)
    )
    async with async_session() as session:
        res = await session.execute(query)
        progress: Dict[str, UserChapterProgressValidator] = {}
        for row in res.scalars():
            progress.setdefault(
                row.chapter_id, UserChapterProgressValidator.from_orm(row)
            )
        return progress


async def create_user_chapter_progress_entry(
    user, last_page_chapter, status
) -> UserChapterProgressValidator:
    """
    Create a new UserChapterProgress entry with the given user (user), chapter label (last_page_chapter), and status (status)

    :param user: AuthUserValidator, the AuthUserValidator object representing the user
    :param last_page_chapter: str, the chapter label of the last page accessed
    :param status: int, the completion status
    :return: UserChapterProgressValidator, the newly created UserChapterProgressValidator object
    """
    new_ucp = UserChapterProgress(
        user_id=str(user.id),
        chapter_id=last_page_chapter,
        status=status,
        start_date=canonical_utcnow(),
    )
    async with async_session.begin() as session:
        session.add(new_ucp)
    return UserChapterProgressValidator.from_orm(new_ucp)
