"""app users

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-25

Adds `app_users` — the table Sprint 24's authorization layer reads to
answer "what role does this Supabase identity have here." No foreign
keys in or out: `id` is a Supabase auth user's UUID, an identity that
lives outside this database, same reasoning `publish_revisions` already
uses for having none. Schema only — no seed rows; the first admin is
bootstrapped at application runtime (see `app/auth/dependencies.py`), not
baked into this migration, since the real admin's Supabase user id isn't
known at migration-authoring time and varies per deployment.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_users",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "role IN ('viewer', 'editor', 'publisher', 'admin')", name="ck_app_users_role"
        ),
    )


def downgrade() -> None:
    op.drop_table("app_users")
