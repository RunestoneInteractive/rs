from rsptx.db.crud import (
    fetch_one_user_topic_practice,
    create_user_topic_practice,
    fetch_qualified_questions,
    delete_one_user_topic_practice,
)

from rsptx.db.models import AuthUserValidator
from rsptx.logging import rslogger
from datetime import datetime, timedelta


async def potentially_change_flashcard(
    base_course_name: str,
    chapter,
    subcchapter,
    user: AuthUserValidator,
    tz_offset: float,
    add=False,
    remove=False,
) -> None:
    # check if already have a card for this subchapter
    existing_flashcard = await fetch_one_user_topic_practice(user, chapter, subcchapter)

    if add:
        if not existing_flashcard:
            # See if this subchapter has any questions marked for use in the practice tool.
            questions = await fetch_qualified_questions(
                base_course_name, chapter, subcchapter
            )
            if (
                len(questions) > 0
            ):  # There is at least one qualified question in this subchapter
                rslogger.debug(
                    f"Adding flashcard for {chapter=}, {subcchapter=}, {questions[0].name=}"
                )
                now = datetime.utcnow()
                now_local = now - timedelta(hours=tz_offset)
                await create_user_topic_practice(
                    user,
                    chapter,
                    subcchapter,
                    questions[0].name,
                    now_local,
                    now,
                    tz_offset,
                )
            else:
                rslogger.debug("no questions found for this subchapter")
        else:
            rslogger.debug("already have a flashcard for this subchapter")
    elif remove:
        if existing_flashcard:
            rslogger.debug(
                f"Removing flashcard for {chapter=}, {subcchapter=}, {existing_flashcard.question_name=}"
            )
            await delete_one_user_topic_practice(existing_flashcard.id)
        else:
            rslogger.debug("no flashcard found to delete for this subchapter")
