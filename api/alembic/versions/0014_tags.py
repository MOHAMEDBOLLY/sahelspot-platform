"""tags

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-07

Category/Tags/Access Type/Badges/Collections architecture (Phase 1) — the
Tags layer. `tags` is a real table (not a CHECK-constrained string like
VENUE_CATEGORIES) specifically so adding a new tag later is a data INSERT,
never a migration — see docs review for the full reasoning. `venue_tags` is
the many-to-many join, no payload columns of its own.

Seeded here with the full known vocabulary (approved architecture) — Studio
has no tag CRUD UI in Phase 1, so this migration is the only place these
rows are ever created for now. "Beach Club" (Nightlife) is deliberately
seeded as "Beach Party" — the literal string "Beach Club" already exists as
a `venues.category` value, and reusing it as a tag label would collide.
Quick Bites tags are seeded under category='Restaurant' — Quick Bites is
explicitly not a database category (approved architecture), just Restaurant
venues carrying these tags. "Coffee" in the product spec is category='Cafe'
in the existing VENUE_CATEGORIES vocabulary; "Family" is category='Activity'
(see docs/consumer/... Home category mapping) — both tag sets are seeded
under the real underlying category value, not the product-facing name.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VENUE_CATEGORIES = (
    "Restaurant",
    "Cafe",
    "Hotel",
    "Beach",
    "Nightlife",
    "Shopping",
    "Services",
    "Entertainment",
    "Other",
    "Resort",
    "Spa",
    "Beach Club",
    "Activity",
)

# (slug, label, category, sort_order)
SEED_TAGS = [
    # Restaurant — cuisine
    ("seafood", "Seafood", "Restaurant", 0),
    ("sushi", "Sushi", "Restaurant", 1),
    ("italian", "Italian", "Restaurant", 2),
    ("grill", "Grill", "Restaurant", 3),
    ("mandi-kabsa", "Mandi & Kabsa", "Restaurant", 4),
    # Restaurant — Quick Bites (not a category; Restaurant venues carrying these tags)
    ("burgers", "Burgers", "Restaurant", 10),
    ("pizza", "Pizza", "Restaurant", 11),
    ("sandwiches", "Sandwiches", "Restaurant", 12),
    ("fast-food", "Fast Food", "Restaurant", 13),
    # Coffee (category='Cafe')
    ("specialty-coffee", "Specialty Coffee", "Cafe", 0),
    ("coffee-shop", "Coffee Shop", "Cafe", 1),
    ("shisha", "Shisha", "Cafe", 2),
    ("desserts", "Desserts", "Cafe", 3),
    # Shopping
    ("fashion", "Fashion", "Shopping", 0),
    ("beauty", "Beauty", "Shopping", 1),
    ("bazaar", "Bazaar", "Shopping", 2),
    ("beach-essentials", "Beach Essentials", "Shopping", 3),
    ("supermarket", "Supermarket", "Shopping", 4),
    ("home-decor", "Home & Decor", "Shopping", 5),
    # Family (category='Activity')
    ("kids-area", "Kids Area", "Activity", 0),
    ("kids-activities", "Kids Activities", "Activity", 1),
    ("pool", "Pool", "Activity", 2),
    ("aqua-park", "Aqua Park", "Activity", 3),
    ("play-area", "Play Area", "Activity", 4),
    # Nightlife — "Beach Club" renamed to "Beach Party" to avoid colliding
    # with the existing venues.category value of the same name.
    ("dj", "DJ", "Nightlife", 0),
    ("lounge", "Lounge", "Nightlife", 1),
    ("night-club", "Night Club", "Nightlife", 2),
    ("beach-party", "Beach Party", "Nightlife", 3),
]


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.CheckConstraint(f"category IN {VENUE_CATEGORIES}", name="ck_tags_category"),
        sa.UniqueConstraint("slug", name="uq_tags_slug"),
    )
    op.create_index("ix_tags_category", "tags", ["category"])

    op.create_table(
        "venue_tags",
        sa.Column("venue_id", sa.Text(), sa.ForeignKey("venues.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id", ondelete="RESTRICT"), primary_key=True),
    )
    op.create_index("ix_venue_tags_tag_id", "venue_tags", ["tag_id"])

    tags_table = sa.table(
        "tags",
        sa.column("slug", sa.Text()),
        sa.column("label", sa.Text()),
        sa.column("category", sa.Text()),
        sa.column("sort_order", sa.Integer()),
    )
    op.bulk_insert(
        tags_table,
        [
            {"slug": slug, "label": label, "category": category, "sort_order": sort_order}
            for slug, label, category, sort_order in SEED_TAGS
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_venue_tags_tag_id", table_name="venue_tags")
    op.drop_table("venue_tags")
    op.drop_index("ix_tags_category", table_name="tags")
    op.drop_table("tags")
