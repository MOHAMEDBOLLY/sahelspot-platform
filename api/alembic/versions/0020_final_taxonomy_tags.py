"""final taxonomy — new tags + Coffee Shop/Grill label normalization

Revision ID: 0020
Revises: 0019
Create Date: 2026-08-09

STUDIO — FINAL TAG ROLLOUT. Same "tags are a real table specifically so
adding one is a data insert, never a migration" architecture 0014_tags.py
established — this migration is itself just the data-insert/data-update
mechanism, consistent with how 0014 originally seeded the vocabulary
(Studio has no tag CRUD UI in Phase 1).

Additions (all genuinely missing from the final taxonomy, confirmed
against a fresh read-only production inventory immediately before writing
this migration):
  - Bakery (Cafe) — Coffee's tag set.
  - Feteer (Restaurant) — Quick Bites' tag set (Restaurant-scoped, same
    "Quick Bites is not a category" reasoning 0014 already gives Fast
    Food/Pizza/Burgers/Sandwiches).
  - Fine Dining (Restaurant) — a restaurant type/tag only, deliberately
    NOT linked to `reservation_policy` (that stays an independent field,
    per product decision — a Fine Dining venue may have no reservation
    policy, Recommended, or Required).
  - Pharmacy, Clinics, Veterinary, Car Services (Services) — scoped to
    'Services', NOT 'Shopping' like the existing Essentials tags
    (Fashion/Beauty/Beach Essentials/Supermarket/Home & Decor): a fresh
    inventory found the real venues these tags describe (El Ezaby
    Pharmacy, Espitalia Clinics, 7MART, Sokkar Market, Zahran Market) are
    all filed under category='Services', not 'Shopping'. Scoping to
    'Shopping' (matching the existing Essentials tags' precedent) would
    make these tags permanently unassignable to their real target venues
    — the same latent defect the existing 'Supermarket' tag already has.
    Confirmed with product owner before writing this migration; the
    pre-existing Shopping-scoped Essentials tags are left exactly as they
    are — reconciling those is explicitly out of scope for this task.

  "Clinics" is a new tag, not a rename — no 'Medical' tag exists anywhere
  in production today (confirmed by the same fresh inventory), so there
  was nothing to rename.

Label normalization (neither is a new row nor a slug change —
`venue_tags` references `tag_id`, so this changes nothing any existing
assignment depends on):
  - tag id 11 (slug 'coffee-shop'): label 'Coffee Shop' -> 'Cafe Shop'.
    The 1 existing assignment to this tag is completely unaffected — same
    row, same id, same slug, only the human-readable label changes.
  - tag id 4 (slug 'grill'): label 'Grill' -> 'Grill & BBQ'. Added in the
    STUDIO — FINAL V1 TAXONOMY CORRECTION pass, folded into this same
    migration rather than a separate one specifically because 0020 had
    not been applied anywhere (confirmed against production, still at
    revision 0017) at the time of this correction — the smallest clean
    fix per that task's own "safely correct before release" guidance,
    not a rewrite of already-shipped history. The 3 existing assignments
    to this tag are completely unaffected — same row, same id, same
    slug, only the label changes.

Explicitly NOT done here, per product decision: no merge of Fashion/
Beauty, no Events tags (Bazaar/Festivals/Concerts/Exhibitions — Events
has no tag system and is out of scope for this task), no No QR tag or
model change, no venue_tags assignments (creating a tag and assigning it
are separate operations — this migration only creates the vocabulary).
Italian and Bazaar are untouched by this migration — both remain exactly
as they are, simply outside the final V1 Home taxonomy grouping (a
Consumer-side concept, not enforced here).

NOT APPLIED as of this commit — prepared for review per this task's
explicit "stop before applying any migration/data write" instruction.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (slug, label, category, sort_order)
NEW_TAGS = [
    ("bakery", "Bakery", "Cafe", 4),
    ("feteer", "Feteer", "Restaurant", 14),
    ("fine-dining", "Fine Dining", "Restaurant", 5),
    ("pharmacy", "Pharmacy", "Services", 0),
    ("clinics", "Clinics", "Services", 1),
    ("veterinary", "Veterinary", "Services", 2),
    ("car-services", "Car Services", "Services", 3),
]


def upgrade() -> None:
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
            for slug, label, category, sort_order in NEW_TAGS
        ],
    )

    op.execute(
        sa.text("UPDATE tags SET label = 'Cafe Shop' WHERE slug = 'coffee-shop' AND label = 'Coffee Shop'")
    )
    op.execute(
        sa.text("UPDATE tags SET label = 'Grill & BBQ' WHERE slug = 'grill' AND label = 'Grill'")
    )


def downgrade() -> None:
    op.execute(
        sa.text("UPDATE tags SET label = 'Grill' WHERE slug = 'grill' AND label = 'Grill & BBQ'")
    )
    op.execute(
        sa.text("UPDATE tags SET label = 'Coffee Shop' WHERE slug = 'coffee-shop' AND label = 'Cafe Shop'")
    )
    op.execute(
        sa.text(
            "DELETE FROM tags WHERE slug IN "
            "('bakery', 'feteer', 'fine-dining', 'pharmacy', 'clinics', 'veterinary', 'car-services')"
        )
    )
