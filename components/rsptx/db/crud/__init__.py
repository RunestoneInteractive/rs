from .crud import *  # noqa
from .user import fetch_user, create_user, update_user, delete_user
from .course import (
    create_course,
    create_user_course_entry,
    delete_user_course_entry,
    delete_course_completely,
    fetch_base_course,
    fetch_course_by_id,
    fetch_course,
    fetch_courses_for_user,
    fetch_users_for_course,
    user_in_course,
)

from .book import (
    get_book_chapters,
    fetch_chapter_for_subchapter,
    get_book_subchapters,
    fetch_page_activity_counts,
    create_user_state_entry,
    update_user_state,
    update_sub_chapter_progress,
    fetch_last_page,
    fetch_user_sub_chapter_progress,
    create_user_sub_chapter_progress_entry,
    fetch_user_chapter_progress,
    create_user_chapter_progress_entry,
)

from .group import fetch_group, create_group, fetch_membership, create_membership

# from .user
__all__ = [
    "fetch_user",
    "create_user",
    "update_user",
    "delete_user",
]

# import all functions from .lti by name
from .lti import (
    upsert_lti1p3_config,
    fetch_lti1p3_config,
    fetch_lti1p3_config_by_lti_data,
    upsert_lti1p3_course,
    delete_lti1p3_course,
    fetch_lti1p3_course,
    fetch_lti1p3_course_by_rs_course,
    fetch_lti1p3_course_by_id,
    fetch_lti1p3_course_by_lti_id,
    fetch_lti1p3_course_by_lti_data,
    upsert_lti1p3_user,
)

__all__ += [
    "upsert_lti1p3_config",
    "fetch_lti1p3_config",
    "fetch_lti1p3_config_by_lti_data",
    "upsert_lti1p3_course",
    "delete_lti1p3_course",
    "fetch_lti1p3_course",
    "fetch_lti1p3_course_by_rs_course",
    "fetch_lti1p3_course_by_id",
    "fetch_lti1p3_course_by_lti_id",
    "fetch_lti1p3_course_by_lti_data",
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
    "fetch_group",
    "create_group",
    "fetch_membership",
    "create_membership",
]
