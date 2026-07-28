"""required indexes

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-28

PLATFORM_SPEC_v1.0_FROZEN.md §3.1 — every index the frozen spec names:
destination-scoped venue lookups, category/status filters, the composite
index serving the referential-closure publish query (§1 of the frozen
spec), revision-history ordering, and a trigram index backing the existing
substring (`ILIKE '%...%'`) venue-name search.

`ix_venues_destination_id` is deliberately not created here — it already
exists (0001_initial_schema.py, on the FK column) and is confirmed present
before this migration runs.

Plain, non-concurrent index creation — acceptable at current (near-empty)
production data volume. Phase 7 (Production Readiness, EP35) is
responsible for re-running any of these with `CREATE INDEX CONCURRENTLY`
if they are ever rebuilt against a live table with real write traffic.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_venues_category", "venues", ["category"])
    op.create_index("ix_venues_status", "venues", ["status"])
    op.create_index(
        "ix_venues_destination_id_status", "venues", ["destination_id", "status"]
    )
    op.create_index("ix_destinations_status", "destinations", ["status"])
    op.create_index(
        "ix_publish_revisions_published_at", "publish_revisions", ["published_at"]
    )

    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX ix_venues_name_trgm ON venues "
        "USING gin (lower(name) gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_venues_name_trgm")
    # pg_trgm extension is deliberately left in place on downgrade — other
    # objects/sessions may depend on it, and CREATE EXTENSION IF NOT EXISTS
    # is idempotent, so removing it isn't necessary for a clean downgrade.
    op.drop_index("ix_publish_revisions_published_at", table_name="publish_revisions")
    op.drop_index("ix_destinations_status", table_name="destinations")
    op.drop_index("ix_venues_destination_id_status", table_name="venues")
    op.drop_index("ix_venues_status", table_name="venues")
    op.drop_index("ix_venues_category", table_name="venues")
