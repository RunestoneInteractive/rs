"""add async_study to assignments

Marks an assignment as part of the async peer instruction study, so every
student who opens it is randomly assigned one discussion condition and keeps it
across the assignment's questions. Existing assignments are not part of any
study, so they all start out false.

Revision ID: a1c7e93d40b8
Revises: f3b8d5c2a710
Create Date: 2026-09-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1c7e93d40b8"
down_revision: Union[str, None] = "f3b8d5c2a710"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "assignments",
        sa.Column(
            "async_study",
            sa.CHAR(length=1),
            nullable=True,
            server_default=sa.text("'F'"),
        ),
    )

    op.execute("UPDATE assignments SET async_study = 'F' WHERE async_study IS NULL")


def downgrade() -> None:
    op.drop_column("assignments", "async_study")
