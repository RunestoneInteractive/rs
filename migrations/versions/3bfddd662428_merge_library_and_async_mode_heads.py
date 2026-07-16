"""merge library and async_mode heads

Revision ID: 3bfddd662428
Revises: a91c47d2e8b3, d8e4f2b6c1a7
Create Date: 2026-07-16 17:10:25.568106

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3bfddd662428'
down_revision: Union[str, None] = ('a91c47d2e8b3', 'd8e4f2b6c1a7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
