"""venue category taxonomy extension

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-28

PLATFORM_SPEC_v1_FINAL.md §3 (Taxonomy Specification — FINAL) — extends
venues.category's legal-value set from 9 to 13 (adds Resort, Spa, Beach
Club, Activity), closing the taxonomy collision the migration audit found
(107 of 426 legacy venues had no legal value under the prior 9-value
list). This value list is inherited unchanged by PLATFORM_SPEC_v1.0_
FROZEN.md, which does not restate it under its own numbering (per that
document's own policy of not repeating decisions the architecture review
didn't challenge) — §3 in the FROZEN document is a different topic
(Database Indexing), so the citation here is deliberately to the FINAL
spec, not the FROZEN one. Purely additive — no existing row can violate
the new, wider constraint.
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
