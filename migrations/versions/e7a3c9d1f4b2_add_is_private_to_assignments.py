"""add is_private to assignments

Marks whether an assignment may be discovered and imported by instructors
outside the course that owns it. Existing assignments were authored with no
expectation of being visible elsewhere, so they all become private and sharing
is only ever an explicit act.

Revision ID: e7a3c9d1f4b2
Revises: c4e8a1f7b2d9
Create Date: 2026-08-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7a3c9d1f4b2'
down_revision: Union[str, None] = 'c4e8a1f7b2d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'assignments',
        sa.Column(
            'is_private',
            sa.CHAR(length=1),
            nullable=True,
            server_default=sa.text("'T'"),
        ),
    )
    # Backfill rather than constrain: the column stays nullable to match
    # questions.is_private, and the sharing predicate tests `is_private = 'F'`,
    # which no NULL row satisfies. An unset value is therefore private.
    op.execute("UPDATE assignments SET is_private = 'T' WHERE is_private IS NULL")


def downgrade() -> None:
    op.drop_column('assignments', 'is_private')
