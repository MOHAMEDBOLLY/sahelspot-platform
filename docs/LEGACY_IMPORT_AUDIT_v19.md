# Legacy Dataset Import Audit — `production_dataset_v19.json`

**Type:** Audit only. No code, schema, or data was modified or written.
**Source file:** `/Users/Nabil/Desktop/production_dataset_v19.json` (516,571 bytes)
**Cross-checked against:** the running backend (`api/app/db/models.py`,
`api/app/api/schemas.py`, `api/app/validation/*.py`), the production
database's current state (verified directly), and this project's own
prior `docs/SCHEMA_GAP_AUDIT.md` (2026-07-28, pre-Phase-1).

**Headline finding, up front:** the prior schema-gap audit's single
blocking issue — a category-taxonomy collision affecting 107 of 426
venues — **is already resolved.** Phase 1 extended `VENUE_CATEGORIES`
from 9 to 13 values specifically to close this gap, and every one of
the legacy dataset's 11 categories now maps cleanly (two need a trivial
string transform, none are unmappable). The remaining blocker is
narrower and different in kind: `destinations.region` is `NOT NULL`
and `CHECK`-constrained to 8 specific values, and 0 of 25 legacy
destinations carry a `region` value at all. That gap is now a **data**
problem (25 values need to be supplied/mapped) rather than a **schema**
problem — no schema change is needed to unblock it, a decision is.

A note on the filename: no file named exactly `production_dataset_v19.json`
existed in the repository when this audit began. This project's `exports/`
directory holds an earlier, separately-taken export (520 venues, no `geo`
field, taken 2026-07-28) that is a *different* snapshot — not this file.
The user then supplied the actual file from `~/Desktop/`. This audit is
against that supplied file exclusively; the `exports/` snapshot is
mentioned only where it usefully corroborates or contradicts a finding.

---

# 1. Dataset Structure

Single JSON object, not an array — four top-level keys.

```
{
  "_meta": { ... },
  "venues": [ ... ],
  "destinations": [ ... ],
  "beaches": [ ... ]
}
```

## `_meta` (object, 11 fields)

```json
{
  "type": "sahelspot_production_dataset",
  "schemaVersion": 1,
  "generatorVersion": "2026.06.23",
  "version": 20,
  "publishedAt": "2026-07-29T01:29:54.484Z",
  "publishedBy": "DataLab Review Workspace",
  "workspaceId": "ws_1782182578319",
  "buildProfile": null,
  "changelog": null,
  "gitCommit": null,
  "counts": {"venues": 426, "destinations": 25, "beaches": 187, "hidden": 1, "geoExcluded": 24}
}
```

Two things worth flagging:
- **`_meta.version` is `20`, not `19`** — the filename and the content
  disagree by one. Not a blocker, but worth confirming with whoever
  generated this file that `v19.json` containing a `version: 20` payload
  is expected (a re-export under the old filename, most likely) rather
  than the wrong file being attached.
- **`counts.hidden: 1` and `counts.geoExcluded: 24`** — this file's 426
  venues are *already filtered*. 24 venues that exist in the source
  workspace were excluded here because of a `geo` review outcome, and 1
  is marked hidden. This import audit covers exactly the 426 venues
  present in this file — the 24 geo-excluded and 1 hidden venue are **not
  in this file at all** and are out of scope unless a separate, complete
  export is requested.

## `venues` — 426 records

- **Primary identifier:** `id` (e.g. `"v00033"`) — globally unique across
  all 426 (verified: 0 duplicates). A secondary `vslug` also exists,
  unique within `(destSlug, vslug)` (verified: 0 duplicate pairs).
- **Relationships:** `destSlug` → `destinations[].slug` (verified: all
  426 resolve, 0 orphans, spanning 10 of the 25 destination slugs).
  `destination` (display name) is a redundant, occasionally-drifted copy
  of the same relationship — `destSlug` is the trustworthy side (see §4).

## `destinations` — 25 records

- **Primary identifier:** `slug` (e.g. `"marassi"`) — this becomes the
  new schema's `id` directly (destinations have no separate surrogate
  key in the new schema; `slug` *is* the primary key there).
- **Relationships:** referenced by `venues[].destSlug` and (loosely, by
  display name only) `beaches[].destination`.
- Only 10 of 25 destinations have any venues attached in this file; the
  other 15 have `venueCount: 0` and no matching `destSlug` values in
  `venues` (verified — declared `venueCount` sums to 426, matches actual
  per-destination counts exactly, no staleness in this snapshot).

## `beaches` — 187 records

- **Primary identifier:** none. No `id`, no `slug`. Beaches are
  identified only by `name` (free text, not verified unique — see §4).
- **Relationships:** `destination` (free-text name, not a slug) → loosely
  matches `destinations[].name`. 79 of 187 (42%) do not resolve — see §4.
- No coordinates (`lat`/`lng` absent from every beach record).

---

# 2. Field Mapping

## 2.1 Venue → `venues` table / `VenueCreate` schema

| Legacy field | New DB field | Status |
|---|---|---|
| `id` | `venues.id` (PK) | **Direct mapping** — but see §4: collision policy needed if re-running |
| `vslug` | `venues.slug` | **Direct mapping** — unique within `(destination_id, slug)`, already satisfied |
| `name` | `venues.name` | **Direct mapping** |
| `destSlug` | `venues.destination_id` (FK) | **Direct mapping**, resolve by slug |
| `destination` | — | **Ignored** — redundant display-name copy of `destSlug`; the FK join derives it |
| `district` | `venues.district` | **Direct mapping** (136/426 populated) |
| `category` | `venues.category` (CHECK, 13 values) | **Needs transformation** — `Café`→`Cafe`, `Service`→`Services`; all 9 others are already exact matches (see §2.4) |
| `lat` / `lng` | `venues.latitude` / `venues.longitude` (`Numeric(9,6)`) | **Direct mapping** — legacy values already at 6 decimal places, no precision loss |
| `shortDesc` | `venues.short_description` | **Direct mapping** (100/426 populated) |
| `rating` | — | **Missing destination** — no column exists; 0/426 populated in this file anyway, so zero practical loss |
| `reviews` | — | **Missing destination** — same; 0/426 populated |
| `mapsUrl` | `venues.maps_url` | **Direct mapping** (426/426 populated, all well-formed `https://` URLs) |
| `website` | `venues.website` | **Direct mapping** (227/426 populated, all well-formed) |
| `externalLink` | — | **Missing destination** — no column; only 1/426 populated, negligible loss. Could fold into `website` if that one record's caller wants it, but that's a judgment call, not automatic |
| `instagram` | `venues.instagram_handle` | **Direct mapping** (116/426, already bare handles — no `http`/`/` in any value) |
| `facebook` | `venues.facebook_handle` | **Needs transformation** — all 39/39 populated values are full `https://www.facebook.com/...` URLs, not bare handles, despite the column being named `_handle`. Decide: strip to handle, or accept full-URL values as-is (schema has no format `CHECK`, so it *will* accept either without error) |
| `tiktok` | `venues.tiktok_handle` | **Needs transformation** — same issue, all 3/3 are full `https://www.tiktok.com/@...` URLs |
| `phone` | `venues.phone` | **Direct mapping** (298/426) |
| `whatsapp` | `venues.whatsapp` | **Direct mapping** (50/426) |
| `coverUrl` | `venues.cover_image_url` | **Needs transformation** — 13/426 populated, but every value is a legacy on-disk path (`/media/venues/.../cover.webp`), not a resolvable public URL. Cannot be copied verbatim — see §4 |
| `gallery` | `venues.gallery_image_urls` | **Ignored (empty)** — 0/426 have any gallery entries in this file; column exists and would accept them if any were populated |
| `geo` (object: `status`, `reviewed`, `reviewedAt`, `reviewedBy`, `distanceFromBoundaryKm`, `history[]`, `suggestion`) | `venues.legacy_geo` (JSONB) | **Direct mapping, verbatim** — this column exists *specifically* for this (Phase 1, per its own code comment: *"preserves the legacy geo-review object ... verbatim at migration time"*). Store the whole object as-is; it's opaque, never validated, never API-exposed. All 426/426 records have this populated (50 `reviewed: true`) |
| — | `venues.status` | **New, no source** — policy: import as `draft` (matches this project's own prior recommendation and its "publish is an explicit human decision" architecture) |
| — | `venues.is_featured`, `is_verified` | **New, no source** — default `false` |
| — | `venues.opening_hours` | **New, no source** — leave `null` |
| — | `venues.beach_details` | **N/A for this collection** — only relevant to `category='Beach'` venues, which don't exist in the `venues` array (see §2.3) |
| — | `venues.internal_notes`, `source` | **New, no source** — `source` could reasonably be set to a fixed literal (e.g. `"legacy-import-v19"`) for provenance; that's a one-line policy decision, not a code change |
| — | `venues.translations` | **N/A** — no non-English name/field data exists anywhere in this dataset structure to populate it from |
| — | `venues.version`, `last_published_at`, `created_at`, `updated_at` | **Managed by the database** — not supplied |

## 2.2 Destination → `destinations` table / `DestinationCreate` schema

| Legacy field | New DB field | Status |
|---|---|---|
| `id` (`dest00009`) | — | **Ignored** — the new schema has no separate destination surrogate key; `slug` becomes the PK directly |
| `slug` | `destinations.id` (PK) | **Direct mapping** |
| `name` | `destinations.name` | **Direct mapping** |
| `region` | `destinations.region` (`NOT NULL`, `CHECK` 8 values) | **Missing destination, blocking** — 0/25 populated in the source; the target column requires one of exactly 8 values. See §5/§7 |
| `shortDesc` | `destinations.notes` or new `short_description`? | **Missing destination** — `destinations` has no `short_description` column (only `venues` does); nearest analog is the free-text `notes` field. 0/25 populated anyway, so zero practical loss either way |
| `coverUrl` | `destinations.cover_image_url` | **Direct mapping** — but 0/25 populated in this file, so nothing to import |
| `boundary` | `destinations.boundary` (JSONB) | **Direct mapping, verbatim** — GeoJSON `Polygon`/`MultiPolygon`, matches the shape the backend's own `_validate_boundary_shape()` already checks for. 10/25 populated |
| `venueCount`, `verifiedCount`, `categoryBreakdown` | — | **Ignored (by design)** — all three are derived/computed on read by `GET /editor/destinations/{id}/stats`; the new schema deliberately has no stored columns for them |
| — | `destinations.status` | **New, no source** — policy: `draft`, **except** `marassi`, which already exists in production as `approved` (see §5 — do not downgrade it) |
| — | `destinations.aliases` | **New, no source** — column exists, unused by this dataset; available if a future registry-style import supplies alternate names |

## 2.3 Beach → no direct table (folded into `venues` per existing architecture)

| Legacy field | New DB field | Status |
|---|---|---|
| `name` | `venues.name` (if imported as a `category='Beach'` venue) | **Needs transformation** — requires synthesizing an `id` and `slug`, which the source doesn't provide (see §4) |
| `area` | `venues.district` | **Needs transformation** — semantically close, not identical |
| `destination` | `venues.destination_id` | **Needs transformation** — free-text name, not a slug; 79/187 (42%) don't resolve to any destination at all (see §4) |
| `type` | `venues.beach_details.type` | **Missing destination in practice** — column/JSON key exists and is now writable (Phase 2 added `beach_details` to `VenueUpdate`), but 0/187 beach records have this populated in the source |
| `publicAccess` | `venues.beach_details.publicAccess` | **Needs transformation** — 187/187 populated, but the value set doesn't line up 1:1: source uses `unknown` (139), `no` (41), `yes` (7); the backend's `BEACH_PUBLIC_ACCESS_VALUES` is exactly `("yes", "no", "unknown")` — **this one actually matches exactly**, no transform needed for the *value*, only for getting the record into `venues` shape at all |
| — | `venues.id`, `slug`, `latitude`, `longitude` | **Cannot be imported — no source data.** No ID, no slug, no coordinates anywhere in the 187 beach records. Fabricating a primary key for content that will be publicly displayed and permanently addressable (`/venues/{id}`) is a product decision, not a data-mapping one |

## 2.4 Category value mapping (full detail)

| Legacy value | Count | New value | Status |
|---|---|---|---|
| `Restaurant` | 174 | `Restaurant` | Direct |
| `Café` | 52 | `Cafe` | Needs transformation (strip accent) |
| `Activity` | 38 | `Activity` | Direct — **was unmappable before Phase 1; now direct** |
| `Shopping` | 34 | `Shopping` | Direct |
| `Hotel` | 28 | `Hotel` | Direct |
| `Spa` | 28 | `Spa` | Direct — **was unmappable before Phase 1; now direct** |
| `Beach Club` | 21 | `Beach Club` | Direct (exact string match, including the space) — **was unmappable before Phase 1; now direct** |
| `Service` | 20 | `Services` | Needs transformation (pluralize) |
| `Resort` | 20 | `Resort` | Direct — **was unmappable before Phase 1; now direct** |
| `Nightlife` | 9 | `Nightlife` | Direct |
| `Other` | 2 | `Other` | Direct |

**All 426 venues have a legal destination category.** Zero unmappable
records — this is the single biggest change from the prior audit's
findings, and it's already true today, not something this import needs
to fix.

---

# 3. Relationship Mapping

- **Destinations:** `destinations[].slug` → `destinations.id` directly.
  One identity collision to handle: `marassi` already exists in
  production (see §5).
- **Venues:** `venues[].destSlug` → resolve to the already-imported
  destination's `id` (same string, since slug becomes id) → set as
  `venues.destination_id`. Clean: 0 orphans, all 426 resolve. **Venues
  must be imported strictly after destinations** — the FK is `NOT NULL`
  with `ON DELETE RESTRICT`, so a venue cannot reference a destination
  that doesn't exist yet.
- **Beaches:** no clean relationship exists to map through. `destination`
  is a free-text name match against `destinations[].name`, and 42% don't
  resolve at all (three regional names — `Sidi Abdelrahman`, `Fouka`,
  `Ras El Hekma` — that don't correspond to any single destination, they
  span *multiple* destinations each). Even where it does resolve, there's
  no ID/slug/coordinate to construct a venue row from. **Recommendation
  unchanged from the prior audit: defer beach import entirely** until (a)
  the 3 unresolvable regional names are given an explicit destination
  mapping (a business decision, not inferable), and (b) a policy exists
  for synthesizing beach IDs/slugs safely.
- **Gallery:** `venues[].gallery` (`text[]`) maps directly to
  `venues.gallery_image_urls` (`ARRAY(Text)`) — same shape. Moot for this
  file (0/426 populated), but the mapping itself needs no transformation
  if a fuller export ever has gallery data.
- **Covers:** `venues[].coverUrl` / `destinations[].coverUrl` do **not**
  map directly to `cover_image_url` — see §4. They're legacy on-disk
  paths (`/media/venues/...`), not resolvable public URLs. The new
  schema's `cover_image_url` is populated exclusively via the real
  upload endpoints (`POST .../media`), which upload bytes to Supabase
  Storage and return a public URL. There is no code path (and this audit
  was told not to design one) for "adopt an existing external URL
  string" versus "re-upload the actual image bytes."
- **Social links:** `instagram`/`phone`/`whatsapp` map directly.
  `facebook`/`tiktok` map to columns but carry full URLs where the
  column name implies bare handles — see §2.1. No format `CHECK` exists
  on any of these columns today, so nothing *rejects* a full-URL value;
  it's a data-cleanliness decision, not a technical blocker.
- **Geo metadata:** `venues[].geo` → `venues.legacy_geo`, verbatim,
  whole-object, no transformation, no interpretation. This is exactly
  what that column was added for (Phase 1, `docs/PLATFORM_SPEC_v1.0_FROZEN.md`
  §7.13) and it is not editable, not validated, and not exposed via any
  API response — a pure preservation column.

---

# 4. Import Risks

| Risk | Scope | Detail |
|---|---|---|
| **Duplicate coordinates** | 95 venues (44 coordinate pairs shared by 2+ venues each) | Not necessarily bad data — plausible for multiple businesses in the same building/compound (e.g. a marina promenade). Worth a spot-check of a few pairs before import, but not a blocker; the schema has no uniqueness constraint on `(latitude, longitude)` and none should be added |
| **Duplicate slugs** | None found | 0 duplicate `id`, 0 duplicate `(destSlug, vslug)` pairs, across all 426 venues |
| **Missing foreign keys** | None for venues | All 426 `destSlug` values resolve cleanly to a `destinations.slug`. **Significant for beaches**: 79/187 (42%) `destination` values don't resolve to any destination name at all |
| **Invalid categories** | None | All 426 venue categories map to a legal value (§2.4) — this was the prior audit's headline blocker; it no longer exists |
| **Orphan media** | 13 venue `coverUrl` values, 0 destination `coverUrl` values | Every populated `coverUrl` is a legacy filesystem path (`/media/venues/{destSlug}/{id}-{slug}/cover.webp`), not a URL the new platform can serve or even fetch — there's no evidence the referenced files are reachable from this environment at all. **This audit did not check whether the underlying image bytes still exist anywhere** (they weren't part of this JSON export, and `exports/dataset_summary.md`'s own scope note only covers the 5 JSON files, not image binaries) — that's an open question, not a resolved one |
| **Invalid URLs** | None found | Every populated `mapsUrl` (426) and `website` (227) value is a well-formed `https://` URL |
| **Fields that cannot be imported** | `rating`, `reviews`, `venues.destination` (display name), `externalLink` (practically) | No destination column exists for the first two; both are 0% populated in this file anyway, so the "cannot import" is theoretical, not a real loss today. `destination` is redundant by design. `externalLink` has no column and only 1 populated record — a genuinely tiny, named loss if left unaddressed |
| **Identity collision — `marassi`** | 1 destination | Already exists in production (`status='approved'`, `region='Sidi Abdelrahman Area'`). The import file has `region: null` for it and no status. **Must not overwrite this row's `status`/`region` with the import's blanker values** — see §5 |
| **Reserved-word collision** | None | No venue or destination `id`/`slug` in this file collides with the backend's reserved path segments (`bulk`, `export`, `duplicates`, `stats`) |
| **`_meta` filename/version mismatch** | 1 file | Filename says `v19`, `_meta.version` says `20` — worth confirming this is the intended, complete file before importing anything from it |
| **Partial export** | 24 + 1 = 25 venues | `_meta.counts` records 24 `geoExcluded` and 1 `hidden` venue that exist in the source workspace but are **not present in this file**. Whatever import runs against this file will not include them — that's a scope decision already made upstream of this audit, just worth stating explicitly so "426 imported" isn't later mistaken for "everything imported" |
| **Beach data structurally unimportable** | 187 records | No ID, no slug, no coordinates anywhere in the source. Confirmed unchanged from the prior audit — deferring is still correct, not a new problem introduced by this file |

---

# 5. Existing Data Strategy

**Current production content, verified directly:** exactly one destination
(`marassi`, `status='approved'`, `region='Sidi Abdelrahman Area'`) and one
venue (`v00001`, `"The Smokery"`, `category='Restaurant'`) — and `v00001`
does **not** appear anywhere in this legacy dataset's 426 ids, so there is
no venue-level collision to resolve today. The only real collision is the
one destination.

**Recommended matching order — as specified in the task, and the reasoning
for that exact order:**

1. **Slug (first).** For destinations, the legacy `slug` *is* the new
   `id` — an exact-string match is the strongest possible signal of "this
   is the same real-world place," with zero ambiguity. For venues,
   `vslug` (scoped to `destSlug`) plays the same role. Slug collisions are
   deliberate, human-assigned identifiers — a match here means "someone
   already decided this is the same entity," which is stronger evidence
   than any inferred signal below it.
2. **Google Maps URL (second).** `mapsUrl` encodes a Google Place ID
   inside it — a Maps URL match means "the same physical location was
   independently confirmed by whoever curated both records," which is
   very strong evidence even when the slug differs (e.g. a listing
   renamed since the platform's own record was created). Ranked below
   slug only because slug is a deliberate identifier while a Maps URL
   match is inferred from an incidental field.
3. **Name + destination (third).** A same-name match scoped to the same
   destination is reasonable supporting evidence but meaningfully weaker
   — the dataset itself already demonstrates name collisions matter
   (`"New Alamein"` is used as the *display* name for two different real
   destinations, `new-alamein` and `amwaj` — a name-only match without
   the destination scope would be actively wrong here). Ranked below
   Maps URL because free-text names drift (this file's own `venues[].destination`
   field disagreeing with the destination's real name in 3 cases is
   direct proof of that drift within this very dataset).
4. **Coordinates (fourth, weakest, last resort).** Useful only when
   nothing else matches — two independently-curated records for the same
   real place can easily have slightly different `lat`/`lng` (different
   pin placement, different rounding), and, as §4 shows, 95 legitimate
   *different* venues in this very file already share exact coordinates.
   A coordinate-only match is the easiest of the four to produce a false
   positive from, so it's the last thing tried, not the first.

**Given today's actual production state**, this order matters for exactly
one record in this import: `marassi` matches on slug (step 1) against the
existing destination. Every other destination and all 426 venues are new
(no match at any step) — the matching *policy* matters far more for a
second/future import run than for this first one, where almost everything
is a straightforward create.

---

# 6. Dry Run Plan

A dry run must connect to the real target database (read-only queries
only — `SELECT`s to check for existing matches, no `INSERT`/`UPDATE`) and
produce a report with exactly these four buckets, with **zero writes**:

- **New** — every legacy record that matches nothing in the existing
  database by any of the §5 matching rules. Report: legacy id/slug, and
  which entity type (destination/venue).
- **Updated** — every legacy record that *does* match an existing row,
  along with a **field-by-field diff** of what would change (old value →
  new value), so a human can see exactly what an update would overwrite
  before it happens. For `marassi` specifically, the dry run must show
  that `region`/`status` would **not** change (per §5's do-not-downgrade
  rule) even though the legacy record's own `region`/`status` fields are
  blanker — the dry run's diff output should make that "protected field,
  no change" outcome visible, not silently correct, so it's reviewable.
- **Skipped** — every record this audit has already identified as
  out-of-scope for this pass: all 187 beaches (§3/§4 — deferred
  structurally), and any venue/destination field this audit marked
  "Missing destination" or genuinely unmappable (§2) — reported per
  record, not just as an aggregate count, so nothing silently vanishes
  without a paper trail.
- **Errors** — anything that would fail a real import attempt: a
  malformed value, a `category`/`region` that (contrary to this audit's
  findings) doesn't actually resolve, a constraint the dry run's own
  simulated write would violate. Given this audit's findings, this
  bucket should be near-empty for venues (categories are clean) and
  entirely populated for destinations until `region` values are decided
  (§7) — every one of the 25 destinations would currently error on
  `region` being unresolvable.

**Explicitly not built yet** (per this task's own scope): the actual
script that produces this report. This section describes its required
*behavior*, not its implementation.

---

# 7. Import Plan

**Safest order** — chosen so that every step's prerequisites are already
satisfied by the step before it, and so that mistakes are caught (dry run)
before they're committed:

1. **Resolve `destinations.region` for all 25 legacy destinations first.**
   Not inferable from the data (§2.2) — this is the one remaining
   decision that blocks everything downstream, exactly as the prior audit
   already concluded, just now scoped to the *value set* of exactly 8
   regions rather than an open question. This is a business decision
   (which of the 8 named coastal regions each compound belongs to), not
   something this audit will guess at.
2. **Destinations.** Import all 25 (24 new + `marassi` matched/protected
   per §5) as `status='draft'`, `region` from step 1, `boundary` verbatim
   where populated (10/25). This must complete before venues, since
   `venues.destination_id` is a `NOT NULL` FK.
3. **Categories.** No action needed — this is not a separate import step
   in the new schema (categories are a fixed `CHECK` constraint, not a
   table), and every value already resolves per §2.4.
4. **Beaches.** **Deferred, not imported in this pass** — per §3/§4,
   structurally missing the identifiers required to create a row at all.
5. **Venues.** Import all 426 as `status='draft'`, category via the §2.4
   mapping, `geo` → `legacy_geo` verbatim, `facebook`/`tiktok` per
   whatever transformation policy is decided (§2.1). Must run strictly
   after step 2.
6. **Media (covers).** Deferred/separate decision — §4's open question
   about whether the referenced image files are reachable anywhere needs
   an answer before this step has a plan at all, let alone an
   implementation.
7. **Gallery.** No action needed for this file — 0/426 populated.
8. **Social links.** Handled as part of step 5 (they're plain columns on
   the venue row, not a separate collection).
9. **Final validation.** Re-run the dry run's own matching logic
   read-only against the *post-import* state and confirm it now reports
   zero "New" and zero "Errors" for everything that was supposed to be
   imported — i.e., prove the import did what the dry run predicted,
   don't just trust that it did.
10. **Rollback strategy.** A full `pg_dump` backup taken immediately
    before step 2 begins (same pattern already used and verified during
    this project's own production deployment — see
    `docs/PRODUCTION_DEPLOYMENT_REPORT.md`). Since every new row this
    import creates is `status='draft'` and nothing gets published
    automatically, the lowest-risk rollback for anything short of a
    catastrophic failure is simply **deleting the newly-created draft
    rows by their known id/slug list** (all synthetically imported, never
    touching the pre-existing `marassi`/`v00001` rows) — faster and
    lower-blast-radius than a full restore, with the full `pg_dump` kept
    as the last-resort fallback exactly like the production deployment's
    own rollback plan already establishes.

---

## Summary

| | |
|---|---|
| Venues in file | 426 (24 geo-excluded + 1 hidden are **not** in this file) |
| Venues with a legal category | 426 / 426 (100%) — **was the prior blocker, now resolved** |
| Venues needing `facebook`/`tiktok` transform | 42 / 426 |
| Venues with legacy cover images (unimportable as-is) | 13 / 426 |
| Venues with preservable geo-review history | 426 / 426 |
| Destinations in file | 25 |
| Destinations with a `region` value | 0 / 25 — **the one remaining blocker** |
| Destinations already existing in production | 1 (`marassi`) — must not be downgraded |
| Beaches in file | 187 — **structurally unimportable, deferred** |

**This audit implements nothing.** No code was written, no script was
generated, no file besides this report was created or modified, and
nothing was committed. Waiting for approval before any implementation
work begins.
