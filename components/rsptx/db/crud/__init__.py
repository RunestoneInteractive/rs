from .crud import *  # noqa
from .user import fetch_user, create_user, update_user, delete_user

from .assignment import (
    create_assignment,
    create_assignment_question,
    create_deadline_exception,
    fetch_all_assignment_stats,
    fetch_all_grades_for_assignment,
    fetch_assignments,
    fetch_deadline_exception,
    fetch_grade,
    fetch_one_assignment,
    fetch_problem_data,
    fetch_reading_assignment_data,
    get_repo_path,
    remove_assignment_questions,
    reorder_assignment_questions,
    update_assignment,
    update_assignment_exercises,
    update_assignment_question,
    update_multiple_assignment_questions,
    upsert_grade,
)

from .course import (
    create_course,
    create_user_course_entry,
    delete_course_completely,
    delete_user_course_entry,
    fetch_base_course,
    fetch_course_by_id,
    fetch_course,
    fetch_courses_for_user,
    fetch_users_for_course,
    user_in_course,
)

from .book import (
    create_user_chapter_progress_entry,
    create_user_state_entry,
    create_user_sub_chapter_progress_entry,
    fetch_chapter_for_subchapter,
    fetch_last_page,
    fetch_page_activity_counts,
    fetch_user_chapter_progress,
    fetch_user_sub_chapter_progress,
    get_book_chapters,
    get_book_subchapters,
    update_sub_chapter_progress,
    update_user_state,
)

from .group import (
    create_group,
    create_membership,
    fetch_group,
    fetch_membership,
    is_author,
    is_editor,
)


# import all functions from .lti by name
from .lti import (
    delete_lti1p3_course,
    fetch_lti1p3_assignments_by_rs_assignment_id,
    fetch_lti1p3_assignments_by_rs_course_id,
    fetch_lti1p3_config_by_lti_data,
    fetch_lti1p3_config,
    fetch_lti1p3_course_by_id,
    fetch_lti1p3_course_by_lti_data,
    fetch_lti1p3_course_by_lti_id,
    fetch_lti1p3_course_by_rs_course,
    fetch_lti1p3_course,
    fetch_lti1p3_grading_data_for_assignment,
    fetch_lti1p3_user,
    fetch_lti1p3_users_for_course,
    upsert_lti1p3_assignment,
    upsert_lti1p3_config,
    upsert_lti1p3_course,
    upsert_lti1p3_user,
)

# from .user
__all__ = [
    "fetch_user",
    "create_user",
    "update_user",
    "delete_user",
]


# from .assignment
__all__ += [
    "create_assignment",
    "create_assignment_question",
    "create_deadline_exception",
    "fetch_all_assignment_stats",
    "fetch_all_grades_for_assignment",
    "fetch_assignments",
    "fetch_deadline_exception",
    "fetch_grade",
    "fetch_one_assignment",
    "fetch_problem_data",
    "fetch_reading_assignment_data",
    "get_repo_path",
    "remove_assignment_questions",
    "reorder_assignment_questions",
    "update_assignment",
    "update_assignment_exercises",
    "update_assignment_question",
    "update_multiple_assignment_questions",
    "upsert_grade",
]

# from .lti

__all__ += [
    "delete_lti1p3_course",
    "fetch_lti1p3_assignments_by_rs_assignment_id",
    "fetch_lti1p3_assignments_by_rs_course_id",
    "fetch_lti1p3_config_by_lti_data",
    "fetch_lti1p3_config",
    "fetch_lti1p3_course_by_id",
    "fetch_lti1p3_course_by_lti_data",
    "fetch_lti1p3_course_by_lti_id",
    "fetch_lti1p3_course_by_rs_course",
    "fetch_lti1p3_course",
    "fetch_lti1p3_users_for_course",
    "fetch_lti1p3_grading_data_for_assignment",
    "fetch_lti1p3_user",
    "upsert_lti1p3_assignment",
    "upsert_lti1p3_config",
    "upsert_lti1p3_course",
    "upsert_lti1p3_user",
]

# from .book
__all__ += [
    "create_user_chapter_progress_entry",
    "create_user_state_entry",
    "create_user_sub_chapter_progress_entry",
    "fetch_chapter_for_subchapter",
    "fetch_last_page",
    "fetch_page_activity_counts",
    "fetch_user_chapter_progress",
    "fetch_user_sub_chapter_progress",
    "get_book_chapters",
    "get_book_subchapters",
    "update_sub_chapter_progress",
    "update_user_state",
]

# from .course
__all__ += [
    "create_course",
    "create_user_course_entry",
    "delete_course_completely",
    "delete_user_course_entry",
    "fetch_base_course",
    "fetch_course_by_id",
    "fetch_course",
    "fetch_courses_for_user",
    "fetch_users_for_course",
    "user_in_course",
]

# from .group
__all__ += [
    "create_group",
    "create_membership",
    "fetch_group",
    "fetch_membership",
    "is_author",
    "is_editor",
]
