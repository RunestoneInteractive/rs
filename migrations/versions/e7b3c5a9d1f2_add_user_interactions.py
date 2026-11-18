"""add user_interactions, a per-(course, item, student) summary of useinfo

Answers "has this student touched this item, and when" from a small indexed
table.  The first reader is the grader's readings stats, which had to scan a
course's whole useinfo history to match page paths by suffix.  See
notes/interaction_tracker_design.md.

The table starts empty, so the indexes are built in the same transaction; no
CONCURRENTLY needed.  History is filled in by ``rsmanage backfill-interactions``
after the write path is deployed.

Revision ID: e7b3c5a9d1f2
Revises: d4e9a1b7c2f5
Create Date: 2026-10-10 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7b3c5a9d1f2"
down_revision: Union[str, None] = "d4e9a1b7c2f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_interactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("course_name", sa.String(length=512), nullable=False),
        sa.Column("div_id", sa.String(length=512), nullable=False),
        sa.Column("sid", sa.String(length=512), nullable=False),
        sa.Column("first_interaction", sa.DateTime(), nullable=False),
        sa.Column("last_interaction", sa.DateTime(), nullable=False),
        sa.Column(
            "interactions", sa.Integer(), server_default="1", nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(
        "user_interactions_course_div_sid_idx",
        "user_interactions",
        ["course_name", "div_id", "sid"],
        unique=True,
        if_not_exists=True,
    )
    op.create_index(
        "user_interactions_course_sid_idx",
        "user_interactions",
        ["course_name", "sid"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(
        "user_interactions_course_sid_idx",
        table_name="user_interactions",
        if_exists=True,
    )
    op.drop_index(
        "user_interactions_course_div_sid_idx",
        table_name="user_interactions",
        if_exists=True,
    )
    op.drop_table("user_interactions", if_exists=True)
