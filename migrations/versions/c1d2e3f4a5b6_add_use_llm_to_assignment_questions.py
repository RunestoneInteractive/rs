"""add async_mode to assignment_questions

Revision ID: c1d2e3f4a5b6
Revises: a1b2c3d4e5f6
Create Date: 2026-04-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'assignment_questions',
        sa.Column(
            'async_mode',
            sa.String(length=20),
            nullable=True,
            server_default=sa.text("'standard'"),
        ),
    )
    op.execute("UPDATE assignment_questions SET async_mode = 'standard' WHERE async_mode IS NULL")
    op.alter_column('assignment_questions', 'async_mode', nullable=False)


def downgrade() -> None:
    op.drop_column('assignment_questions', 'async_mode')
