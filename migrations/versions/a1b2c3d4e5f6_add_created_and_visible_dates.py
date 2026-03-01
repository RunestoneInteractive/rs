"""add created_date and visible_on to assignments

Revision ID: a1b2c3d4e5f6
Revises: 9a1c2b3d4e5f
Create Date: 2026-02-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '9a1c2b3d4e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add created_date column to assignments table as nullable
    # For existing assignments, created_date will be NULL
    # For new assignments, it will be set automatically
    op.add_column('assignments',
        sa.Column('updated_date', sa.DateTime(), nullable=True)
    )

    # Add visible_on column to assignments table as nullable
    # This will be used to control when assignment becomes visible to students
    op.add_column('assignments',
        sa.Column('visible_on', sa.DateTime(), nullable=True)
    )

    # Add hidden_on column to assignments table as nullable
    # This will be used to control when assignment becomes hidden from students
    op.add_column('assignments',
        sa.Column('hidden_on', sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('assignments', 'hidden_on')
    op.drop_column('assignments', 'visible_on')
    op.drop_column('assignments', 'updated_date')

