from typing import List, Tuple, Dict, Any
from sqlalchemy import select, update

from ..models import Library, LibraryValidator, BookAuthor, Courses, UserCourse
from sqlalchemy import func
from ..async_session import async_session
from rsptx.logging import rslogger


async def fetch_library_books():
    """
    Retrieve a list of visible library books ordered by shelf section and title.

    :return: List[LibraryValidator], a list of LibraryValidator objects
    """
    query = (
        select(Library)
        .where(Library.is_visible == True)  # noqa: E712
        .order_by(Library.shelf_section, Library.title)
    )
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        book_list = [LibraryValidator.from_orm(x) for x in res.scalars().fetchall()]
        return book_list


async def fetch_library_book(book):
    """
    Retrieve the Library entry for the given book.

    :param book: str, the name of the book
    :return: Library, the Library object
    """
    query = select(Library).where(Library.basecourse == book)  # noqa: E712
    async with async_session() as session:
        res = await session.execute(query)
        # the result type of this query is a sqlalchemy CursorResult
        # .all will return a list of Rows
        ret = res.scalars().first()
        # the result of .scalars().first() is a single Library object

        return ret


async def update_library_book(bookid: int, vals: dict):
    """
    Update the Library entry with the given bookid and values.

    :param bookid: int, the id of the book
    :param vals: dict, a dictionary of values to update
    """

    stmt = update(Library).where(Library.id == bookid).values(**vals)
    async with async_session.begin() as session:
        await session.execute(stmt)


# TODO finish this use bookid as title temporarily
async def create_library_book(bookid: str, vals: Dict[str, Any]) -> None:
    """
    Creates a new Library object using the provided parameters and saves it in the database.

    :param bookid: str, the unique identifier of the book
    :param vals: Dict[str, Any], the dictionary containing the properties of the book
    :return: None
    """
    new_book = Library(**vals, basecourse=bookid)
    async with async_session.begin() as session:
        session.add(new_book)


async def create_book_author(author: str, document_id: str) -> None:
    """
    Creates a new BookAuthor object using the provided parameters and saves it in the database.

    :param author: str, the name of the author
    :param document_id: str, the unique identifier of the book
    :return: None
    """
    new_ba = BookAuthor(author=author, book=document_id)
    async with async_session.begin() as session:
        session.add(new_ba)


async def fetch_books_by_author(author: str) -> List[Tuple[Library, BookAuthor]]:
    """
    Fetches all books written by a given author.

    :param author: The name of the author.
    :type author: str
    :return: A list of tuples, each containing a Library and a BookAuthor object.
    :rtype: list[tuple[Library, BookAuthor]]
    """
    query = (
        select(Library, BookAuthor)
        .join(BookAuthor, BookAuthor.book == Library.basecourse)
        .where(BookAuthor.author == author)
        .order_by(BookAuthor.book)
    )
    async with async_session() as sess:
        res = await sess.execute(query)
        return res.fetchall()


# Used by the library page
async def get_students_per_basecourse() -> dict:
    """
    Gets the number of students using a book for each course.

    :return: A dictionary containing the course name and the number of students using it.
    :rtype: Dict[str,int]
    """
    query = (
        select(Courses.base_course, func.count(UserCourse.user_id))
        .join(UserCourse, Courses.id == UserCourse.course_id)
        .group_by(Courses.base_course)
    )
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        retval = {}
        for row in res.all():
            retval[row[0]] = row[1]

        return retval


async def get_courses_per_basecourse() -> dict:
    """
    Gets the number of courses using a basecourse.

    :return: A dictionary containing the base course name and the number of courses using it.
    :rtype: Dict[str,int]
    """
    query = select(Courses.base_course, func.count(Courses.id)).group_by(
        Courses.base_course
    )
    async with async_session() as session:
        res = await session.execute(query)
        rslogger.debug(f"{res=}")
        retval = {}
        for row in res.all():
            retval[row[0]] = row[1]

        return retval
