"""add imported_from_assignment_id to assignments

Records which assignment an imported copy came from, so the import browser can
tell an instructor they already have a copy rather than letting them import the
same thing twice without noticing. Assignments that predate this column were
authored in place or copied by the old admin page, neither of which left a
trail, so they stay NULL.

Revision ID: f3b8d5c2a710
Revises: e7a3c9d1f4b2
Create Date: 2026-08-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f3b8d5c2a710'
down_revision: Union[str, None] = 'e7a3c9d1f4b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'assignments',
        sa.Column('imported_from_assignment_id', sa.Integer(), nullable=True),
    )
    # ON DELETE SET NULL, not CASCADE: this is a breadcrumb, and deleting the
    # source assignment must never reach into another instructor's course and
    # delete their copy. Losing the breadcrumb is the correct fallout -- a
    # source that no longer exists cannot be offered for import again anyway.
    op.create_foreign_key(
        'assignments_imported_from_assignment_id_fkey',
        'assignments',
        'assignments',
        ['imported_from_assignment_id'],
        ['id'],
        ondelete='SET NULL',
    )
    # The lookup is always "which rows in *this* course came from one of these
    # source ids", so the index carries the course alongside the source.
    op.create_index(
        'assignments_imported_from_idx',
        'assignments',
        ['course', 'imported_from_assignment_id'],
    )


def downgrade() -> None:
    op.drop_index('assignments_imported_from_idx', table_name='assignments')
    op.drop_constraint(
        'assignments_imported_from_assignment_id_fkey',
        'assignments',
        type_='foreignkey',
    )
    op.drop_column('assignments', 'imported_from_assignment_id')
