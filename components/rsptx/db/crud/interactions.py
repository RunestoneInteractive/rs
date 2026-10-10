"""
``user_interactions``: one row per (course, item, student) recording that the
student touched the item, when they first and last did, and how often.

It is a summary of ``useinfo``, written alongside every logged event by
:func:`rsptx.db.crud.rslogging.create_useinfo_entry`, so that "has this student
touched this item" never needs to scan the log.  See
notes/interaction_tracker_design.md for the design and what each reader
migrates from.

Page views are the exception to "keyed by ``useinfo.div_id``": the log records a
page by its URL path, which can only be matched on its ending.  The tracker
stores them under :func:`page_interaction_key` instead, built from the chapter
and subchapter labels that both the logger and a reading's question row have.
"""

import datetime
from typing import Dict, Iterable, Optional, Set

from sqlalchemy import and_, func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from rsptx.data_types.answer_storage import INTERACTION_ACTS
from rsptx.data_types.interactions import (  # noqa: F401  (re-exported)
    PAGE_KEY_PREFIX,
    page_interaction_key,
)
from rsptx.logging import rslogger
from ..async_session import async_session
from ..models import Courses, UserInteraction
from .crud import INTERACTION_ONLY_EVENTS, is_interaction_event


def interaction_key_for(
    event: str, act: Optional[str], sid: Optional[str], div_id: Optional[str]
) -> Optional[str]:
    """The tracker key for a logged event, or ``None`` when it isn't recorded.

    Not recorded: anonymous readers, rows with no item, page views (their
    caller supplies a :func:`page_interaction_key` instead), and
    interaction-only events whose act is not real activity -- a video logs
    ``ready`` whenever its player is built.
    """
    if not sid or sid == "Anonymous" or not div_id:
        return None
    if event == "page":
        return None
    if event in INTERACTION_ONLY_EVENTS and not is_interaction_event(event, act):
        return None
    return div_id


async def upsert_interaction(
    session: AsyncSession,
    course_name: str,
    div_id: str,
    sid: str,
    when: datetime.datetime,
) -> None:
    """Record one interaction in ``session``'s transaction.

    Runs in a SAVEPOINT so that a failure here cannot roll back the caller's
    log entry: losing a tracker update is fine, losing the log is not.  Errors
    are logged and swallowed.
    """
    stmt = pg_insert(UserInteraction).values(
        course_name=course_name,
        div_id=div_id,
        sid=sid,
        first_interaction=when,
        last_interaction=when,
        interactions=1,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[
            UserInteraction.course_name,
            UserInteraction.div_id,
            UserInteraction.sid,
        ],
        set_={
            "first_interaction": func.least(
                UserInteraction.first_interaction, stmt.excluded.first_interaction
            ),
            "last_interaction": func.greatest(
                UserInteraction.last_interaction, stmt.excluded.last_interaction
            ),
            "interactions": UserInteraction.interactions + 1,
        },
    )
    try:
        async with session.begin_nested():
            await session.execute(stmt)
    except Exception as e:
        rslogger.error(
            f"Failed to record interaction {sid} {course_name} {div_id}: {e}"
        )


def _since_term_start():
    """Join and clause keeping only rows with activity since the course's term
    started, as the useinfo queries these replace did.  ``last_interaction``
    after the start is exactly "some activity since the start"; an interaction
    *before* the start can't be told apart from one after it when both exist,
    which only matters for a course used before its term began.
    """
    return (
        Courses,
        and_(
            Courses.course_name == UserInteraction.course_name,
            UserInteraction.last_interaction > Courses.term_start_date,
        ),
    )


async def fetch_interacted_sids(
    course_name: str, div_ids: Iterable[str]
) -> Dict[str, Set[str]]:
    """The students who have touched each of ``div_ids`` in a course.

    :param div_ids: tracker keys -- question div_ids, or
        :func:`page_interaction_key` values for readings.
    :return: ``{div_id: {sid, ...}}`` with an entry for every key asked for.
    """
    keys = set(div_ids)
    result: Dict[str, Set[str]] = {key: set() for key in keys}
    if not keys:
        return result
    query = (
        select(UserInteraction.div_id, UserInteraction.sid)
        .join(*_since_term_start())
        .where(
            and_(
                UserInteraction.course_name == course_name,
                UserInteraction.div_id.in_(keys),
            )
        )
    )
    async with async_session() as session:
        for div_id, sid in (await session.execute(query)).all():
            result[div_id].add(sid)
    return result


async def fetch_interaction_counts(
    course_name: str, div_ids: Iterable[str]
) -> Dict[str, Dict[str, int]]:
    """How many times each student interacted with each of ``div_ids``.

    For a video or poll this is its submissions: the tracker only counts the
    acts that are real activity, the same filter ``is_interaction_event``
    applies to the useinfo rows.

    :return: ``{div_id: {sid: interactions}}`` with an entry for every key
        asked for.
    """
    keys = set(div_ids)
    result: Dict[str, Dict[str, int]] = {key: {} for key in keys}
    if not keys:
        return result
    query = select(
        UserInteraction.div_id, UserInteraction.sid, UserInteraction.interactions
    ).where(
        and_(
            UserInteraction.course_name == course_name,
            UserInteraction.div_id.in_(keys),
        )
    )
    async with async_session() as session:
        for div_id, sid, n in (await session.execute(query)).all():
            result[div_id][sid] = n
    return result


async def fetch_touched_div_ids(
    course_name: str, sid: str, div_ids: Iterable[str]
) -> Set[str]:
    """Which of ``div_ids`` one student has touched in a course.

    :param div_ids: tracker keys, as for :func:`fetch_interacted_sids`.
    """
    keys = set(div_ids)
    if not keys:
        return set()
    query = (
        select(UserInteraction.div_id)
        .join(*_since_term_start())
        .where(
            and_(
                UserInteraction.course_name == course_name,
                UserInteraction.sid == sid,
                UserInteraction.div_id.in_(keys),
            )
        )
    )
    async with async_session() as session:
        return set((await session.execute(query)).scalars())


# Backfill
# --------
# Builds tracker rows from historical useinfo, one id range at a time.  Each
# range is grouped to one row per (course, key, sid) before the upsert, and the
# upsert merges with least/greatest, so re-running a range only inflates
# ``interactions``; first/last stay exact.


def _real_activity_sql() -> str:
    """SQL mirroring :func:`interaction_key_for`'s act filter, built from the
    same ``INTERACTION_ACTS`` so the backfill and the live path cannot drift."""
    clauses = []
    for event, acts in sorted(INTERACTION_ACTS.items()):
        if acts is None:
            continue
        allowed = ", ".join(f"'{a}'" for a in sorted(acts))
        clauses.append(
            f"(u.event = '{event}' AND split_part(coalesce(u.act, ''), ':', 1) "
            f"NOT IN ({allowed}))"
        )
    return f"NOT ({' OR '.join(clauses)})" if clauses else "TRUE"


_UPSERT_TAIL = """
ON CONFLICT (course_name, div_id, sid) DO UPDATE SET
    first_interaction = least(user_interactions.first_interaction,
                              excluded.first_interaction),
    last_interaction = greatest(user_interactions.last_interaction,
                                excluded.last_interaction),
    interactions = user_interactions.interactions + excluded.interactions
"""

_KNOWN_SID = "u.sid IS NOT NULL AND u.sid <> '' AND u.sid <> 'Anonymous'"

_BACKFILL_EVENTS_SQL = f"""
INSERT INTO user_interactions
    (course_name, div_id, sid, first_interaction, last_interaction, interactions)
SELECT u.course_id, u.div_id, u.sid, min(u.timestamp), max(u.timestamp), count(*)
FROM useinfo u
WHERE u.id >= :lo AND u.id < :hi
  AND u.timestamp >= :since
  AND {_KNOWN_SID}
  AND u.course_id IS NOT NULL AND u.div_id IS NOT NULL AND u.div_id <> ''
  AND u.event <> 'page'
  AND {_real_activity_sql()}
GROUP BY u.course_id, u.div_id, u.sid
{_UPSERT_TAIL}
"""

# Page views mirror books.py: the subchapter is the file name without .html;
# a Sphinx book's chapter is the directory above it, and a PreTeXt book's is
# looked up from the subchapter (its labels are unique within the book).
# books.py decides PreTeXt from the course's own markup_system attribute,
# defaulting to RST, and so does this.
_BACKFILL_PAGES_SQL = f"""
WITH views AS (
    SELECT u.course_id, u.sid,
           substring(u.div_id from '([^/]+)\\.html$') AS sub,
           substring(u.div_id from '([^/]+)/[^/]+\\.html$') AS url_chapter,
           min(u.timestamp) AS first_ts, max(u.timestamp) AS last_ts,
           count(*) AS n
    FROM useinfo u
    WHERE u.id >= :lo AND u.id < :hi
      AND u.timestamp >= :since
      AND u.event = 'page'
      AND {_KNOWN_SID}
      AND u.course_id IS NOT NULL
    GROUP BY 1, 2, 3, 4
), keyed AS (
    SELECT v.course_id, v.sid, v.sub, v.first_ts, v.last_ts, v.n,
           CASE WHEN coalesce(ma.value, 'RST') = 'PreTeXt' THEN (
               SELECT ch.chapter_label
               FROM chapters ch
               JOIN sub_chapters sc ON sc.chapter_id = ch.id
               WHERE ch.course_id = c.base_course
                 AND sc.sub_chapter_label = v.sub
               LIMIT 1
           ) ELSE v.url_chapter END AS chapter
    FROM views v
    JOIN courses c ON c.course_name = v.course_id
    LEFT JOIN course_attributes ma
           ON ma.course_id = c.id AND ma.attr = 'markup_system'
    WHERE v.sub IS NOT NULL
)
INSERT INTO user_interactions
    (course_name, div_id, sid, first_interaction, last_interaction, interactions)
SELECT course_id, '{PAGE_KEY_PREFIX}' || chapter || '/' || sub, sid,
       min(first_ts), max(last_ts), sum(n)
FROM keyed
WHERE chapter IS NOT NULL AND chapter <> ''
GROUP BY 1, 2, 3
{_UPSERT_TAIL}
"""


def since_term_start():
    """Public form of the term-start guard, for readers that build their own
    queries on ``user_interactions``."""
    return _since_term_start()


async def fetch_backfill_bounds(since: datetime.datetime) -> tuple:
    """``(first_id, last_id)`` of the useinfo rows a backfill from ``since``
    has to walk, or ``(None, None)`` when there are none.

    The first id comes from the timestamp index, so this doesn't scan the
    table.  ids follow insertion order, which follows time closely enough; the
    per-batch ``timestamp >= since`` filter keeps the result exact.
    """
    async with async_session() as session:
        first = (
            await session.execute(
                text(
                    "SELECT id FROM useinfo WHERE timestamp >= :since "
                    "ORDER BY timestamp LIMIT 1"
                ),
                {"since": since},
            )
        ).scalar()
        last = (await session.execute(text("SELECT max(id) FROM useinfo"))).scalar()
    if first is None or last is None:
        return None, None
    return first, last


async def backfill_user_interactions(lo: int, hi: int, since: datetime.datetime) -> int:
    """Fold useinfo rows with ``lo <= id < hi`` and ``timestamp >= since`` into
    ``user_interactions``.  One transaction per call.

    :return: the number of tracker rows inserted or updated.
    """
    params = {"lo": lo, "hi": hi, "since": since}
    async with async_session.begin() as session:
        events = await session.execute(text(_BACKFILL_EVENTS_SQL), params)
        pages = await session.execute(text(_BACKFILL_PAGES_SQL), params)
        return (events.rowcount or 0) + (pages.rowcount or 0)
