"""home curation — seed initial sections

Revision ID: 0023
Revises: 0022
Create Date: 2026-08-10

HOME CURATION. Data-only — no DDL, no table/column changes. Per the
approved architecture audit, `Collection`/`CollectionVenue` (migration
0015) already model everything Home Curation needs (`is_active` for
section enable/disable, `sort_order` for section order and, on
`CollectionVenue`, per-venue order within a section) — this migration
only seeds the three initial named sections as ordinary `Collection`
rows, exactly the same "seed once, no CRUD required to exist" pattern
0014/0015 already established for Tags/Collections themselves.

`sort_order` starts at 7, not 0 — production already has 7 collections
seeded by 0015 (`editors-choice` … `beachfront-dining`, sort_order 0-6,
confirmed by a fresh read-only query immediately before writing this
migration) which are unrelated to Home Curation and must keep their
existing relative order in any generic collections listing (e.g. the
Venue editor's Tags & Collections picker). Home Curation's own Studio
screen only needs correct *relative* order among these three rows, so
continuing the existing sequence rather than colliding with 0-6 is the
only requirement.

Idempotent: uses `INSERT ... ON CONFLICT (id) DO NOTHING`, so re-running
this migration (or it having partially applied before, e.g. via a
`downgrade`/`upgrade` cycle) never raises a duplicate-key error or
overwrites an editor's subsequent changes to these rows.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (id/slug, name, description, sort_order)
SEED_SECTIONS = [
    ("best-beaches", "Best Beaches", "Editorially curated for the Consumer Home page.", 7),
    ("food-picks", "Food Picks", "Editorially curated for the Consumer Home page.", 8),
    ("nightlife", "Nightlife", "Editorially curated for the Consumer Home page.", 9),
]


def upgrade() -> None:
    collections_table = sa.table(
        "collections",
        sa.column("id", sa.Text()),
        sa.column("slug", sa.Text()),
        sa.column("name", sa.Text()),
        sa.column("description", sa.Text()),
        sa.column("is_active", sa.Boolean()),
        sa.column("sort_order", sa.Integer()),
    )
    stmt = sa.dialects.postgresql.insert(collections_table).values(
        [
            {
                "id": id_,
                "slug": id_,
                "name": name,
                "description": description,
                "is_active": True,
                "sort_order": sort_order,
            }
            for id_, name, description, sort_order in SEED_SECTIONS
        ]
    )
    op.execute(stmt.on_conflict_do_nothing(index_elements=["id"]))


def downgrade() -> None:
    ids = tuple(id_ for id_, *_ in SEED_SECTIONS)
    op.execute(sa.text("DELETE FROM collections WHERE id IN :ids").bindparams(sa.bindparam("ids", expanding=True)).params(ids=ids))
