from .crud import (
    check_domain_approval,
    create_api_token,
    create_domain_approval,
    create_initial_courses_users,
    create_invoice_request,
    create_traceback,
    fetch_api_token,
    is_server_feedback,
    EVENT2TABLE,
)
from .user import fetch_user, create_user, update_user, delete_user

from .assignment import (
    create_assignment,
    create_assignment_question,
    create_deadline_exception,
    delete_deadline_exception,
    duplicate_assignment,
    fetch_all_assignment_stats,
    fetch_all_deadline_exceptions,
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
    create_course_instructor,
    create_instructor_course_entry,
    create_user_course_entry,
    delete_course_completely,
    delete_course_instructor,
    delete_user_course_entry,
    fetch_available_students_for_instructor_add,
    fetch_base_course,
    fetch_basecourse_courses,
    fetch_course,
    fetch_course_by_id,
    fetch_course_instructors,
    fetch_course_students,
    fetch_courses_for_user,
    fetch_current_instructors_for_course,
    fetch_instructor_courses,
    fetch_users_for_course,
    update_course_settings,
    user_in_course,
)

from .course_attrs import (
    copy_course_attributes,
    create_course_attribute,
    fetch_all_course_attributes,
    fetch_one_course_attribute,
    get_course_origin,
)

from .book import (
    create_user_chapter_progress_entry,
    create_user_state_entry,
    create_user_sub_chapter_progress_entry,
    fetch_chapter_for_subchapter,
    fetch_last_page,
    fetch_page_activity_counts,
    fetch_subchapters,
    fetch_user_chapter_progress,
    fetch_user_sub_chapter_progress,
    get_book_chapters,
    get_book_subchapters,
    update_sub_chapter_progress,
    update_user_state,
)

from .group import (
    create_group,
    create_editor_for_basecourse,
    create_membership,
    fetch_group,
    fetch_membership,
    is_author,
    is_editor,
)

# from library
from .library import (
    create_book_author,
    create_library_book,
    fetch_books_by_author,
    fetch_library_book,
    fetch_library_books,
    get_courses_per_basecourse,
    get_students_per_basecourse,
    update_library_book,
)

# import all functions from .lti by name
from .lti import (
    create_lti_course,
    delete_lti_course,
    delete_lti1p3_course,
    fetch_lti_version,
    fetch_lti1p3_assignments_by_rs_assignment_id,
    fetch_lti1p3_assignments_by_rs_course_id,
    fetch_lti1p3_config_by_lti_data,
    fetch_lti1p3_config,
    fetch_lti1p3_course_by_id,
    fetch_lti1p3_course_by_lti_data,
    fetch_lti1p3_courses_by_lti_course_id,
    fetch_lti1p3_course_by_rs_course,
    fetch_lti1p3_course,
    fetch_lti1p3_grading_data_for_assignment,
    fetch_lti1p3_user,
    fetch_lti1p3_users_for_course,
    upsert_lti1p3_assignment,
    upsert_lti1p3_config,
    upsert_lti1p3_course,
    upsert_lti1p3_user,
    validate_user_credentials,
)

from .peer import (
    fetch_last_useinfo_peergroup,
    get_peer_votes,
    did_send_messages,
    fetch_recent_student_answers,
    fetch_student_answers_in_timerange,
    count_distinct_student_answers,
    count_peer_messages,
)

from .practice import (
    create_user_topic_practice,
    delete_one_user_topic_practice,
    fetch_course_practice,
    fetch_one_user_topic_practice,
    fetch_qualified_questions,
)

from .question import (
    count_matching_questions,
    create_question_grade_entry,
    create_question,
    create_user_experiment_entry,
    fetch_assignment_question,
    fetch_assignment_questions,
    fetch_matching_questions,
    fetch_previous_selections,
    fetch_question,
    fetch_questions_for_chapter_subchapter,
    fetch_question_count_per_subchapter,
    fetch_question_grade,
    fetch_questions_by_search_criteria,
    fetch_user_experiment,
    fetch_viewed_questions,
    search_exercises,
    update_question,
    update_question_grade_entry,
)

from .rsfiles import fetch_source_code, update_source_code, update_source_code_sync, fetch_all_datafiles, check_datafile_exists, generate_datafile_acid, fetch_datafile_by_acid, update_datafile, delete_datafile

from .rslogging import (
    count_useinfo_for,
    create_answer_table_entry,
    create_code_entry,
    create_useinfo_entry,
    fetch_code,
    fetch_last_answer_table_entry,
    fetch_last_poll_response,
    fetch_poll_summary,
    fetch_top10_fitb,
)

from .scoring import (
    fetch_answers,
    fetch_assignment_scores,
    fetch_reading_assignment_spec,
    is_assigned,
)

from .selectq import (
    create_selected_question,
    fetch_selected_question,
    update_selected_question,
)

from .timed import (
    create_timed_exam_entry,
    did_start_timed,
    fetch_timed_assessments,
    fetch_timed_exam,
    reset_student_assessment,
)

#
# Define __all__ for the package
#

__all__ = []

# from .assignment
__all__ += [
    "create_assignment",
    "create_assignment_question",
    "create_deadline_exception",
    "delete_deadline_exception",
    "duplicate_assignment",
    "fetch_all_assignment_stats",
    "fetch_all_grades_for_assignment",
    "fetch_assignments",
    "fetch_all_deadline_exceptions",
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

# from .crud
__all__ += [
    "check_domain_approval",
    "create_api_token",
    "create_domain_approval",
    "create_initial_courses_users",
    "create_invoice_request",
    "create_traceback",
    "fetch_api_token",
    "is_server_feedback",
    "EVENT2TABLE",
]

# from .library
__all__ += [
    "create_book_author",
    "create_library_book",
    "fetch_books_by_author",
    "fetch_library_book",
    "fetch_library_books",
    "get_courses_per_basecourse",
    "get_students_per_basecourse",
    "update_library_book",
]

# from .lti

__all__ += [
    "create_lti_course",
    "delete_lti_course",
    "delete_lti1p3_course",
    "fetch_lti_version",
    "fetch_lti1p3_assignments_by_rs_assignment_id",
    "fetch_lti1p3_assignments_by_rs_course_id",
    "fetch_lti1p3_config_by_lti_data",
    "fetch_lti1p3_config",
    "fetch_lti1p3_course_by_id",
    "fetch_lti1p3_course_by_lti_data",
    "fetch_lti1p3_courses_by_lti_course_id",
    "fetch_lti1p3_course_by_rs_course",
    "fetch_lti1p3_course",
    "fetch_lti1p3_grading_data_for_assignment",
    "fetch_lti1p3_user",
    "fetch_lti1p3_users_for_course",
    "upsert_lti1p3_assignment",
    "upsert_lti1p3_config",
    "upsert_lti1p3_course",
    "upsert_lti1p3_user",
    "validate_user_credentials",
]

# from .book
__all__ += [
    "create_user_chapter_progress_entry",
    "create_user_state_entry",
    "create_user_sub_chapter_progress_entry",
    "fetch_chapter_for_subchapter",
    "fetch_last_page",
    "fetch_page_activity_counts",
    "fetch_subchapters",
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
    "create_course_instructor",
    "create_instructor_course_entry",
    "create_user_course_entry",
    "delete_course_completely",
    "delete_course_instructor",
    "delete_user_course_entry",
    "fetch_available_students_for_instructor_add",
    "fetch_base_course",
    "fetch_basecourse_courses",
    "fetch_course",
    "fetch_course_by_id",
    "fetch_course_instructors",
    "fetch_course_students",
    "fetch_courses_for_user",
    "fetch_current_instructors_for_course",
    "fetch_instructor_courses",
    "fetch_users_for_course",
    "update_course_settings",
    "user_in_course",
]

# from .course_attrs
__all__ += [
    "copy_course_attributes",
    "create_course_attribute",
    "fetch_all_course_attributes",
    "fetch_one_course_attribute",
    "get_course_origin",
]

# from .group
__all__ += [
    "create_group",
    "create_editor_for_basecourse",
    "create_membership",
    "fetch_group",
    "fetch_membership",
    "is_author",
    "is_editor",
]
# from .peer
__all__ += [
    "fetch_last_useinfo_peergroup",
    "get_peer_votes",
    "did_send_messages",
    "fetch_recent_student_answers",
    "fetch_student_answers_in_timerange",
    "count_distinct_student_answers",
    "count_peer_messages",
]

# from .practice
__all__ += [
    "create_user_topic_practice",
    "delete_one_user_topic_practice",
    "fetch_course_practice",
    "fetch_one_user_topic_practice",
    "fetch_qualified_questions",
]

# from .question
__all__ += [
    "count_matching_questions",
    "create_question",
    "create_question_grade_entry",
    "create_user_experiment_entry",
    "fetch_assignment_question",
    "fetch_assignment_questions",
    "fetch_matching_questions",
    "fetch_previous_selections",
    "fetch_question",
    "fetch_questions_for_chapter_subchapter",
    "fetch_question_count_per_subchapter",
    "fetch_question_grade",
    "fetch_questions_by_search_criteria",
    "fetch_user_experiment",
    "fetch_viewed_questions",
    "search_exercises",
    "update_question",
    "update_question_grade_entry",
]

# from .rsfiles
__all__ += [
    "fetch_source_code",
    "update_source_code",
    "update_source_code_sync",
    "fetch_all_datafiles",
    "check_datafile_exists",
    "generate_datafile_acid",
    "fetch_datafile_by_acid",
    "update_datafile",
    "delete_datafile",
]

# from .rslogging
__all__ += [
    "count_useinfo_for",
    "create_answer_table_entry",
    "create_code_entry",
    "create_useinfo_entry",
    "fetch_code",
    "fetch_last_answer_table_entry",
    "fetch_last_poll_response",
    "fetch_poll_summary",
    "fetch_top10_fitb",
]

# from .scoring
__all__ += [
    "fetch_answers",
    "fetch_assignment_scores",
    "fetch_reading_assignment_spec",
    "is_assigned",
]

# from .selectq
__all__ += [
    "create_selected_question",
    "fetch_selected_question",
    "update_selected_question",
]

# from .timed
__all__ += [
    "create_timed_exam_entry",
    "did_start_timed",
    "fetch_timed_assessments",
    "fetch_timed_exam",
    "reset_student_assessment",
]
# from .user
__all__ += [
    "fetch_user",
    "create_user",
    "update_user",
    "delete_user",
]
