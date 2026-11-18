# *****************************************************
# |docname| - server-supplied eBookConfig values
# *****************************************************
# A PreTeXt book's ``_base.html`` sets up ``eBookConfig`` from template
# variables, then emits ``{{ ebook_config_override | safe }}``.  ``bookfuncs.js``
# merges that object into ``eBookConfig`` before anything reads it, so the
# server, not the book's template, decides the values only a Runestone server
# can know: the green items in issue #1392.
#
# enableScratchAC and acDefaultLanguage are also green there, but they are
# publisher options with no server-side source, so the book keeps them.
from typing import Any, Optional

from jinja2.utils import htmlsafe_json_dumps

from rsptx.db.crud import is_author, is_editor


async def ebook_config_override(
    *,
    course: Any,
    user: Optional[Any],
    user_is_instructor: bool,
    course_attrs: dict,
    readings: Optional[list],
    activities: dict,
    use_services: bool = True,
) -> str:
    """Return the ``ebook_config_override`` script statement for a page.

    :param course: the course row being viewed
    :param user: the logged-in user, or None
    :param user_is_instructor: whether ``user`` instructs ``course``
    :param course_attrs: the course's attributes
    :param readings: the page's reading list; None (JSON ``null``) keeps
        bookfuncs from drawing the assignment reading tracker
    :param activities: the activity counts for the progress bar
    :param use_services: False for a book page viewed in browsing mode
    """
    # The Author and Editor Dashboard links only appear in the instructor menu,
    # so only instructors pay for the group lookups.
    if user and user_is_instructor:
        user_is_author = await is_author(user.id)
        user_is_editor = await is_editor(user.id)
    else:
        user_is_author = user_is_editor = False

    ebook_attrs = dict(
        useRunestoneServices=use_services,
        course=course.course_name,
        termStartDate=course.term_start_date.isoformat(),
        basecourse=course.base_course,
        isLoggedIn=user is not None,
        email=user.email if user else "",
        isInstructor=user_is_instructor,
        logLevel=10,
        username=user.username if user else "",
        readings=readings,
        activities=activities,
        downloadsEnabled=bool(course.downloads_enabled),
        allow_pairs=bool(course.allow_pairs),
        course_attrs=course_attrs,
        isEditor=user_is_editor,
        isAuthor=user_is_author,
    )
    # htmlsafe_json_dumps escapes <, >, & and ' so a course attribute can't
    # close the <script> tag this lands in.
    return "ebook_config_override = " + str(htmlsafe_json_dumps(ebook_attrs))
