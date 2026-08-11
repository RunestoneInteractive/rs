"""add is_binary to source_code

Revision ID: e5f6a7b8c9d0
Revises: c4e8a1f7b2d9
Create Date: 2026-08-08 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from rsptx.db.models import Web2PyBoolean


# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "c4e8a1f7b2d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_binary column to source_code table.  True marks a base64 binary
    # payload (e.g. a compiled .jar or .zip); text files keep it False.  This
    # lets a program on one page recognize a binary file stored for another.
    op.add_column(
        "source_code",
        sa.Column(
            "is_binary",
            Web2PyBoolean(length=1),
            nullable=False,
            server_default=sa.text("'F'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("source_code", "is_binary")
