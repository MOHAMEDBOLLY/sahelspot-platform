"""translations and legacy_geo columns

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-28

PLATFORM_SPEC_v1.0_FROZEN.md §5.1 — adds `translations` (JSONB, nullable)
to `venues` and `destinations`, backing the {"<locale>": {"name": ...}}
internationalization model. `name`/`short_description` remain the required,
canonical, fallback values (§5.2); this column carries locale overlays only.

Also adds `venues.legacy_geo` (JSONB, nullable) — preserves the legacy
geo-review object verbatim at migration time. This column was specified
in PLATFORM_SPEC_v1_FINAL.md §2.2 (Venue entity table) and its
drop-eligibility condition confirmed required by
PLATFORM_SPEC_v1.0_FROZEN.md §7.13, but had no corresponding
creation task in docs/IMPLEMENTATION_BACKLOG.md's Phase 1 — a gap between
the two frozen documents identified during Phase 1 execution and corrected
here with the user's explicit sign-off, not a specification change.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("venues", sa.Column("translations", postgresql.JSONB(), nullable=True))
    op.add_column("venues", sa.Column("legacy_geo", postgresql.JSONB(), nullable=True))
    op.add_column("destinations", sa.Column("translations", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("destinations", "translations")
    op.drop_column("venues", "legacy_geo")
    op.drop_column("venues", "translations")
