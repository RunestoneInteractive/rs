"""source_code table filename

Revision ID: 37b73c74eebe
Revises: 3dd5bafe949d
Create Date: 2025-04-21 07:57:16.696999

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "37b73c74eebe"
down_revision: Union[str, None] = "3dd5bafe949d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "source_code", sa.Column("filename", sa.String(length=512), nullable=True)
    )
    # for existing items, duplicate acid to filename
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE source_code
            SET filename = acid
            """
        )
    )

    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("source_code", "filename")
    # ### end Alembic commands ###
