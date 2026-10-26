"""The OpenAI API token a course's instructor added for its LLM features.

CodeTailor calls OpenAI with the course's own token, never a server-wide key.
"""

from rsptx.db.crud.crud import fetch_api_token

# for dev/test -- replace with your own key for local testing
DEV_API_KEY = ""
# The test course for development, which uses DEV_API_KEY
DEV_COURSE = "personalized_parsons"


def uses_dev_api_key(course_name):
    return course_name is None or course_name == DEV_COURSE


async def fetch_openai_token(course):
    """
    The course's least recently used OpenAI token (decrypted), or None if
    its instructor hasn't added one.
    """
    token_record = await fetch_api_token(
        course_id=course.id,
        provider="openai",  # from add_token.html <option value="openai">
        # hardcoded as openai for now, prompt structures are different for different providers
        # if we find instructors tend to use other platforms, we need to handle this later
    )
    return token_record.token if token_record else None
