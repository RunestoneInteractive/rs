"""add last_access to user_courses

Records when each user last did anything in each course, so pages like
My Courses can sort by recent use without scanning ``useinfo``. Also adds the
(user_id, course_id) index that every enrollment lookup has been missing.

The backfill only looks at the last 30 days of ``useinfo``, which is all the
My Courses page has ever used; older enrollments start out NULL.

Revision ID: b7e2c4d91f3a
Revises: a1c7e93d40b8
Create Date: 2026-09-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7e2c4d91f3a"
down_revision: Union[str, None] = "a1c7e93d40b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_courses", sa.Column("last_access", sa.DateTime(), nullable=True))

    # user_courses and useinfo are both large and busy in production, so build
    # the index without locking out enrollments.
    with op.get_context().autocommit_block():
        op.create_index(
            "user_courses_user_course_idx",
            "user_courses",
            ["user_id", "course_id"],
            postgresql_concurrently=True,
            if_not_exists=True,
        )

    op.execute(
        """
        UPDATE user_courses uc
        SET last_access = recent.last_acc
        FROM (
            SELECT sid, course_id, max(timestamp) AS last_acc
            FROM useinfo
            WHERE timestamp > (now() AT TIME ZONE 'utc') - interval '30 days'
            GROUP BY sid, course_id
        ) recent
        JOIN auth_user a ON a.username = recent.sid
        JOIN courses c ON c.course_name = recent.course_id
        WHERE uc.user_id = a.id AND uc.course_id = c.id
        """
    )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            "user_courses_user_course_idx",
            table_name="user_courses",
            postgresql_concurrently=True,
            if_exists=True,
        )
    op.drop_column("user_courses", "last_access")
