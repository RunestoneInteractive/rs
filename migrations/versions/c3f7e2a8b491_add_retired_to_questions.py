"""add retired_on/retired_by to questions

An editor triaging a flagged exercise used to delete the row outright, which
cascades through assignment_questions and silently pulls the exercise out of
every live course that had assigned it. Retiring instead hides the exercise
from the instructor-facing search paths while leaving it intact for courses
that already reference it.

retired_on doubles as the audit trail: it records *when* an exercise left
circulation, which the purge script needs in order to honour a grace period
before any row is actually deleted. NULL means the exercise is live.

Revision ID: c3f7e2a8b491
Revises: f3b8d5c2a710
Create Date: 2026-09-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3f7e2a8b491"
down_revision: Union[str, None] = "f3b8d5c2a710"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("questions", sa.Column("retired_on", sa.DateTime(), nullable=True))
    op.add_column(
        "questions", sa.Column("retired_by", sa.String(length=512), nullable=True)
    )
    # Every search path tests `retired_on IS NULL`, which matches nearly every
    # row, so a plain b-tree index would never be chosen. A partial index on
    # the retired rows is small and is what the purge script scans.
    op.create_index(
        "questions_retired_on_idx",
        "questions",
        ["retired_on"],
        postgresql_where=sa.text("retired_on IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("questions_retired_on_idx", table_name="questions")
    op.drop_column("questions", "retired_by")
    op.drop_column("questions", "retired_on")
