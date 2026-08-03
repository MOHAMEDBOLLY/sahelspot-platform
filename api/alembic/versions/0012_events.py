"""events

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-03

Events Module v1 — the first new entity since the initial schema. Same
shape as `venues`/`destinations`: `status` shares `CONTENT_STATUSES` (the
same CHECK-constrained vocabulary, not a new one), `version` for the same
optimistic-concurrency protocol, `created_at`/`updated_at` the same
server-defaulted timestamps.

`venue_id`/`destination_id` are both nullable — an event may stand alone,
belong to a specific venue, or be associated with a destination in
general — and `ON DELETE SET NULL`, not `RESTRICT`: deleting a venue or
destination must never be blocked by an unrelated event referencing it,
and an event outliving its venue/destination link is a real, intended
state (the event still happened; the FK link is a convenience, not an
ownership relationship the way `venues.destination_id` is).

`slug` is unique per-table (not scoped to venue/destination the way
`venues.slug` is scoped to `destination_id` — events have no natural
grouping parent the way venues always belong to exactly one destination).

Intentionally excluded per Events v1 scope: recurring-event fields,
artist fields, ticket-sync fields, pricing fields, festival fields. See
`app/db/models.py`'s `Event` docstring for the same list.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CONTENT_STATUSES = ("draft", "review", "approved", "archived")


def upgrade() -> None:
    op.create_table(
        "events",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("cover_image_url", sa.Text(), nullable=True),
        sa.Column("short_description", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("venue_id", sa.Text(), nullable=True),
        sa.Column("destination_id", sa.Text(), nullable=True),
        sa.Column("featured", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("ticket_provider", sa.Text(), nullable=True),
        sa.Column("ticket_url", sa.Text(), nullable=True),
        sa.Column("external_event_id", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("last_published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_events_slug"),
        sa.CheckConstraint(f"status IN {CONTENT_STATUSES}", name="ck_events_status"),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["destination_id"], ["destinations.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_events_status", "events", ["status"])
    op.create_index("ix_events_venue_id", "events", ["venue_id"])
    op.create_index("ix_events_destination_id", "events", ["destination_id"])
    op.create_index("ix_events_featured", "events", ["featured"])
    op.create_index("ix_events_start_date", "events", ["start_date"])


def downgrade() -> None:
    op.drop_index("ix_events_start_date", table_name="events")
    op.drop_index("ix_events_featured", table_name="events")
    op.drop_index("ix_events_destination_id", table_name="events")
    op.drop_index("ix_events_venue_id", table_name="events")
    op.drop_index("ix_events_status", table_name="events")
    op.drop_table("events")
