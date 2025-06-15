import datetime
from typing import Optional
from sqlalchemy import select, delete

from ..models import (
    CoursePractice,
    UserTopicPractice,
    UserTopicPracticeValidator,
    AuthUserValidator,
    Question,
    QuestionValidator,
)
from ..async_session import async_session
from rsptx.logging import rslogger


async def fetch_course_practice(course_name: str) -> Optional[CoursePractice]:
    """
    Fetches the course practice row for a given course.

    :param course_name: The name of the course.
    :type course_name: str
    :return: The CoursePractice object containing the configuration of the practice feature for the given course.
    :rtype: Optional[CoursePractice]
    """
    query = (
        select(CoursePractice)
        .where(CoursePractice.course_name == course_name)
        .order_by(CoursePractice.id.desc())
    )
    async with async_session() as session:
        res = await session.execute(query)
        return res.scalars().first()


async def fetch_one_user_topic_practice(
    user: AuthUserValidator,
    last_page_chapter: str,
    last_page_subchapter: str,
) -> UserTopicPracticeValidator:
    """
    The user_topic_practice table contains information about each topic (flashcard)
    that a student is eligible to see for a given topic in a course.
    A particular topic should ony be in the table once per student.  This row also contains
    information about scheduling and correctness to help the practice algorithm select the
    best question to show a student.

    Retrieve a single UserTopicPractice entry for the given user, chapter, and subchapter (i.e., topic).

    :param user: AuthUserValidator, the AuthUserValidator object
    :param last_page_chapter: str, the label of the chapter
    :param last_page_subchapter: str, the label of the subchapter
    :param qname: str, the name of the question
    :return: UserTopicPracticeValidator, the UserTopicPracticeValidator object
    """
    query = select(UserTopicPractice).where(
        (UserTopicPractice.user_id == user.id)
        & (UserTopicPractice.course_name == user.course_name)
        & (UserTopicPractice.chapter_label == last_page_chapter)
        & (UserTopicPractice.sub_chapter_label == last_page_subchapter)
    )
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        utp = res.scalars().first()
        return UserTopicPracticeValidator.from_orm(utp)


async def delete_one_user_topic_practice(dbid: int) -> None:
    """
    Delete a single UserTopicPractice entry for the given id.

    Used by self-paced topic selection.  If a student un-marks a page as completed then if there
    is a card from the page it will be removed from the set of possible flashcards a student
    can see.

    :param qid: int, the id of the UserTopicPractice entry
    :return: None
    """
    query = delete(UserTopicPractice).where(UserTopicPractice.id == dbid)
    async with async_session.begin() as session:
        await session.execute(query)


async def create_user_topic_practice(
    user: AuthUserValidator,
    last_page_chapter: str,
    last_page_subchapter: str,
    qname: str,
    now_local: datetime.datetime,
    now: datetime.datetime,
    tz_offset: float,
):
    """
    Add a new UserTopicPractice entry for the given user, chapter, subchapter, and question.

    :param user: AuthUserValidator, the AuthUserValidator object
    :param last_page_chapter: str, the label of the chapter
    :param last_page_subchapter: str, the label of the subchapter
    :param qname: str, the name of the question to be assigned first when the topic is presented; will be rotated
    :param now_local: datetime.datetime, the current local datetime
    :param now: datetime.datetime, the current utc datetime
    :param tz_offset: float, the timezone offset
    :return: None
    """
    async with async_session.begin() as session:
        new_entry = UserTopicPractice(
            user_id=user.id,
            course_name=user.course_name,
            chapter_label=last_page_chapter,
            sub_chapter_label=last_page_subchapter,
            question_name=qname,
            # Treat it as if the first eligible question is the last one asked.
            i_interval=0,
            e_factor=2.5,
            next_eligible_date=now_local.date(),
            # add as if yesterday, so can practice right away
            last_presented=now - datetime.timedelta(1),
            last_completed=now - datetime.timedelta(1),
            creation_time=now,
            timezoneoffset=tz_offset,
        )
        session.add(new_entry)


async def fetch_qualified_questions(
    base_course: str, chapter_label: str, sub_chapter_label: str
) -> list[QuestionValidator]:
    """
    Retrieve a list of qualified questions for a given chapter and subchapter.

    :param base_course: str, the base course
    :param chapter_label: str, the label of the chapter
    :param sub_chapter_label: str, the label of the subchapter
    :return: list[QuestionValidator], a list of QuestionValidator objects
    """
    query = select(Question).where(
        (Question.base_course == base_course)
        & (
            (Question.topic == f"{chapter_label}/{sub_chapter_label}")
            | (
                (Question.chapter == chapter_label)
                & (Question.topic.is_(None))
                & (Question.subchapter == sub_chapter_label)
            )
        )
        & (Question.practice == True)  # noqa: E712
        & (Question.review_flag == False)  # noqa: E712
    )
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        questionlist = [QuestionValidator.from_orm(x) for x in res.scalars().fetchall()]

    return questionlist
