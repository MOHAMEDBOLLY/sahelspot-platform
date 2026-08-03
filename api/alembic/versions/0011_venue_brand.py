"""venue brand

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-03

Brand Asset Propagation for Venue Covers — the smallest possible schema
addition: a single nullable `venues.brand` text column, no new table.
Brand names are open-ended free text (unlike VENUE_CATEGORIES/
CONTENT_STATUSES/DESTINATION_REGIONS' small fixed vocabularies), so this
deliberately isn't a CHECK-constrained enum or a lookup table — same
"promote to a table only past a real trigger" reasoning `DESTINATION_
REGIONS` already documents, not applied speculatively here. Grouping
("every venue in the same brand") is done purely by matching this text
value; indexed since that grouping query is now a real, user-triggered
read path (the cover-propagation prompt's sibling count, and the
propagation update itself).
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("venues", sa.Column("brand", sa.Text(), nullable=True))
    op.create_index("ix_venues_brand", "venues", ["brand"])


def downgrade() -> None:
    op.drop_index("ix_venues_brand", table_name="venues")
    op.drop_column("venues", "brand")
