"""add composite indexes for reading progress lookups

Revision ID: c3d8f1a2b4e6
Revises: e5f6a7b8c9d0
Create Date: 2026-10-07 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c3d8f1a2b4e6"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Both tables are written on every page view, so build the indexes without
    # taking a write lock; CONCURRENTLY cannot run inside a transaction.
    with op.get_context().autocommit_block():
        # Production already has this one, created by hand under this name.
        op.create_index(
            "user_chapter_progress_user_id_chapter_id_idx",
            "user_chapter_progress",
            ["user_id", "chapter_id"],
            postgresql_concurrently=True,
            if_not_exists=True,
        )
        op.create_index(
            "user_sub_chapter_progress_user_course_idx",
            "user_sub_chapter_progress",
            ["user_id", "course_name", "chapter_id", "sub_chapter_id"],
            postgresql_concurrently=True,
            if_not_exists=True,
        )


def downgrade() -> None:
    # Leave user_chapter_progress_user_id_chapter_id_idx alone: production had
    # it before this migration, so it is not this migration's to drop.
    with op.get_context().autocommit_block():
        op.drop_index(
            "user_sub_chapter_progress_user_course_idx",
            table_name="user_sub_chapter_progress",
            postgresql_concurrently=True,
            if_exists=True,
        )
