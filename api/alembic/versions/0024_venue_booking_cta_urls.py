"""venue booking CTA urls

Revision ID: 0024
Revises: 0023
Create Date: 2026-08-16

Booking CTA Fields (Phase 1) — three optional external booking URLs on
`venues`: `reserve_your_spot_beach_url`, `reserve_your_table_url`,
`reserve_your_spot_nightlife_url`. Same plain nullable `Text`, no CHECK
constraint, no format validation treatment as the existing website/
instagram_handle/facebook_handle/tiktok_handle/whatsapp/maps_url columns
(confirmed by audit: none of those have a DB-level format constraint
either). Purely additive — no existing column, constraint, or row is
touched.

SahelSpot is not the booking engine for these — Consumer will eventually
just open the URL a venue's editor sets here, no internal reservation
flow, no booking state, no auth requirement. That Consumer integration is
explicitly out of scope for this phase (Studio data/model layer only).

Deliberately three separate columns, not one generic "booking_url" +
a label enum: Beach and Nightlife share the CTA label ("Reserve Your
Spot") but are different venue categories that must be settable
independently (product decision, confirmed before writing this
migration). Studio gates which single field an editor sees per venue by
category (Beach Club / Nightlife) or category+tag (Restaurant +
'fine-dining') — enforced in the Studio UI only, not at the DB layer,
matching how `access_type`/`reservation_policy` (also category-agnostic
at the DB level) already work.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("venues", sa.Column("reserve_your_spot_beach_url", sa.Text(), nullable=True))
    op.add_column("venues", sa.Column("reserve_your_table_url", sa.Text(), nullable=True))
    op.add_column("venues", sa.Column("reserve_your_spot_nightlife_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("venues", "reserve_your_spot_nightlife_url")
    op.drop_column("venues", "reserve_your_table_url")
    op.drop_column("venues", "reserve_your_spot_beach_url")
