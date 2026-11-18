"""add a (course_name, div_id) index to question_grades for grader stats

The grader's question list asks, for each question, how the whole class was
graded: ``course_name = X AND div_id = Y``.  Locally that is served by
``question_grades_key (div_id, course_name, sid)``, but production's unique
index is ``user_divid_course_idx (sid, course_name, div_id)``, which leads with
sid and cannot help.  Production falls back to ``ix_question_grades_div_id`` and
filters out every other course that uses the same book -- about 4,000 rows per
question for a widely used book, ~670 ms per question with a cold cache.

``sid`` and ``score`` are INCLUDEd so the stats are answered from the index
alone.

Revision ID: d4e9a1b7c2f5
Revises: c3d8f1a2b4e6
Create Date: 2026-10-10 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d4e9a1b7c2f5"
down_revision: Union[str, None] = "c3d8f1a2b4e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # question_grades is written on every autograded answer, so build without
    # a write lock; CONCURRENTLY cannot run inside a transaction.
    with op.get_context().autocommit_block():
        op.create_index(
            "question_grades_course_div_idx",
            "question_grades",
            ["course_name", "div_id"],
            postgresql_include=["sid", "score"],
            postgresql_concurrently=True,
            if_not_exists=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            "question_grades_course_div_idx",
            table_name="question_grades",
            postgresql_concurrently=True,
            if_exists=True,
        )
