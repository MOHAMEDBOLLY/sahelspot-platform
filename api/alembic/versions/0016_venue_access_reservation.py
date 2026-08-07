"""venue access type and reservation policy

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-07

Category/Tags/Access Type/Badges/Collections architecture (Phase 1) — the
Access Type and Badges (Reservation Policy) layers. Both are plain nullable
`venues` columns, CHECK-constrained against a small fixed vocabulary, same
treatment as VENUE_CATEGORIES — deliberately NOT nested inside
`beach_details` (that JSONB column stays Beach-only and is kept temporarily
for backward compatibility per the approved plan; its own `publicAccess`
key is a narrower 3-value yes/no/unknown concept, not the same thing as
this 5-value Access Type, and is removed in a later migration once Consumer
no longer needs it).
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ACCESS_TYPES = (
    "Public",
    "Paid Entry",
    "QR Required",
    "Residents Only",
    "Hotel Guests Only",
)
RESERVATION_POLICIES = ("Required", "Recommended")


def upgrade() -> None:
    op.add_column("venues", sa.Column("access_type", sa.Text(), nullable=True))
    op.add_column("venues", sa.Column("reservation_policy", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ck_venues_access_type", "venues", f"access_type IS NULL OR access_type IN {ACCESS_TYPES}"
    )
    op.create_check_constraint(
        "ck_venues_reservation_policy",
        "venues",
        f"reservation_policy IS NULL OR reservation_policy IN {RESERVATION_POLICIES}",
    )


def downgrade() -> None:
    op.drop_constraint("ck_venues_reservation_policy", "venues", type_="check")
    op.drop_constraint("ck_venues_access_type", "venues", type_="check")
    op.drop_column("venues", "reservation_policy")
    op.drop_column("venues", "access_type")
