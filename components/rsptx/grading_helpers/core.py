from rsptx.db.models import AuthUserValidator
from rsptx.db.crud import is_assigned, fetch_answers, create_question_grade_entry, fetch_question_grade, update_question_grade_entry, upsert_grade, fetch_assignment_scores
from rsptx.validation.schemas import LogItemIncoming, ScoringSpecification
from rsptx.db.models import GradeValidator

async def grade_submission(user: AuthUserValidator, submission: LogItemIncoming) -> None:
    """
    Grade a submission and store the results in the database.

    :param user: The user who submitted the answer.
    :type user: AuthUserValidator
    :param submission: The submission to grade.
    :type submission: LogItemIncoming
    """
    
    # First figure out if the answer is part of an assignment
    scoreSpec = await is_assigned(submission.div_id, user.course_id)
    if scoreSpec.assigned:
        if scoreSpec.which_to_grade == "first_answer":
            answers = await fetch_answers(submission.div_id,submission.event, user.course_name, user.username)
            if len(answers) > 0:
                return
            else:
                scoreSpec.score = score_one_answer(scoreSpec, submission=)
                await create_question_grade_entry(user.username, user.course_name, submission.div_id, scoreSpec.score)
        elif scoreSpec.which_to_grade == "last_answer":
            scoreSpec.score = score_one_answer(scoreSpec, submission)
            answer = await fetch_question_grade(user.username, user.course_name, submission.div_id)
            if answer:
                answer.score = scoreSpec.score
                await update_question_grade_entry(user.username, user.course_name, submission.div_id, scoreSpec.score)
            else:
                await create_question_grade_entry(user.username, user.course_name, submission.div_id, scoreSpec.score)
        elif scoreSpec.which_to_grade == "best_answer":
            scoreSpec.score = score_one_answer(scoreSpec, submission)
            current_score = await fetch_question_grade(user.username, user.course_name, submission.div_id)
            if current_score < scoreSpec.score:
                await update_question_grade_entry(user.username, user.course_name, submission.div_id, scoreSpec.score)

        # Now compute the total
        res = await fetch_assignment_scores(scoreSpec.assignment_id, user.course_name, user.username)
        total = 0
        for row in res:
            total += row.score

        # Now update the grade table with the new total

        newGrade = GradeValidator(
            auth_user=user.id,
            course_name=user.course_name,
            assignment=scoreSpec.assignment_id,
            score=total,
        )
        upsert_grade(newGrade)


def score_one_answer(scoreSpec: ScoringSpecification, submission: LogItemIncoming) -> Union[int, float]:
    """
    Score a single answer based on the scoring specification.

    :param scoreSpec: The scoring specification.
    :type scoreSpec: ScoringSpecification
    :return: The score for the answer.
    :rtype: Union[int, float]
    """
    if scoreSpec.how_to_score == "pct_correct":
        if scoreSpec.correct:
            return scoreSpec.max_score
        else:
            return LogItemIncoming.percentage * scoreSpec.max_score
    elif scoreSpec.how_to_score == "all_or_nothing":
        if scoreSpec.correct:
            return scoreSpec.max_score
        else:
            return 0
    elif scoreSpec.how_to_score == "interact":
        return scoreSpec.max_score
    else:
        return 0