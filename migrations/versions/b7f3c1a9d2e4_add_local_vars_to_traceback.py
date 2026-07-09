"""add local_vars JSON column to traceback

Revision ID: b7f3c1a9d2e4
Revises: 865a6dbf6c09
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7f3c1a9d2e4'
down_revision: Union[str, None] = '865a6dbf6c09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'traceback',
        sa.Column('local_vars', sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('traceback', 'local_vars')
