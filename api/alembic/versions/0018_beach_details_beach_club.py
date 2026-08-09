"""retarget beach_details shape constraint to Beach Club

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-09

STUDIO — BEACHES + NO QR FOUNDATION. Read-only production inventory found
zero venues with `category = 'Beach'` and 21 real beach venues filed under
`category = 'Beach Club'` — Studio's own `/beaches` nav already redirects
to `?category=Beach+Club`. `ck_venues_beach_details_shape` (0001 baseline)
and `validate_beach_details_shape` (api/app/validation/venues.py) both
hardcoded the unused 'Beach' literal, so the beach-specific editor
(`BeachDetailsSection.tsx`) never actually appeared for any real beach
venue. This migration only redefines the CHECK constraint's literal;
`beach_details` had zero populated rows at the time of writing (confirmed
by inventory query), so no existing row's data changes or is at risk of
violating the new constraint.

NOT APPLIED as of this commit — prepared for review per the
BEACHES + NO QR FOUNDATION task's explicit "stop before applying any
migration" instruction. Do not run `alembic upgrade head` with this
present until it has been reviewed and explicitly approved.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_venues_beach_details_shape", "venues", type_="check")
    op.create_check_constraint(
        "ck_venues_beach_details_shape",
        "venues",
        "beach_details IS NULL OR "
        "(category = 'Beach Club' AND beach_details ? 'type' AND beach_details ? 'publicAccess')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_venues_beach_details_shape", "venues", type_="check")
    op.create_check_constraint(
        "ck_venues_beach_details_shape",
        "venues",
        "beach_details IS NULL OR "
        "(category = 'Beach' AND beach_details ? 'type' AND beach_details ? 'publicAccess')",
    )
