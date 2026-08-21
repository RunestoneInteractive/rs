"""fix doenet iframe course mismatch

Revision ID: 5c11e34a2611
Revises: f3b8d5c2a710
Create Date: 2026-08-21 16:08:12.724002

Doenet exercises embed their activity in an ``<iframe src="/ns/books/
published/{base_course}/....html">``. That path is baked in once, at book
build time, using the base course the question was authored in
(``build_tools/core.py``, ``_process_single_question``). Nothing rewrites it
when the question is later linked or copied into a course whose base course
differs -- via assignment import, exercise search, or the "copy exercise"
action -- so the iframe keeps requesting the *original* base course forever.

``book_server_api``'s ``serve_page`` redirects any logged-in user whose
active course doesn't match the URL's course segment to the "change course"
page, unless the URL's course happens to be the user's own base course. For a
Doenet iframe pointing at a foreign base course, that redirect is what a
student sees instead of the activity.

The fix (paired with the ``build_tools/core.py`` change in this same commit)
appends ``?mode=browsing`` to the baked-in src, which makes ``serve_page``
treat the request as anonymous/read-only and skip that mismatch check
entirely. This is safe: base courses are never ``login_required``, and Doenet
grading is driven entirely by the *outer* page's own logged-in session via
postMessage (see ``spliceWrapper.ts``) -- the inner iframe's own auth state is
never consulted. This migration backfills every already-built ``doenet``
question so existing courses are fixed without a full book rebuild.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5c11e34a2611'
down_revision: Union[str, None] = 'f3b8d5c2a710'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Matches the exact shape build_tools/core.py bakes in: an <iframe ...
# src="/ns/books/published/{course}/{path}.html"> with nothing after .html.
# The negative lookahead on the closing quote keeps this idempotent -- a row
# already carrying ?mode=browsing (e.g. rebuilt after this fix shipped) is
# left untouched rather than getting a second query string appended.
ADD_MODE_BROWSING = sa.text(
    r"""
    UPDATE questions
       SET htmlsrc = regexp_replace(
             htmlsrc,
             '(<iframe[^>]*?src="/ns/books/published/[^"]*?\.html)"',
             '\1?mode=browsing"',
             'g'
           )
     WHERE question_type = 'doenet'
       AND htmlsrc ~ '<iframe[^>]*?src="/ns/books/published/[^"]*?\.html"'
    """
)

REMOVE_MODE_BROWSING = sa.text(
    r"""
    UPDATE questions
       SET htmlsrc = regexp_replace(
             htmlsrc,
             '(<iframe[^>]*?src="/ns/books/published/[^"]*?\.html)\?mode=browsing"',
             '\1"',
             'g'
           )
     WHERE question_type = 'doenet'
       AND htmlsrc ~ '<iframe[^>]*?src="/ns/books/published/[^"]*?\.html\?mode=browsing"'
    """
)


def upgrade() -> None:
    conn = op.get_bind()
    updated = conn.execute(ADD_MODE_BROWSING).rowcount
    print(f"doenet iframe fix: added ?mode=browsing to {updated} question(s)")


def downgrade() -> None:
    conn = op.get_bind()
    reverted = conn.execute(REMOVE_MODE_BROWSING).rowcount
    print(f"doenet iframe fix: removed ?mode=browsing from {reverted} question(s)")
