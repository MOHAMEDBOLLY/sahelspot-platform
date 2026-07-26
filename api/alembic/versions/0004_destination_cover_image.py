"""destination cover image

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-26

Adds `destinations.cover_image_url` — Sprint 29's Destination CRUD Parity,
mirroring the same column already on `venues` (Sprint 2.5 design). No
gallery column: destinations deliberately get cover-only media support,
per this sprint's explicit scope.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("destinations", sa.Column("cover_image_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("destinations", "cover_image_url")
