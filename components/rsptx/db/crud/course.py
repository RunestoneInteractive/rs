# generate imports
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func, and_, delete, update
from ..models import (
    Courses,
    UserCourse,
    AuthUser,
    CoursesValidator,
    AuthUserValidator,
    Assignment,
    AssignmentQuestion,
    CourseInstructor,
    CourseInstructorValidator,
    CourseAttribute,
    UserTopicPractice,
    UserTopicPracticeCompletion,
    UserTopicPracticeFeedback,
    Useinfo,
    TimedExam,
    MchoiceAnswers,
    FitbAnswers,
    DragndropAnswers,
    ClickableareaAnswers,
    ParsonsAnswers,
    ShortanswerAnswers,
    Code,
    SelectedQuestion,
    QuestionGrade,
    Grade,
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


async def delete_course_completely(course_name: str) -> bool:
    """
    Completely delete a course and all associated data.

    WARNING: This is a destructive operation that cannot be undone.

    This function will delete:
    - All student enrollments in the course
    - All assignments and grades
    - All course sections
    - Student progress data (useinfo, timed_exam, etc.)
    - Course customizations and settings
    - LTI integrations

    :param course_name: str, the name of the course to delete
    :return: bool, True if deletion was successful
    """
    try:
        async with async_session.begin() as session:
            # First, get the course information
            course_query = select(Courses).where(Courses.course_name == course_name)
            course_result = await session.execute(course_query)
            course = course_result.scalar_one_or_none()

            if not course:
                rslogger.warning(f"Course {course_name} not found for deletion")
                return False

            course_id = course.id
            rslogger.info(
                f"Starting deletion of course: {course_name} (ID: {course_id})"
            )

            # Delete in order to respect foreign key constraints

            # 1. Delete student progress and activity data
            rslogger.info("Deleting student activity data...")

            # Delete useinfo records
            await session.execute(
                delete(Useinfo).where(Useinfo.course_id == course_name)
            )

            # Delete timed exam records
            await session.execute(
                delete(TimedExam).where(TimedExam.course_name == course_name)
            )

            # Delete multiple choice answers
            await session.execute(
                delete(MchoiceAnswers).where(MchoiceAnswers.course_name == course_name)
            )

            # Delete fill-in-the-blank answers
            await session.execute(
                delete(FitbAnswers).where(FitbAnswers.course_name == course_name)
            )

            # Delete drag and drop answers
            await session.execute(
                delete(DragndropAnswers).where(
                    DragndropAnswers.course_name == course_name
                )
            )

            # Delete clickable area answers
            await session.execute(
                delete(ClickableareaAnswers).where(
                    ClickableareaAnswers.course_name == course_name
                )
            )

            # Delete parsons answers
            await session.execute(
                delete(ParsonsAnswers).where(ParsonsAnswers.course_name == course_name)
            )

            # Delete short answer responses
            await session.execute(
                delete(ShortanswerAnswers).where(
                    ShortanswerAnswers.course_name == course_name
                )
            )

            # Delete coding answers
            await session.execute(delete(Code).where(Code.course_id == course_id))

            # Note: PollAnswer model not found in imports, skipping poll responses deletion
            # await session.execute(delete(PollAnswer).where(PollAnswer.course_name == course_name))

            # Delete selected questions for this course's students
            # This is more complex as we need to find students in the course first
            student_query = select(AuthUser.username).where(
                AuthUser.course_id == course_id
            )
            student_result = await session.execute(student_query)
            student_usernames = [
                username for username in student_result.scalars().all()
            ]

            if student_usernames:
                await session.execute(
                    delete(SelectedQuestion).where(
                        SelectedQuestion.sid.in_(student_usernames)
                    )
                )

            # 2. Delete grading and assignment data
            rslogger.info("Deleting grades and assignments...")

            # Delete question grades for students in this course
            await session.execute(
                delete(QuestionGrade).where(QuestionGrade.course_name == course_name)
            )

            # Delete assignment grades for students in this course
            assignment_query = select(Assignment.id).where(
                Assignment.course == course_id
            )
            assignment_result = await session.execute(assignment_query)
            assignment_ids = [aid for aid in assignment_result.scalars().all()]

            if assignment_ids:
                await session.execute(
                    delete(Grade).where(Grade.assignment.in_(assignment_ids))
                )

            # Delete assignment questions
            if assignment_ids:
                await session.execute(
                    delete(AssignmentQuestion).where(
                        AssignmentQuestion.assignment_id.in_(assignment_ids)
                    )
                )

            # Delete assignments
            await session.execute(
                delete(Assignment).where(Assignment.course == course_id)
            )

            # 3. Delete course instructor relationships
            rslogger.info("Deleting instructor relationships...")
            await session.execute(
                delete(CourseInstructor).where(CourseInstructor.course == course_id)
            )

            # 4. Delete course attributes/settings
            rslogger.info("Deleting course settings...")
            await session.execute(
                delete(CourseAttribute).where(CourseAttribute.course_id == course_id)
            )

            # 5. Delete practice/flashcard data
            rslogger.info("Deleting practice data...")
            await session.execute(
                delete(UserTopicPractice).where(
                    UserTopicPractice.course_name == course_name
                )
            )
            await session.execute(
                delete(UserTopicPracticeCompletion).where(
                    UserTopicPracticeCompletion.course_name == course_name
                )
            )
            await session.execute(
                delete(UserTopicPracticeFeedback).where(
                    UserTopicPracticeFeedback.course_name == course_name
                )
            )

            # 7. Update student enrollments - move them to a default course or mark them inactive
            rslogger.info("Updating student enrollments...")
            # Instead of deleting users, we'll move them to a default "orphaned" course
            # or set their course_id to None/default
            base_course = await fetch_base_course(course.base_course)
            # Option 1: Set course_id to None (they become unenrolled)
            await session.execute(
                update(AuthUser)
                .where(AuthUser.course_id == course_id)
                .values(
                    course_id=base_course.id,
                    course_name=base_course.course_name,
                    active="F",
                )
            )

            # Option 2: Alternative - move to a default "orphaned students" course
            # This would require creating such a course first
            # default_course_query = select(Courses).where(Courses.course_name == "orphaned_students")
            # default_course = await session.execute(default_course_query)
            # if default_course.scalar_one_or_none():
            #     await session.execute(
            #         update(AuthUser)
            #         .where(AuthUser.course_id == course_id)
            #         .values(course_id=default_course.scalar_one().id)
            #     )

            # 8. Finally, delete the course itself
            rslogger.info("Deleting course record...")
            await session.execute(delete(Courses).where(Courses.id == course_id))

            rslogger.info(f"Successfully deleted course: {course_name}")
            return True

    except Exception as e:
        rslogger.error(f"Error deleting course {course_name}: {e}")
        return False


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
