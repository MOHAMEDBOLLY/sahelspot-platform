"""external data enrichment — external_records staging table

Revision ID: 0025
Revises: 0024
Create Date: 2026-08-20

External Data Enrichment Workflow (Phase 1). Adds `external_records` — a
staging/review layer for venue-shaped rows from external research
datasets (iSahel is the first source; nothing here is iSahel-specific —
`source` is a plain free-text column, not a CHECK-constrained vocabulary,
so a future source needs no migration to exist).

Deliberately NOT written onto `Venue`: per the approved "External
Research -> Match -> Human Review -> Field-level Approval -> Apply"
model, external data must stay fully separate from the live `venues`
table until an operator explicitly applies specific fields or creates a
new Venue from a record. `matched_venue_id` is `ON DELETE SET NULL` —
losing the Venue a record was matched to must never delete the research
record itself (mirrors `Event.venue_id`'s own reasoning).

Purely additive — no existing table, column, or row touched.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MATCH_STATUSES = ("MATCH_CONFIRMED", "MATCH_PROBABLE", "REVIEW_REQUIRED", "NO_MATCH")
MATCH_CONFIDENCES = ("HIGH", "MEDIUM", "LOW")
EXTERNAL_REVIEW_STATUSES = (
    "PENDING",
    "IN_REVIEW",
    "APPROVED",
    "PARTIALLY_APPLIED",
    "REJECTED",
    "NEEDS_RESEARCH",
)


def upgrade() -> None:
    op.create_table(
        "external_records",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("external_name", sa.Text(), nullable=False),
        sa.Column("external_category", sa.Text(), nullable=True),
        sa.Column("external_destination", sa.Text(), nullable=True),
        sa.Column("external_description", sa.Text(), nullable=True),
        sa.Column("external_amenities", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("external_maps_url", sa.Text(), nullable=True),
        sa.Column("external_booking_type", sa.Text(), nullable=True),
        sa.Column("external_booking_url", sa.Text(), nullable=True),
        sa.Column("external_image_urls", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("source_review_status", sa.Text(), nullable=True),
        sa.Column("raw_row", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column(
            "matched_venue_id", sa.Text(), sa.ForeignKey("venues.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column(
            "match_status", sa.Text(), nullable=False, server_default=sa.text("'REVIEW_REQUIRED'")
        ),
        sa.Column("match_confidence", sa.Text(), nullable=True),
        sa.Column("review_status", sa.Text(), nullable=False, server_default=sa.text("'PENDING'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(f"match_status IN {MATCH_STATUSES}", name="ck_external_records_match_status"),
        sa.CheckConstraint(
            f"match_confidence IS NULL OR match_confidence IN {MATCH_CONFIDENCES}",
            name="ck_external_records_match_confidence",
        ),
        sa.CheckConstraint(
            f"review_status IN {EXTERNAL_REVIEW_STATUSES}", name="ck_external_records_review_status"
        ),
    )
    op.create_index("ix_external_records_source", "external_records", ["source"])
    op.create_index("ix_external_records_match_status", "external_records", ["match_status"])
    op.create_index("ix_external_records_review_status", "external_records", ["review_status"])
    op.create_index("ix_external_records_matched_venue_id", "external_records", ["matched_venue_id"])


def downgrade() -> None:
    op.drop_index("ix_external_records_matched_venue_id", table_name="external_records")
    op.drop_index("ix_external_records_review_status", table_name="external_records")
    op.drop_index("ix_external_records_match_status", table_name="external_records")
    op.drop_index("ix_external_records_source", table_name="external_records")
    op.drop_table("external_records")
