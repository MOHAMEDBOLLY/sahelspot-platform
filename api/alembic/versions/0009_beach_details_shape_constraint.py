"""beach_details integrity constraint

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-28

PLATFORM_SPEC_v1.0_FROZEN.md §7.8 — DB-enforces beach_details' key-presence
shape, closing the inconsistency the architecture review found: category
and status get CHECK-constraint enforcement, but beach_details relied on
application-layer validation alone. Key-presence only (a JSONB CHECK can't
practically validate nested value types/enums) — deep shape validation
remains the application layer's job, the same limit that already applies
to opening_hours.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CONSTRAINT_SQL = (
    "beach_details IS NULL OR "
    "(category = 'Beach' AND beach_details ? 'type' AND beach_details ? 'publicAccess')"
)


def upgrade() -> None:
    op.create_check_constraint(
        "ck_venues_beach_details_shape",
        "venues",
        CONSTRAINT_SQL,
    )


def downgrade() -> None:
    op.drop_constraint("ck_venues_beach_details_shape", "venues", type_="check")
