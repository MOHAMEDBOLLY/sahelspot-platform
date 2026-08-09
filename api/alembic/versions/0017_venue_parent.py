"""venue parent + is_no_qr (No QR area/standalone grouping)

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-09

Studio Content Organization — Beaches + No QR. Beaches needs no schema
change at all (Studio already has `GET /editor/venues?category=` and real
beach venues are filed under the existing `Beach Club` category).

No QR needs two things the existing schema has no mechanism for:

1. `is_no_qr` — an explicit designation that a venue IS a No QR discovery
   place (a Walk, a Mall, a standalone roadside spot), same treatment as
   `is_featured`/`is_verified`. This is deliberately NOT derived from
   `access_type != 'QR Required'` — that's a different concept (the
   access *method* a venue requires, still correctly served by
   `GET /public/discover/no-qr`, api/app/api/routes/public.py, which is
   unchanged by this migration). A normal Restaurant/Coffee/Hotel venue
   that merely doesn't require a QR code is NOT a No QR discovery place
   by itself; this column is the actual product signal for that.
   `server_default=false` — every existing venue defaults to `false`, no
   guessing, no bulk-classification; an editor opts a venue in explicitly.

2. `parent_venue_id` — an optional "this venue is inside/belongs to that
   other venue" relationship (e.g. individual shops inside "Zahra Walk").
   A single nullable, self-referential FK — not a new Walk/Mall/Area
   entity. Only a venue with `is_no_qr = true` may be pointed at as a
   parent (enforced in `validate_parent_venue_id`,
   api/app/validation/venues.py — an application-layer rule, not a DB
   constraint, same treatment `validate_beach_details_shape` already
   uses for a similarly cross-field invariant). `ondelete="SET NULL"` —
   deleting a parent venue must never cascade-delete the real venues
   inside it; they simply become standalone again, always a safe,
   non-destructive state.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("venues", sa.Column("parent_venue_id", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_venues_parent_venue_id",
        "venues",
        "venues",
        ["parent_venue_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_venues_parent_venue_id", "venues", ["parent_venue_id"])
    op.add_column(
        "venues",
        sa.Column("is_no_qr", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("venues", "is_no_qr")
    op.drop_index("ix_venues_parent_venue_id", table_name="venues")
    op.drop_constraint("fk_venues_parent_venue_id", "venues", type_="foreignkey")
    op.drop_column("venues", "parent_venue_id")
