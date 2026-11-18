"""
Keys in ``user_interactions`` that are not plain question div_ids.

A page view is logged in ``useinfo`` under its URL path, which can only be
matched on its ending.  The tracker files it under a key built from the
chapter and subchapter labels instead -- labels that both the logger and a
reading's question row have.  This lives here, with no database imports, so the
dash server can build the same keys as ``rsptx.db.crud.interactions``.
"""

#: The prefix that marks a tracker row as a page view.  No question div_id
#: starts with it.
PAGE_KEY_PREFIX = "page:"


def page_interaction_key(chapter: str, subchapter: str) -> str:
    """The ``user_interactions.div_id`` a view of this page is stored under.

    :param chapter: the chapter label (``questions.chapter`` /
        ``chapters.chapter_label``).
    :param subchapter: the subchapter label (``questions.subchapter`` /
        ``sub_chapters.sub_chapter_label``).
    """
    return f"{PAGE_KEY_PREFIX}{chapter}/{subchapter}"
