"""venue no_qr_type (Walk / Mall classification)

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-09

STUDIO — BEACHES + NO QR FOUNDATION. The final product taxonomy needs to
distinguish a designated No QR parent venue as a Walk or a Mall. Not
modeled as a Tag: `Tag.category` is CHECK-constrained to a single
VENUE_CATEGORIES value, but a No QR parent can legitimately be filed under
several different categories (a mall might be 'Shopping', a walk might be
'Other'/'Activity'), so no single tag category cleanly covers every
parent. Not `access_type`, `category`, `reservation_policy`, `Destination.
region`, or Collections — all explicitly ruled out per product decision.

Smallest safe structure: one nullable `Text` column, CHECK-constrained to
a small fixed vocabulary (`NO_QR_TYPES` = "Walk"/"Mall"), same treatment
`access_type`/`reservation_policy` already get (migration 0016), and only
ever valid alongside `is_no_qr = true` (mirrors `ck_venues_beach_details_
shape`'s "value only valid alongside its owning flag" shape). Additive
and fully backward compatible: `NULL` by default for every existing row
(there are zero `is_no_qr = true` rows in production as of this writing,
confirmed by inventory query — this migration has no existing data to
reclassify), and the column is never written by this migration itself —
Walk vs Mall stays an explicit, later, per-venue editor choice, never
inferred or guessed here.

NOT APPLIED as of this commit — prepared for review per the
BEACHES + NO QR FOUNDATION task's explicit "stop before applying any
migration" instruction. Do not run `alembic upgrade head` with this
present until it has been reviewed and explicitly approved.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NO_QR_TYPES = ("Walk", "Mall")


def upgrade() -> None:
    op.add_column("venues", sa.Column("no_qr_type", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ck_venues_no_qr_type",
        "venues",
        f"no_qr_type IS NULL OR (is_no_qr AND no_qr_type IN {NO_QR_TYPES})",
    )


def downgrade() -> None:
    op.drop_constraint("ck_venues_no_qr_type", "venues", type_="check")
    op.drop_column("venues", "no_qr_type")
