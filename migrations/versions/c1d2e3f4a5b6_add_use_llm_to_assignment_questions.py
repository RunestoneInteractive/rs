"""add use_llm to assignment_questions

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
    #Add use_llm column to assignment_questions table as nullable
    #controls whether a peer instruction question uses an LLM peer for async mode
    op.add_column('assignment_questions',
        sa.Column('use_llm', sa.String(length=1), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('assignment_questions', 'use_llm')
