"""events require location

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-03

Events Module v1 refinement — an event's location isn't optional in the
aggregate: `venue_id`/`destination_id` each stay individually nullable
(an event may have only one of the two), but at least one must be set.
Enforced at the database level, same "CHECK constraint over an
application-only rule" precedent `ck_venues_beach_details_shape` already
establishes for a cross-column invariant — not just checked in the route,
so a row can never reach this state via any write path, present or
future.

No existing rows violate this: production has zero events published or
drafted as of this migration (confirmed before writing it), so there's no
backfill/data-fix step needed.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_events_has_location",
        "events",
        "venue_id IS NOT NULL OR destination_id IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_constraint("ck_events_has_location", "events", type_="check")
