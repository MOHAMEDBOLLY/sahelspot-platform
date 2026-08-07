"""collections

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-07

Category/Tags/Access Type/Badges/Collections architecture (Phase 1) — the
Collections layer. `collections` is a real, editorially-owned table (id is
the slug, matching Destination's own "primary key is the slug" convention);
`collection_venues` is the many-to-many join, with a `sort_order` column
(unlike `venue_tags`) since collection membership is a curated, ordered
list, not an unordered set.

Seeded with the initial collection set per the approved plan — Studio has
no Collections management UI in Phase 1 (assignment-only), so these rows
are the only collections that exist until that UI ships. "No QR" is
deliberately NOT seeded here — it's a computed discovery query
(GET /public/discover/no-qr), never a stored collection.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (id/slug, name, description, sort_order)
SEED_COLLECTIONS = [
    ("editors-choice", "Editor's Choice", "Hand-picked places our editors love.", 0),
    ("trending", "Trending", "What's popular on the North Coast right now.", 1),
    ("summer-picks", "Summer Picks", "Warm-weather favorites.", 2),
    ("hidden-gems", "Hidden Gems", "Lesser-known spots worth the detour.", 3),
    ("best-sunset", "Best Sunset", "The best places to watch the sun go down.", 4),
    ("family-favorites", "Family Favorites", "Great for a day out with kids.", 5),
    ("beachfront-dining", "Beachfront Dining", "Restaurants and cafes right on the sand.", 6),
]


def upgrade() -> None:
    op.create_table(
        "collections",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("slug", name="uq_collections_slug"),
    )

    op.create_table(
        "collection_venues",
        sa.Column(
            "collection_id", sa.Text(), sa.ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("venue_id", sa.Text(), sa.ForeignKey("venues.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index("ix_collection_venues_venue_id", "collection_venues", ["venue_id"])

    collections_table = sa.table(
        "collections",
        sa.column("id", sa.Text()),
        sa.column("slug", sa.Text()),
        sa.column("name", sa.Text()),
        sa.column("description", sa.Text()),
        sa.column("sort_order", sa.Integer()),
    )
    op.bulk_insert(
        collections_table,
        [
            {"id": slug, "slug": slug, "name": name, "description": description, "sort_order": sort_order}
            for slug, name, description, sort_order in SEED_COLLECTIONS
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_collection_venues_venue_id", table_name="collection_venues")
    op.drop_table("collection_venues")
    op.drop_table("collections")
