"""activity log

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-24

Adds `activity_log`, per docs/DATABASE.md's Sprint 19 addition — a
cross-cutting observability table, independent of `destinations`/`venues`/
`publish_revisions`. No foreign keys in or out: an activity entry is a
point-in-time record of what happened, not a live reference to the entity
it describes (which may later change status or even not exist under that
same understanding anymore).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "activity_log",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column(
            "timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("entity_type", sa.Text(), nullable=False),
        sa.Column("entity_id", sa.Text(), nullable=False),
        sa.Column("actor", sa.Text(), server_default=sa.text("'system'"), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_activity_log_timestamp"), "activity_log", ["timestamp"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_activity_log_timestamp"), table_name="activity_log")
    op.drop_table("activity_log")
