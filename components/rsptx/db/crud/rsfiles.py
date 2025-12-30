from sqlalchemy import select, and_, or_

from ..models import SourceCode, SourceCodeValidator
from ..async_session import async_session
from ..sync_session import sync_session

from rsptx.logging import rslogger


# We need a synchronous version of this function for use in manifest_data_to_db
# if/when process_manifest moves to being async we could remove this
def update_source_code_sync(acid: str, filename: str, course_id: str, main_code: str, owner: str = None):
    """
    Update the source code for a given acid or filename
    """
    query = select(SourceCode).where(
        and_(
            SourceCode.acid == acid,
            SourceCode.course_id == course_id,
        )
    )
    with sync_session() as session:
        res = session.execute(query)
        source_code_obj = res.scalars().first()
        if source_code_obj:
            source_code_obj.main_code = main_code
            source_code_obj.filename = filename
            if owner is not None:
                source_code_obj.owner = owner
            session.add(source_code_obj)
        else:
            new_entry = SourceCode(
                acid=acid,
                filename=filename,
                course_id=course_id,
                main_code=main_code,
                owner=owner,
            )
            session.add(new_entry)
        session.commit()


async def update_source_code(acid: str, filename: str, course_id: str, main_code: str, owner: str = None):
    """
    Update the source code for a given acid or filename
    """
    query = select(SourceCode).where(
        and_(
            SourceCode.acid == acid,
            SourceCode.course_id == course_id,
        )
    )
    async with async_session() as session:
        res = await session.execute(query)
        source_code_obj = res.scalars().first()
        if source_code_obj:
            source_code_obj.main_code = main_code
            source_code_obj.filename = filename
            if owner is not None:
                source_code_obj.owner = owner
            session.add(source_code_obj)
        else:
            new_entry = SourceCode(
                acid=acid,
                filename=filename,
                course_id=course_id,
                main_code=main_code,
                owner=owner,
            )
            session.add(new_entry)
        await session.commit()


async def check_datafile_exists(filename: str, owner: str, course_id: str) -> bool:
    """
    Check if a datafile with the same filename, owner, and course already exists.

    :param filename: str, the filename to check
    :param owner: str, the owner (username) to check
    :param course_id: str, the course_id to check
    :return: bool, True if exists, False otherwise
    """
    query = select(SourceCode).where(
        and_(
            SourceCode.filename == filename,
            SourceCode.owner == owner,
            SourceCode.course_id == course_id,
        )
    )
    async with async_session() as session:
        res = await session.execute(query)
        return res.scalars().first() is not None


def generate_datafile_acid(filename: str, owner: str, course_id: str) -> str:
    """
    Generate a unique acid for a datafile based on filename, owner, and course_id.

    :param filename: str, the filename
    :param owner: str, the owner (username)
    :param course_id: str, the course_id
    :return: str, the generated acid
    """
    # Sanitize components to remove special characters
    safe_filename = filename.replace("/", "_").replace("\\", "_").replace(" ", "_")
    safe_owner = owner.replace("@", "_at_").replace(" ", "_")
    safe_course = course_id.replace(" ", "_")
    return f"datafile_{safe_course}_{safe_owner}_{safe_filename}"


async def fetch_source_code(
    base_course: str, course_name: str, acid: str = None, filename: str = None
) -> SourceCodeValidator:
    """
    Fetch the source code for a given acid or filename

    Note that filenames are not guaranteed to be unique within a course, so
    acid is the preferred lookup method.

    :param acid: str, the acid of the source code
    :return: SourceCodeValidator, the SourceCodeValidator object
    """
    rslogger.debug(f"fetch_source_code: -{acid}-{filename}-{course_name}-{base_course}")
    if acid is None and filename is None:
        return None
    elif acid is None:
        # match against filename or acid for backwards compatibility
        query = select(SourceCode).where(
            and_(
                or_(
                    SourceCode.filename == filename,
                    SourceCode.acid == filename,
                ),
                or_(
                    SourceCode.course_id == base_course,
                    SourceCode.course_id == course_name,
                ),
            )
        )
    else:
        query = select(SourceCode).where(
            and_(
                SourceCode.acid == acid,
                or_(
                    SourceCode.course_id == base_course,
                    SourceCode.course_id == course_name,
                ),
            )
        )
    async with async_session() as session:
        res = await session.execute(query)
        return SourceCodeValidator.from_orm(res.scalars().first())


async def fetch_all_datafiles(base_course: str, course_name: str) -> list:
    """
    Fetch all datafiles (source_code entries) for a course.

    Fetches from both base_course and course_name to support derived courses
    that may have copied datafiles.

    :param base_course: str, the base course ID
    :param course_name: str, the current course name
    :return: list of SourceCodeValidator objects
    """
    query = select(SourceCode).where(
        or_(
            SourceCode.course_id == base_course,
            SourceCode.course_id == course_name,
        )
    )
    async with async_session() as session:
        res = await session.execute(query)
        results = res.scalars().all()
        return [SourceCodeValidator.from_orm(item) for item in results]


async def fetch_datafile_by_acid(acid: str, course_id: str) -> SourceCodeValidator:
    """
    Fetch a datafile by its acid and course_id.

    :param acid: str, the acid of the datafile
    :param course_id: str, the course_id
    :return: SourceCodeValidator or None
    """
    query = select(SourceCode).where(
        and_(
            SourceCode.acid == acid,
            SourceCode.course_id == course_id,
        )
    )
    async with async_session() as session:
        res = await session.execute(query)
        result = res.scalars().first()
        if result:
            return SourceCodeValidator.from_orm(result)
        return None


async def update_datafile(
    acid: str,
    course_id: str,
    main_code: str,
) -> bool:
    """
    Update an existing datafile's content.
    Note: Filename cannot be changed after creation.

    :param acid: str, the acid of the datafile to update
    :param course_id: str, the course_id
    :param main_code: str, new content
    :return: bool, True if updated, False if not found
    """
    query = select(SourceCode).where(
        and_(
            SourceCode.acid == acid,
            SourceCode.course_id == course_id,
        )
    )
    async with async_session() as session:
        res = await session.execute(query)
        source_code_obj = res.scalars().first()
        if not source_code_obj:
            return False

        source_code_obj.main_code = main_code

        session.add(source_code_obj)
        await session.commit()
        return True


async def delete_datafile(acid: str, course_id: str) -> bool:
    """
    Delete a datafile by its acid and course_id.

    :param acid: str, the acid of the datafile to delete
    :param course_id: str, the course_id
    :return: bool, True if deleted, False if not found
    """
    query = select(SourceCode).where(
        and_(
            SourceCode.acid == acid,
            SourceCode.course_id == course_id,
        )
    )
    async with async_session() as session:
        res = await session.execute(query)
        source_code_obj = res.scalars().first()
        if not source_code_obj:
            return False

        await session.delete(source_code_obj)
        await session.commit()
        return True



