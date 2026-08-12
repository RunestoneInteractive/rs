# generate imports
import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func, and_, delete, update
from ..models import (
    Base,
    Courses,
    UserCourse,
    AuthUser,
    CoursesValidator,
    AuthUserValidator,
    CourseInstructor,
    CourseInstructorValidator,
    CourseAttribute,
    CourseLtiMap,
    CoursePractice,
    PracticeGrade,
    SubChapterTaught,
    UserState,
    UserSubChapterProgress,
    UserTopicPractice,
    UserTopicPracticeCompletion,
    UserTopicPracticeFeedback,
    UserTopicPracticeLog,
    UserTopicPracticeSurvey,
    Code,
    QuestionGrade,
    Useinfo,
)
from ..async_session import async_session
from rsptx.logging import rslogger


# Courses
# -------
async def fetch_course(course_name: str) -> CoursesValidator:
    """
    Fetches a course by its name.

    :param course_name: The name of the course to be fetched.
    :type course_name: str
    :return: A CoursesValidator instance representing the fetched course.
    :rtype: CoursesValidator
    """
    query = select(Courses).where(Courses.course_name == course_name)
    async with async_session() as session:
        res = await session.execute(query)
        # When selecting ORM entries it is useful to use the ``scalars`` method
        # This modifies the result so that you are getting the ORM object
        # instead of a Row object. `See <https://docs.sqlalchemy.org/en/14/orm/queryguide.html#selecting-orm-entities-and-attributes>`_
        course = res.scalars().one_or_none()
        return CoursesValidator.from_orm(course)


async def fetch_course_by_id(course_id: int) -> CoursesValidator:
    """
    Fetches a course by its id.

    :param course_name: The id of the course to be fetched.
    :type course_name: int
    :return: A CoursesValidator instance representing the fetched course.
    :rtype: CoursesValidator
    """
    query = select(Courses).where(Courses.id == course_id)
    async with async_session() as session:
        res = await session.execute(query)
        # When selecting ORM entries it is useful to use the ``scalars`` method
        # This modifies the result so that you are getting the ORM object
        # instead of a Row object. `See <https://docs.sqlalchemy.org/en/14/orm/queryguide.html#selecting-orm-entities-and-attributes>`_
        course = res.scalars().one_or_none()
        return CoursesValidator.from_orm(course)


async def fetch_courses_by_start_date(
    since: Optional[datetime.date] = None,
    until: Optional[datetime.date] = None,
) -> List[CoursesValidator]:
    """
    Fetches courses whose term_start_date falls in the given range.

    Used to scope bulk maintenance work (see ``rsmanage fixtotals``) to the terms
    that actually need it instead of every course ever created. Both bounds are
    inclusive, and omitting one leaves that end unbounded.

    Base courses are *not* filtered out here. They are normally book containers
    with no enrolled students, but that is a convention rather than a guarantee,
    and a maintenance sweep that silently skipped one would under-repair without
    saying so. Callers that genuinely want only derived sections should filter on
    ``course_name != base_course`` themselves.

    :param since: date, only courses starting on or after this date (inclusive)
    :type since: Optional[datetime.date]
    :param until: date, only courses starting on or before this date (inclusive)
    :type until: Optional[datetime.date]
    :return: A list of CoursesValidator instances, oldest term first.
    :rtype: List[CoursesValidator]
    """
    query = select(Courses)
    if since is not None:
        query = query.where(Courses.term_start_date >= since)
    if until is not None:
        query = query.where(Courses.term_start_date <= until)
    query = query.order_by(Courses.term_start_date, Courses.course_name)

    async with async_session() as session:
        res = await session.execute(query)
        return [CoursesValidator.from_orm(c) for c in res.scalars()]


async def fetch_base_course(base_course: str) -> CoursesValidator:
    """
    Fetches a base course by its name.

    :param base_course: The name of the base course to be fetched.
    :type base_course: str
    :return: A CoursesValidator instance representing the fetched base course.
    :rtype: CoursesValidator
    """
    query = select(Courses).where(
        (Courses.base_course == base_course) & (Courses.course_name == base_course)
    )
    async with async_session() as session:
        res = await session.execute(query)
        # When selecting ORM entries it is useful to use the ``scalars`` method
        # This modifies the result so that you are getting the ORM object
        # instead of a Row object. `See <https://docs.sqlalchemy.org/en/14/orm/queryguide.html#selecting-orm-entities-and-attributes>`_
        base_course = res.scalars().one_or_none()
        return CoursesValidator.from_orm(base_course)


async def create_course(course_info: CoursesValidator) -> None:
    """
    Creates a new course in the database.

    :param course_info: A CoursesValidator instance representing the course to be created.
    :type course_info: CoursesValidator
    :return: None
    """
    new_course = Courses(**course_info.dict())
    async with async_session.begin() as session:
        session.add(new_course)
    return new_course


async def user_in_course(user_id: int, course_id: int) -> bool:
    """
    Return true if given user is in indicated course

    :param user_id: int, the user id
    :param course_id: the id of the course
    :return: True / False
    """
    query = select(func.count(UserCourse.course_id)).where(
        and_(UserCourse.user_id == user_id, UserCourse.course_id == course_id)
    )
    async with async_session() as session:
        res = await session.execute(query)
        res_count = res.scalars().fetchall()[0]
        return res_count != 0


async def fetch_courses_for_user(
    user_id: int, course_id: Optional[int] = None
) -> UserCourse:
    """
    Retrieve a list of courses for a given user (user_id)

    :param user_id: int, the user id
    :param course_id: Optional[int], the id of the course (optional)
    :return: List[UserCourse], a list of UserCourse objects representing the courses
    """
    if course_id is None:
        query = select(Courses).where(
            and_(UserCourse.user_id == user_id, UserCourse.course_id == Courses.id)
        )
    else:
        query = select(Courses).where(
            and_(
                UserCourse.user_id == user_id,
                UserCourse.course_id == course_id,
                UserCourse.course_id == Courses.id,
            )
        )
    async with async_session() as session:
        res = await session.execute(query)
        # When selecting ORM entries it is useful to use the ``scalars`` method
        # This modifies the result so that you are getting the ORM object
        # instead of a Row object. `See <https://docs.sqlalchemy.org/en/14/orm/queryguide.html#selecting-orm-entities-and-attributes>`_
        course_list = [CoursesValidator.from_orm(x) for x in res.scalars().fetchall()]
        return course_list


#
async def fetch_users_for_course(course_name: str) -> list[AuthUserValidator]:
    """
    Retrieve a list of users/students enrolled in a given course (course_name)

    :param course_name: str, the name of the course
    :return: list[AuthUserValidator], a list of AuthUserValidator objects representing the users
    """
    course = await fetch_course(course_name)
    query = select(AuthUser).where(
        and_(
            UserCourse.user_id == AuthUser.id,
            UserCourse.course_id == course.id,
        )
    )
    async with async_session() as session:
        res = await session.execute(query)
        # When selecting ORM entries it is useful to use the ``scalars`` method
        # This modifies the result so that you are getting the ORM object
        # instead of a Row object. `See <https://docs.sqlalchemy.org/en/14/orm/queryguide.html#selecting-orm-entities-and-attributes>`_
        user_list = [AuthUserValidator.from_orm(x) for x in res.scalars().fetchall()]
        return user_list


async def create_user_course_entry(user_id: int, course_id: int) -> UserCourse:
    """
    Create a new user course entry for a given user (user_id) and course (course_id)

    :param user_id: int, the user id
    :param course_id: int, the course id
    :return: UserCourse, the newly created UserCourse object
    """
    new_uc = UserCourse(user_id=user_id, course_id=course_id)
    async with async_session.begin() as session:
        session.add(new_uc)

    return new_uc


async def delete_user_course_entry(user_id: int, course_id: int) -> None:
    """
    Delete a user course entry for a given user (user_id) and course (course_id)

    :param user_id: int, the user id
    :param course_id: int, the course id
    """
    query = delete(UserCourse).where(
        and_(UserCourse.user_id == user_id, UserCourse.course_id == course_id)
    )
    async with async_session.begin() as session:
        await session.execute(query)


# -----------------------------------------------------------------------
# Course Deletion Functions
# -----------------------------------------------------------------------


# Tables that hold course scoped rows but have **no** foreign key to ``courses``.
# Nothing stops the course row from going away while these remain, so they do not
# break the delete -- they just leave orphans behind. They have to be listed by
# hand because there is no constraint to discover them from.
#
# Deliberately *not* listed:
#
# - ``invoice_request`` -- a billing record that should outlive the course.
# - ``selected_questions`` -- keyed only by ``sid``, with no course column at all,
#   so there is no way to delete just this course's rows. Deleting by student id
#   (what this function used to do) wipes the student's selected questions in
#   every *other* course they are enrolled in as well.
# - ``chapters``, ``source_code``, ``questions``, ``editor_basecourse`` -- their
#   course columns hold a *base* course name, shared by every derived course.
_ORPHANS_BY_COURSE_NAME = (
    QuestionGrade,
    PracticeGrade,
    UserState,
    UserSubChapterProgress,
    SubChapterTaught,
    CoursePractice,
    UserTopicPractice,
    UserTopicPracticeCompletion,
    UserTopicPracticeFeedback,
    UserTopicPracticeLog,
    UserTopicPracticeSurvey,
)

_ORPHANS_BY_COURSE_ID = (
    Code,
    CourseLtiMap,
)


def _course_reference_deletes(course_id: int, course_name: str) -> list:
    """
    Build a DELETE statement for every table with a foreign key to ``courses``.

    These are the rows that actually *block* the delete: none of the answer table
    foreign keys are ``ON DELETE CASCADE``, so a single leftover row anywhere
    makes ``DELETE FROM courses`` fail. Deriving the list from the model metadata
    instead of writing it out by hand means a table added later is cleaned up
    automatically rather than silently breaking course deletion. (That is exactly
    how this broke: ``codelens``, ``matching``, ``unittest``, ``webwork``,
    ``splice``, ``microparsons`` and ``lp`` answers were added after the
    hand-written list and never got added to it.)

    :param course_id: int, the ``courses.id`` of the course being deleted
    :param course_name: str, the ``courses.course_name`` of the course
    :return: list of DELETE statements, children before parents
    """
    statements = []
    # ``sorted_tables`` is parents first; reverse it so children are deleted first.
    for table in reversed(Base.metadata.sorted_tables):
        if table.name == Courses.__tablename__:
            # The self reference (base_course) -- handled by the base course guard.
            continue
        for fk in table.foreign_keys:
            if fk.column.table.name != Courses.__tablename__:
                continue
            if fk.column.name == "course_name":
                statements.append(delete(table).where(fk.parent == course_name))
            elif fk.column.name == "id":
                statements.append(delete(table).where(fk.parent == course_id))
            else:
                # Unknown target column: better to fail loudly than to leave a
                # row behind that will block the delete with a confusing error.
                raise RuntimeError(
                    f"{table.name}.{fk.parent.name} references an unexpected "
                    f"courses column ({fk.column.name}); "
                    "delete_course_completely needs updating"
                )
    return statements


async def delete_course_completely(course_name: str) -> bool:
    """
    Completely delete a course and all associated data.

    WARNING: This is a destructive operation that cannot be undone.

    This function will delete:
    - All student enrollments in the course
    - All assignments and grades
    - All course sections
    - Student progress data (useinfo, timed_exam, all answer tables, etc.)
    - Course customizations and settings
    - LTI integrations

    Students in the course are not deleted; they are moved to the base course
    and marked inactive.

    Raises a ``RuntimeError`` describing the problem if the course cannot be
    deleted, so the caller can show the instructor something more useful than
    "it failed".

    :param course_name: str, the name of the course to delete
    :return: bool, True if the course was deleted, False if it did not exist
    """
    # A single transaction: if any step fails, nothing is deleted.
    async with async_session.begin() as session:
        course_result = await session.execute(
            select(Courses).where(Courses.course_name == course_name)
        )
        course = course_result.scalar_one_or_none()

        if not course:
            rslogger.warning(f"Course {course_name} not found for deletion")
            return False

        course_id = course.id
        rslogger.info(f"Starting deletion of course: {course_name} (ID: {course_id})")

        # A base course backs every course derived from it, plus its library
        # entry, questions and chapters. Deleting one through this path would
        # either fail on the self reference or quietly break other people's
        # courses, so refuse rather than half-delete it.
        if course.base_course == course_name:
            derived_result = await session.execute(
                select(func.count())
                .select_from(Courses)
                .where(
                    and_(
                        Courses.base_course == course_name,
                        Courses.course_name != course_name,
                    )
                )
            )
            derived_count = derived_result.scalar_one()
            raise RuntimeError(
                f"'{course_name}' is a base course"
                + (
                    f" with {derived_count} course(s) derived from it"
                    if derived_count
                    else ""
                )
                + ". Base courses cannot be deleted from this page."
            )

        # Where the students land once the course is gone. Read it inside this
        # transaction rather than through fetch_base_course(), which opens a
        # second connection while this one holds locks.
        base_result = await session.execute(
            select(Courses).where(
                and_(
                    Courses.course_name == course.base_course,
                    Courses.base_course == course.base_course,
                )
            )
        )
        base_course = base_result.scalars().one_or_none()
        if base_course is None:
            raise RuntimeError(
                f"Base course '{course.base_course}' for '{course_name}' is missing; "
                "cannot move students out of the course."
            )

        # 1. Move students out of the course before it disappears. auth_user has
        #    no foreign key to courses, so this is bookkeeping rather than a
        #    constraint requirement, but it has to happen while we still know
        #    which students were enrolled.
        rslogger.info("Updating student enrollments...")
        await session.execute(
            update(AuthUser)
            .where(AuthUser.course_id == course_id)
            .values(
                course_id=base_course.id,
                course_name=base_course.course_name,
                active="F",
            )
        )

        # 2. Everything with a foreign key to courses. This is the part that must
        #    be exhaustive -- anything missed blocks the final delete.
        rslogger.info("Deleting rows that reference the course...")
        for stmt in _course_reference_deletes(course_id, course_name):
            await session.execute(stmt)

        # 3. Course scoped rows with no foreign key. These would not block the
        #    delete, but leaving them behind orphans data forever.
        rslogger.info("Deleting course scoped data with no foreign key...")
        for model in _ORPHANS_BY_COURSE_NAME:
            await session.execute(delete(model).where(model.course_name == course_name))
        for model in _ORPHANS_BY_COURSE_ID:
            await session.execute(delete(model).where(model.course_id == course_id))

        # 4. Finally the course itself.
        rslogger.info("Deleting course record...")
        await session.execute(delete(Courses).where(Courses.id == course_id))

        rslogger.info(f"Successfully deleted course: {course_name}")
        return True


async def delete_course_instructor(course_id: int, instructor_id: int) -> None:
    """
    Remove an instructor from a course by deleting the CourseInstructor relationship.

    :param course_id: int, the id of the course
    :param instructor_id: int, the id of the instructor to remove
    :return: None
    """
    stmt = delete(CourseInstructor).where(
        (CourseInstructor.course == course_id)
        & (CourseInstructor.instructor == instructor_id)
    )

    async with async_session() as session:
        await session.execute(stmt)
        await session.commit()


async def create_course_instructor(course_id: int, instructor_id: int) -> None:
    """
    Add an instructor to a course by creating a new CourseInstructor relationship.

    :param course_id: int, the id of the course
    :param instructor_id: int, the id of the instructor to add
    :return: None
    """
    new_entry = CourseInstructor(course=course_id, instructor=instructor_id)
    async with async_session.begin() as session:
        session.add(new_entry)


async def update_course_settings(course_id: int, setting: str, value: str) -> None:
    """
    Update a course setting/attribute. Handles both special course table fields
    and course attributes.

    :param course_id: int, the id of the course
    :param setting: str, the setting name to update
    :param value: str, the value to set
    :return: None
    :raises ValueError: If date format is invalid for new_date setting
    """
    async with async_session() as session:
        # Handle special course table fields
        if setting in ["new_date", "allow_pairs", "downloads_enabled", "timezone"]:
            if setting == "new_date":
                # Update term_start_date in courses table
                import datetime

                try:
                    new_date = datetime.datetime.strptime(value, "%Y-%m-%d").date()
                    stmt = (
                        update(Courses)
                        .where(Courses.id == course_id)
                        .values(term_start_date=new_date)
                    )
                    await session.execute(stmt)
                except ValueError:
                    raise ValueError("Invalid date format")

            elif setting == "allow_pairs":
                bool_val = value.lower() == "true"
                stmt = (
                    update(Courses)
                    .where(Courses.id == course_id)
                    .values(allow_pairs=bool_val)
                )
                await session.execute(stmt)

            elif setting == "downloads_enabled":
                bool_val = value.lower() == "true"
                stmt = (
                    update(Courses)
                    .where(Courses.id == course_id)
                    .values(downloads_enabled=bool_val)
                )
                await session.execute(stmt)
            elif setting == "timezone":
                # Validate timezone using IANA database if available
                try:
                    from zoneinfo import ZoneInfo  # Python 3.9+

                    _ = ZoneInfo(value)
                except Exception:
                    raise ValueError("Invalid timezone")

                stmt = (
                    update(Courses)
                    .where(Courses.id == course_id)
                    .values(timezone=value)
                )
                await session.execute(stmt)
        else:
            # Handle course attributes
            # Check if attribute exists
            stmt = select(CourseAttribute).where(
                (CourseAttribute.course_id == course_id)
                & (CourseAttribute.attr == setting)
            )
            result = await session.execute(stmt)
            existing_attr = result.scalar_one_or_none()

            if existing_attr:
                # Update existing attribute
                stmt = (
                    update(CourseAttribute)
                    .where(
                        (CourseAttribute.course_id == course_id)
                        & (CourseAttribute.attr == setting)
                    )
                    .values(value=str(value))
                )
                await session.execute(stmt)
            else:
                # Create new attribute
                new_attr = CourseAttribute(
                    course_id=course_id,
                    attr=setting,
                    value=str(value),
                )
                session.add(new_attr)

        await session.commit()


async def fetch_available_students_for_instructor_add(
    course_id: int,
) -> List[Dict[str, Any]]:
    """
    Fetch students in the course who are not already instructors.
    """
    async with async_session() as session:
        students_stmt = (
            select(AuthUser)
            .join(UserCourse, AuthUser.id == UserCourse.user_id)
            .where(UserCourse.course_id == course_id)
        )
        students = (await session.execute(students_stmt)).scalars().all()
        instructors_stmt = select(CourseInstructor.instructor).where(
            CourseInstructor.course == course_id
        )
        instructor_ids = set((await session.execute(instructors_stmt)).scalars().all())
        available_students = [
            AuthUserValidator.from_orm(s).model_dump()
            for s in students
            if s.id not in instructor_ids
        ]
        return available_students


async def fetch_current_instructors_for_course(course_id: int) -> List[Dict[str, Any]]:
    """
    Fetch all instructors for a given course.
    """
    async with async_session() as session:
        stmt = (
            select(AuthUser)
            .join(CourseInstructor, AuthUser.id == CourseInstructor.instructor)
            .where(CourseInstructor.course == course_id)
        )
        instructors = (await session.execute(stmt)).scalars().all()
        return [AuthUserValidator.from_orm(i).model_dump() for i in instructors]


async def fetch_instructor_courses(
    instructor_id: int, course_id: Optional[int] = None
) -> List[CourseInstructorValidator]:
    """
    Retrieve a list of courses for which the given instructor id (instructor_id) is an instructor.
    If the optional course_id value is included then return the row for that
    course to verify that instructor_id is an instructor for course_id

    :param instructor_id: int, the id of the instructor
    :param course_id: Optional[int], the id of the course (if provided)
    :return: List[CourseInstructorValidator], a list of CourseInstructorValidator objects representing the courses
    """
    query = select(CourseInstructor)
    if course_id is not None:
        query = query.where(
            and_(
                CourseInstructor.instructor == instructor_id,
                CourseInstructor.course == course_id,
            )
        )
    else:
        query = query.where(CourseInstructor.instructor == instructor_id)
    async with async_session() as session:
        res = await session.execute(query)

        course_list = [
            CourseInstructorValidator.from_orm(x) for x in res.scalars().fetchall()
        ]
        return course_list


async def fetch_course_instructors(
    course_name: Optional[str] = None,
) -> List[AuthUserValidator]:
    """
    Retrieve a list of instructors for the given course name (course_name).
    If course_name is not provided, return a list of all instructors.

    :param course_name: Optional[str], the name of the course (if provided)
    :return: List[AuthUserValidator], a list of AuthUserValidator objects representing the instructors
    """
    query = select(AuthUser).join(CourseInstructor)
    if course_name:
        course = await fetch_course(course_name)
        query = query.where(CourseInstructor.course == course.id)
    async with async_session() as session:
        res = await session.execute(query)

    instructor_list = [AuthUserValidator.from_orm(x) for x in res.scalars().fetchall()]
    return instructor_list


async def create_instructor_course_entry(iid: int, cid: int) -> CourseInstructor:
    """
    Create a new CourseInstructor entry with the given instructor id (iid) and course id (cid)
    Sanity checks to make sure that the instructor is not already associated with the course

    :param iid: int, the id of the instructor
    :param cid: int, the id of the course
    :return: CourseInstructor, the newly created CourseInstructor object
    """

    async with async_session.begin() as session:
        res = await session.execute(
            select(CourseInstructor).where(
                (CourseInstructor.course == cid) & (CourseInstructor.instructor == iid)
            )
        )
        ci = res.scalars().first()
        if ci is None:
            ci = CourseInstructor(course=cid, instructor=iid)
            session.add(ci)
    return ci


async def fetch_course_students(course_id: int) -> List[AuthUserValidator]:
    """
    Retrieve a list of students for the given course id (course_id)

    :param course_id: int, the id of the course
    :return: List[AuthUserValidator], a list of AuthUserValidator objects representing the students
    """
    query = (
        select(AuthUser)
        .join(UserCourse, UserCourse.user_id == AuthUser.id)
        .where(UserCourse.course_id == course_id)
    )
    async with async_session() as session:
        res = await session.execute(query)
    student_list = [AuthUserValidator.from_orm(x) for x in res.scalars().fetchall()]
    return student_list


async def fetch_course_enrollment_stats(
    course_id: int, course_name: str
) -> Dict[str, Any]:
    """
    Summarize enrollment and activity for a single course.

    Counting rather than fetching matters here: a caller that only wants the
    number of students should not pull every student row across the wire.

    :param course_id: int, the ``courses.id`` of the course
    :param course_name: str, the ``courses.course_name`` of the course
    :return: dict with ``enrolled``, ``active`` (auth_user.active is true),
        ``with_activity`` (distinct students with a useinfo row) and
        ``last_activity`` (most recent useinfo timestamp, or None)
    """
    # ``active`` is a Web2PyBoolean ('T'/'F'), so compare it to True rather than
    # using is_(), which would render SQL postgres will not accept for a CHAR(1).
    is_active = AuthUser.active == True  # noqa: E712
    enrollment_query = (
        select(
            func.count(UserCourse.user_id),
            func.count(UserCourse.user_id).filter(is_active),
        )
        .select_from(UserCourse)
        .join(AuthUser, AuthUser.id == UserCourse.user_id)
        .where(UserCourse.course_id == course_id)
    )
    # useinfo.course_id holds the course *name* -- see the note on the model.
    activity_query = select(
        func.count(func.distinct(Useinfo.sid)), func.max(Useinfo.timestamp)
    ).where(Useinfo.course_id == course_name)

    async with async_session() as session:
        enrolled, active = (await session.execute(enrollment_query)).one()
        with_activity, last_activity = (await session.execute(activity_query)).one()

    return dict(
        enrolled=enrolled,
        active=active,
        with_activity=with_activity,
        last_activity=last_activity,
    )


async def fetch_basecourse_courses(base_course: str) -> List[CoursesValidator]:
    """
    Retrieve a list of courses that share the same base course.

    :param base_course: str, the name of the base course
    :return: List[CoursesValidator], a list of CoursesValidator objects representing the courses
    """
    query = select(Courses).where(Courses.base_course == base_course)
    async with async_session() as session:
        res = await session.execute(query)
    course_list = [CoursesValidator.from_orm(x) for x in res.scalars().fetchall()]
    return course_list


async def fetch_courses_by_institution(institution: str) -> List[CoursesValidator]:
    """
    Return courses whose institution fuzzy-matches the given string and whose
    term_start_date is within the last 9 months (i.e. active or recently started).
    Uses Python difflib so no pg_trgm extension is required.

    :param institution: str, the institution name to match
    :return: List[CoursesValidator]
    """
    from difflib import SequenceMatcher

    cutoff = datetime.date.today() - datetime.timedelta(days=275)  # ~9 months
    query = select(Courses).where(
        and_(Courses.institution != "", Courses.term_start_date >= cutoff)
    )
    async with async_session() as session:
        res = await session.execute(query)
        all_courses = res.scalars().fetchall()

    needle = institution.lower()
    matches = []
    seen = set()
    for course in all_courses:
        ratio = SequenceMatcher(None, needle, course.institution.lower()).ratio()
        if ratio >= 0.6 and course.course_name not in seen:
            seen.add(course.course_name)
            matches.append((ratio, CoursesValidator.from_orm(course)))

    matches.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in matches[:20]]
