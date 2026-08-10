"""No QR independent entity — no_qr_areas, no_qr_places

Revision ID: 0022
Revises: 0021
Create Date: 2026-08-10

STUDIO — NO QR INDEPENDENT ENTITY (Phase 1). Replaces the Phase 0
approach (`Venue.is_no_qr`/`parent_venue_id`/`no_qr_type`, migrations
0017/0019) with two real entities: a Walk/Mall is not a Venue — it's a
named container (`no_qr_areas`) holding places (`no_qr_places`), each of
which is either a reference to an existing Venue or a standalone place
with its own name that doesn't exist in the Venue database.

`no_qr_areas.id`/`no_qr_places.id` are plain auto-increment integers
(`Identity(always=True)`), not caller-supplied text ids like Venue/Event/
Destination — those all have an id *field* in their creation form; the
approved "Add Walk"/"Add Mall" UX asks for a name only. Same shape as
`tags.id` for exactly that reason.

`no_qr_places` enforces "exactly one of venue_id/name" via
`ck_no_qr_places_identity` — mirrors `ck_events_has_location`'s "at least
one of two nullable fields" shape, tightened to exactly one here (a
linked place's name always comes from the Venue, never both).
`venue_id` is `ON DELETE SET NULL` (matches `Event.venue_id`'s own
reasoning), but `api/app/api/routes/venues.py::delete_venue` pre-checks
and blocks deletion with a 409 if it would leave a place with `name`
still NULL and no venue — the same "clear 409, not a raw IntegrityError"
pattern already used there for Event. `uq_no_qr_places_area_venue`
(a partial unique index, `venue_id IS NOT NULL` only) prevents the same
Venue being added twice to the same Area.

Legacy `Venue.is_no_qr`/`parent_venue_id`/`no_qr_type` columns are
deliberately NOT touched or dropped here — production has zero rows
using them (confirmed by inventory), so there is nothing to migrate, but
removing them is a separate Phase 2 decision, not bundled into this
additive migration.

This migration is additive only — no existing table, column, or
constraint is modified.

NOT APPLIED as of this commit — prepared for review per this task's
explicit "do not apply any migration to production" instruction.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NO_QR_AREA_TYPES = ("Walk", "Mall")


def upgrade() -> None:
    op.create_table(
        "no_qr_areas",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(f"type IN {NO_QR_AREA_TYPES}", name="ck_no_qr_areas_type"),
        sa.CheckConstraint("length(btrim(name)) > 0", name="ck_no_qr_areas_name_not_blank"),
    )

    op.create_table(
        "no_qr_places",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("area_id", sa.Integer(), sa.ForeignKey("no_qr_areas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("venue_id", sa.Text(), sa.ForeignKey("venues.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(venue_id IS NOT NULL AND name IS NULL) OR (venue_id IS NULL AND name IS NOT NULL)",
            name="ck_no_qr_places_identity",
        ),
        sa.CheckConstraint("name IS NULL OR length(btrim(name)) > 0", name="ck_no_qr_places_name_not_blank"),
    )
    op.create_index("ix_no_qr_places_area_id", "no_qr_places", ["area_id"])
    op.create_index("ix_no_qr_places_venue_id", "no_qr_places", ["venue_id"])
    op.create_index(
        "uq_no_qr_places_area_venue",
        "no_qr_places",
        ["area_id", "venue_id"],
        unique=True,
        postgresql_where=sa.text("venue_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_no_qr_places_area_venue", table_name="no_qr_places")
    op.drop_index("ix_no_qr_places_venue_id", table_name="no_qr_places")
    op.drop_index("ix_no_qr_places_area_id", table_name="no_qr_places")
    op.drop_table("no_qr_places")
    op.drop_table("no_qr_areas")
