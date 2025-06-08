from sqlalchemy import select, and_, or_

from ..models import SourceCode, SourceCodeValidator
from ..async_session import async_session
from ..sync_session import sync_session

from rsptx.logging import rslogger


# We need a synchronous version of this function for use in manifest_data_to_db
# if/when process_manifest moves to being async we could remove this
def update_source_code_sync(acid: str, filename: str, course_id: str, main_code: str):
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
            session.add(source_code_obj)
        else:
            new_entry = SourceCode(
                acid=acid,
                filename=filename,
                course_id=course_id,
                main_code=main_code,
            )
            session.add(new_entry)
        session.commit()


async def update_source_code(acid: str, filename: str, course_id: str, main_code: str):
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
            session.add(source_code_obj)
        else:
            new_entry = SourceCode(
                acid=acid,
                filename=filename,
                course_id=course_id,
                main_code=main_code,
            )
            session.add(new_entry)
        await session.commit()


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
