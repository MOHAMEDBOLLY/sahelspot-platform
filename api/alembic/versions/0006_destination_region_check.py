"""destination region enforcement

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-28

PLATFORM_SPEC_v1.0_FROZEN.md §7.3 — constrains destinations.region to the
8 named values, closing the inconsistency the architecture review found:
region was described as a small, closed vocabulary (same reasoning as
category) but had no CHECK constraint, leaving it open to the same drift
the audit already found in the legacy venues.destination free-text field.

The one existing production row (marassi, region='Sidi Abdelrahman Area')
is already within this set and is unaffected.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

REGIONS = (
    "Sidi Abdelrahman Area",
    "Marina",
    "New Alamein City",
    "Telal North Coast",
    "Ras El Hekma",
    "Fouka Bay",
    "Dabaa City",
    "Almaza Bay",
)


def upgrade() -> None:
    op.create_check_constraint(
        "ck_destinations_region",
        "destinations",
        f"region IN {REGIONS}",
    )


def downgrade() -> None:
    op.drop_constraint("ck_destinations_region", "destinations", type_="check")
