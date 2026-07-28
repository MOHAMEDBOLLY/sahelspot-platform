"""venue category taxonomy extension

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-28

PLATFORM_SPEC_v1.0_FROZEN.md §3 — extends venues.category's legal-value set
from 9 to 13 (adds Resort, Spa, Beach Club, Activity), closing the taxonomy
collision the migration audit found (107 of 426 legacy venues had no legal
value under the prior 9-value list). Purely additive — no existing row can
violate the new, wider constraint.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_CATEGORIES = (
    "Restaurant",
    "Cafe",
    "Hotel",
    "Beach",
    "Nightlife",
    "Shopping",
    "Services",
    "Entertainment",
    "Other",
)
NEW_CATEGORIES = OLD_CATEGORIES + ("Resort", "Spa", "Beach Club", "Activity")


def upgrade() -> None:
    op.drop_constraint("ck_venues_category", "venues", type_="check")
    op.create_check_constraint(
        "ck_venues_category",
        "venues",
        f"category IN {NEW_CATEGORIES}",
    )


def downgrade() -> None:
    op.drop_constraint("ck_venues_category", "venues", type_="check")
    op.create_check_constraint(
        "ck_venues_category",
        "venues",
        f"category IN {OLD_CATEGORIES}",
    )
