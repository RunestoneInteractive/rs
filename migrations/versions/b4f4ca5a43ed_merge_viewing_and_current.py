"""merge viewing and current

Revision ID: b4f4ca5a43ed
Revises: c2f8a1d4e7b9, e7b3c5a9d1f2
Create Date: 2026-10-16 07:05:23.933116

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4f4ca5a43ed'
down_revision: Union[str, None] = ('c2f8a1d4e7b9', 'e7b3c5a9d1f2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
