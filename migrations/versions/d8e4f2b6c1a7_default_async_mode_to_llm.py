"""default assignment_questions.async_mode to llm

Revision ID: d8e4f2b6c1a7
Revises: b7f3c1a9d2e4
Create Date: 2026-07-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd8e4f2b6c1a7'
down_revision: Union[str, None] = 'b7f3c1a9d2e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New peer questions default to the generic LLM mode. Existing rows keep
    # whatever mode they already have (standard/llm/analogies).
    op.alter_column(
        'assignment_questions',
        'async_mode',
        server_default=sa.text("'llm'"),
    )


def downgrade() -> None:
    op.alter_column(
        'assignment_questions',
        'async_mode',
        server_default=sa.text("'standard'"),
    )
