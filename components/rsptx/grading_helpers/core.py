from rsptx.db.models import AuthUserValidator
from rsptx.db.crud import is_assigned, fetch_answers
from rsptx.validation.schemas import LogItemIncoming

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
        