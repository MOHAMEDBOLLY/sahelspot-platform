"""optimistic concurrency version columns

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-28

PLATFORM_SPEC_v1.0_FROZEN.md §4 — adds `version` (integer, default 1) to
`venues` and `destinations`, backing the ETag/If-Match optimistic-locking
protocol §4.3 specifies. Schema only — the protocol itself (response ETag,
required If-Match, 428/409 handling) is separate application-layer work.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "venues",
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column(
        "destinations",
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )


def downgrade() -> None:
    op.drop_column("destinations", "version")
    op.drop_column("venues", "version")
