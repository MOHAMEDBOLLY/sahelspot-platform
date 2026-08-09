"""re-scope Supermarket tag from Shopping to Services

Revision ID: 0021
Revises: 0020
Create Date: 2026-08-09

STUDIO — FINAL MIGRATION BUNDLE. Product decision: Essentials is a
Consumer umbrella spanning more than one backend category, not a new
backend category itself. Within that umbrella, `Supermarket` belongs in
`Services` scope alongside Pharmacy/Clinics/Veterinary/Car Services
(added in 0020) — matching where the real supermarket-like venues
(7MART, Sokkar Market, Zahran Market — 8 venues total, confirmed by a
fresh read-only inventory) are actually filed, none of which currently
carry this tag.

A plain `category` column UPDATE, not a drop/recreate: `tags.id` and
`tags.slug` ('supermarket') are both preserved untouched, so this is not
a new tag and no `venue_tags` row is touched or needs to be. Nothing in
the schema ties `tags.category` to `venue_tags` row membership — only
the application layer (`validate_tag_ids`, api/app/validation/venues.py)
checks a tag's category against a venue's category, and only at write
time — so this scope change is mechanically safe with zero rows at risk
of violating any constraint.

Known consequence, confirmed by the same inventory and deliberately left
alone per product decision: the tag's one existing assignment is to
`v00488` ("7MART The Alley"), which is itself `category = 'Shopping'` —
not one of the Services-category supermarket venues above. After this
migration, that assignment becomes a legacy mismatch: the row is
untouched and still counts toward the tag's assignment total, but
Studio's tag picker (`useTags(venue.category)`) will no longer offer
"Supermarket" for that Shopping-category venue, and re-submitting its
tag list unchanged would now fail `validate_tag_ids`. This migration
does not recategorize `v00488` or alter its `venue_tags` row — that is
an explicit, separate decision left to a future task, not assumed here.

NOT APPLIED as of this commit — prepared for review per this task's
explicit "do not apply any migration to production" instruction.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text("UPDATE tags SET category = 'Services' WHERE slug = 'supermarket' AND category = 'Shopping'")
    )


def downgrade() -> None:
    op.execute(
        sa.text("UPDATE tags SET category = 'Shopping' WHERE slug = 'supermarket' AND category = 'Services'")
    )
