"""add blind grading role and assignment policy

Revision ID: c2f8a1d4e7b9
Revises: a1c7e93d40b8
Create Date: 2026-09-26 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c2f8a1d4e7b9"
down_revision: Union[str, None] = "a1c7e93d40b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "course_grader",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["auth_user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "course_id", "user_id", name="uq_course_grader_course_user"
        ),
    )
    op.create_index(
        op.f("ix_course_grader_course_id"),
        "course_grader",
        ["course_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_course_grader_user_id"),
        "course_grader",
        ["user_id"],
        unique=False,
    )

    op.add_column(
        "assignments",
        sa.Column(
            "blind_grading",
            sa.CHAR(length=1),
            nullable=True,
            server_default=sa.text("'F'"),
        ),
    )
    op.execute("UPDATE assignments SET blind_grading = 'F' WHERE blind_grading IS NULL")


def downgrade() -> None:
    op.drop_column("assignments", "blind_grading")
    op.drop_index(op.f("ix_course_grader_user_id"), table_name="course_grader")
    op.drop_index(op.f("ix_course_grader_course_id"), table_name="course_grader")
    op.drop_table("course_grader")
