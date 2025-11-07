from typing import Union, List
from datetime import timedelta
from rsptx.db.models import AuthUserValidator, DeadlineExceptionValidator
from rsptx.db.crud import (
    is_assigned,
    fetch_answers,
    create_question_grade_entry,
    fetch_course,
    fetch_grade,
    fetch_question_grade,
    update_question_grade_entry,
    upsert_grade,
    fetch_assignment_scores,
    fetch_deadline_exception,
    did_send_messages,
)
from rsptx.validation.schemas import (
    LogItemIncoming,
    ScoringSpecification,
    ReadingAssignmentSpec,
)
from rsptx.db.models import (
    GradeValidator,
    AssignmentValidator,
    DeadlineExceptionValidator,
)
from rsptx.logging import rslogger
from rsptx.lti1p3.core import attempt_lti1p3_score_update


async def grade_submission(
    user: AuthUserValidator, submission: LogItemIncoming, timezone: str = "UTC"
) -> ScoringSpecification:
    """
    Grade a submission and store the results in the database.

    :param user: The user who submitted the answer.
    :type user: AuthUserValidator
    :param submission: The submission to grade.
    :type submission: LogItemIncoming
    """
    # First figure out if the answer is part of an assignment
    update_total = False
    accommodation = await fetch_deadline_exception(
        user.course_id, user.username, submission.assignment_id
    )
    # if there is a selector_id this is a selectquestion and we want to use the
    # selector_id to record the grade and to see if this question has been assigned.  
    # Of course we want to grade the real question
    # which is the div_id that is part of the submission.
    if submission.selector_id:
        rslogger.debug(
            f"Grading submission with selector_id {submission.selector_id}"
        )
        div_id = submission.selector_id
    else:
        div_id = submission.div_id
    scoreSpec = await is_assigned(
        div_id,
        user.course_id,
        submission.assignment_id,
        accommodation=accommodation,
        timezone=timezone,
    )
    # Skip scoring for interaction events these are just logs that the student
    # did something with a selectquestion.  This is required to get accurate grades
    # in reading assignments that have selectquestions (likely toggles).
    if submission.event == "selectquestion" and submission.act == "interaction":
        return scoreSpec

    # from here on carefully use div_id which may be the selector_id for saving the score
    # but use submission.div_id for scoring the actual question.
    if scoreSpec.assigned:
        rslogger.debug(
            f"Scoring {submission.div_id} for {user.username} scoreSpec = {scoreSpec}"
        )
        if scoreSpec.which_to_grade == "first_answer":
            answers = await fetch_answers(
                submission.div_id, submission.event, user.course_name, user.username
            )
            if len(answers) > 0:
                return scoreSpec
            else:
                scoreSpec.score = await score_one_answer(scoreSpec, submission)
                await create_question_grade_entry(
                    user.username, user.course_name, div_id, scoreSpec.score
                )
                update_total = True
        elif scoreSpec.which_to_grade == "last_answer":
            scoreSpec.score = await score_one_answer(scoreSpec, submission)
            answer = await fetch_question_grade(
                user.username, user.course_name, div_id
            )
            if answer:
                answer.score = scoreSpec.score
                await update_question_grade_entry(
                    user.username,
                    user.course_name,
                    div_id,
                    scoreSpec.score,
                    answer.id,
                )
            else:
                await create_question_grade_entry(
                    user.username, user.course_name, submission.div_id, scoreSpec.score
                )
            update_total = True
        elif scoreSpec.which_to_grade == "best_answer":
            scoreSpec.score = await score_one_answer(scoreSpec, submission)
            if scoreSpec.score is None:
                scoreSpec.score = 0
                rslogger.error(
                    f"score_one_answer returned None scoreSpec = {scoreSpec}"
                )
            rslogger.debug(
                f"Scoring best answer with current score of {scoreSpec.score}"
            )
            current_score = await fetch_question_grade(
                user.username, user.course_name, div_id
            )
            # Update the score unless the instructor has left a comment.
            # Instructors should have the last word?
            if current_score:
                if current_score.score is None:
                    current_score.score = 0
                    # maybe if there is no score we should update it regardless of the comment?
                if (
                    current_score.score < scoreSpec.score
                ) and current_score.comment == "autograded":
                    await update_question_grade_entry(
                        user.username,
                        user.course_name,
                        div_id,
                        scoreSpec.score,
                        current_score.id,
                    )
                    update_total = True
                else:
                    scoreSpec.score = current_score.score
            else:
                await create_question_grade_entry(
                    user.username,
                    user.course_name,
                    div_id,
                    scoreSpec.score,
                )
                update_total = True
        elif scoreSpec.which_to_grade == "all_answer":
            # This is a peer instruction question.
            # check to make sure that this is vote2 before we do anything.
            # PI questions are scored similar to interact.
            rslogger.debug(f"all_answer -- submission.act = {submission.act}")
            if "vote2" in submission.act:
                scoreSpec.username = user.username
                scoreSpec.score = await score_one_answer(scoreSpec, submission)
                rslogger.debug(f"scoreSpec.score = {scoreSpec.score}")
                answer = await fetch_question_grade(
                    user.username, user.course_name, submission.div_id
                )
                if answer:
                    answer.score = scoreSpec.score
                    await update_question_grade_entry(
                        user.username,
                        user.course_name,
                        submission.div_id,
                        scoreSpec.score,
                        answer.id,
                    )
                else:
                    await create_question_grade_entry(
                        user.username,
                        user.course_name,
                        submission.div_id,
                        scoreSpec.score,
                    )
                update_total = True
        if update_total:
            rslogger.debug("Updating total score")
            # Now compute the total
            total = await compute_total_score(scoreSpec, user)

    return scoreSpec


async def score_one_answer(
    scoreSpec: ScoringSpecification, submission: LogItemIncoming
) -> Union[int, float]:
    """
    Score a single answer based on the scoring specification.

    :param scoreSpec: The scoring specification.
    :type scoreSpec: ScoringSpecification
    :return: The score for the answer.
    :rtype: Union[int, float]
    """
    rslogger.debug(
        f"scoreSpec.how_to_score = {scoreSpec.how_to_score} {scoreSpec.max_score}"
    )
    if scoreSpec.how_to_score == "pct_correct":
        if submission.correct:
            return scoreSpec.max_score
        else:
            if submission.percent:
                # for some reason, lost to the sands of time, the percent is an int for unittests
                if submission.event == "unittest":
                    return (submission.percent / 100.0) * scoreSpec.max_score
                else:
                    return submission.percent * scoreSpec.max_score
            return 0
    elif scoreSpec.how_to_score == "all_or_nothing":
        if submission.correct:
            return scoreSpec.max_score
        else:
            return 0
    elif (
        scoreSpec.how_to_score == "interact" or scoreSpec.how_to_score == "interaction"
    ):
        return scoreSpec.max_score
    elif scoreSpec.how_to_score == "peer":
        return scoreSpec.max_score
    elif scoreSpec.how_to_score == "peer_chat":
        did_chat = await did_send_messages(
            scoreSpec.username, submission.div_id, submission.course_name
        )
        if did_chat:
            return scoreSpec.max_score
        else:
            return 0.5 * scoreSpec.max_score
    else:
        rslogger.debug(f"Unknown how_to_score {scoreSpec.how_to_score}")
        return 0


async def compute_total_score(
    scoreSpec: ScoringSpecification, user: AuthUserValidator
) -> int:
    """
    Compute the total score for an assignment.

    :param scoreSpec: The scoring specification.
    :type scoreSpec: ScoringSpecification
    :param user: The user to compute the score for.
    :type user: AuthUserValidator
    :rtype: int
    """

    res = await fetch_assignment_scores(
        scoreSpec.assignment_id, user.course_name, user.username
    )
    total = 0
    for row in res:
        if row.score is None:
            row.score = 0
        total += row.score

    rslogger.debug(f"total = {total} for assignment {scoreSpec.assignment_id}")
    # Now update the grade table with the new total

    grade = await fetch_grade(user.id, scoreSpec.assignment_id)
    if grade:
        grade.score = total
        newGrade = grade
    else:
        newGrade = GradeValidator(
            auth_user=user.id,
            course_name=user.course_name,
            assignment=scoreSpec.assignment_id,
            score=total,
            manual_total=False,
        )
    rslogger.debug(f"newGrade = {newGrade}")
    res = await upsert_grade(newGrade)
    # And send the grade off to any LTI1.3 tools that are listening
    await attempt_lti1p3_score_update(user.id, scoreSpec.assignment_id, total)
    return total


async def score_reading_page(
    reading_spec: ReadingAssignmentSpec, user: AuthUserValidator
):
    """
    Score a reading page based on the reading specification.

    :param reading_spec: The reading specification.
    :type reading_spec: ReadingAssignmentSpec
    :return: The score for the reading page.
    :rtype: Union[int, float]
    """
    # use the points from the reading_spec to update the question_grade row
    # for this reading page.
    score = reading_spec.points
    # get the question_id for this reading page
    question_grade = await fetch_question_grade(
        user.username, user.course_name, reading_spec.name
    )
    if question_grade:
        question_grade.score = score
        await update_question_grade_entry(
            user.username, user.course_name, reading_spec.name, score, question_grade.id
        )
    else:
        await create_question_grade_entry(
            user.username, user.course_name, reading_spec.name, score
        )

    scoreSpec = ScoringSpecification(
        assigned=True, assignment_id=reading_spec.assignment_id
    )
    await compute_total_score(scoreSpec, user)


async def check_for_exceptions(
    user: AuthUserValidator, assignment: int
) -> DeadlineExceptionValidator:
    """
    Check for exceptions that may have been granted for an assignment.

    :param user: The user to check for exceptions.
    :type user: AuthUserValidator
    :param assignment: The assignment to check for exceptions.
    :type assignment: int
    :return: True if an exception was granted, False otherwise.
    :rtype: bool
    """
    # Check to see if the user has been granted an exception for this assignment
    exception = await fetch_deadline_exception(
        user.course_id, user.username, assignment
    )
    rslogger.debug(f"deadline exception = {exception}")
    return exception


def adjust_deadlines(
    assignment_list: List[AssignmentValidator],
    accommodations: List[DeadlineExceptionValidator],
) -> List[AssignmentValidator]:
    """
    Adjust the deadlines for assignments based on accommodations.
    """
    for assignment in assignment_list:
        for exception in accommodations:
            if assignment.id == exception.assignment_id:
                if exception.duedate:
                    assignment.duedate += timedelta(days=exception.duedate)
                break
    return assignment_list
