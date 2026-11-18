"""add removed_on to library

Records when `rsmanage library retire` took a book out of service: hidden from
the library and the course creation page, and its source folder deleted from
BOOK_PATH. NULL means the book is still in service.

Revision ID: a6c2e9f4b1d7
Revises: b4f4ca5a43ed
Create Date: 2026-10-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a6c2e9f4b1d7'
down_revision: Union[str, None] = 'b4f4ca5a43ed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('library', sa.Column('removed_on', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('library', 'removed_on')
