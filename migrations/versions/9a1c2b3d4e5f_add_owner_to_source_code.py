"""add owner to source_code

Revision ID: 9a1c2b3d4e5f
Revises: 2db61c1550a2
Create Date: 2025-12-26 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9a1c2b3d4e5f"
down_revision: Union[str, None] = "2db61c1550a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add owner column to source_code table
    op.add_column(
        "source_code", sa.Column("owner", sa.String(length=512), nullable=True)
    )
    # Add index on owner for faster lookups
    op.create_index("ix_source_code_owner", "source_code", ["owner"])


def downgrade() -> None:
    op.drop_index("ix_source_code_owner", table_name="source_code")
    op.drop_column("source_code", "owner")

