"""external data enrichment — external_destination_mappings

Revision ID: 0026
Revises: 0025
Create Date: 2026-08-20

External Data Enrichment Workflow (Phase 1) — an explicit destination-
mapping layer, e.g. iSahel's "El Alamein" -> Studio's "New Alamein".
Deliberately NOT fuzzy matching: this table only ever gets a row from an
explicit operator action (`POST /editor/external-destination-mappings`);
nothing computes or infers a mapping automatically. `(source,
external_destination)` is unique — one deterministic mapping per
source's spelling of a place. Purely additive; no existing table,
column, or row touched. No rows are seeded by this migration itself —
even the "El Alamein" -> "New Alamein" example from the approved plan is
created through the API as an explicit operator action, not baked into
a migration, so every mapping that ever exists is visible in the same
place an operator would look to add one.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "external_destination_mappings",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("external_destination", sa.Text(), nullable=False),
        sa.Column(
            "studio_destination_id",
            sa.Text(),
            sa.ForeignKey("destinations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint(
            "source", "external_destination", name="uq_external_destination_mappings_source_external"
        ),
    )


def downgrade() -> None:
    op.drop_table("external_destination_mappings")
