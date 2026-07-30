# Phase 1 Retrospective — Schema & Database

**Purpose:** an adversarial re-check of Phase 1's implementation, not a
restatement of `PHASE1_COMPLETION_REPORT.md`. Where this document disagrees
with that one, this document is the more current and correct account.

**No code, migrations, or the specification were modified to produce this
retrospective.**

---

## 1. Does every change trace back to `PLATFORM_SPEC_v1.0_FROZEN.md`?

**Mostly yes — but re-verifying every `§`-citation against the frozen
document's actual headers (not from memory) found three that are wrong.**

This is worth taking seriously rather than waving through: the entire
multi-session arc that produced the frozen spec existed specifically to
eliminate dangling/incorrect cross-references (`PLATFORM_SPEC_REVIEW.md`
§1.1 named this exact defect class as Critical). Finding that Phase 1 itself
reintroduced three instances of it is the retrospective's most important
result.

### 1.1 Confirmed defects

| Location | Cites | Problem |
|---|---|---|
| `alembic/versions/0005_venue_category_extension.py` docstring | *"PLATFORM_SPEC_v1.0_FROZEN.md §3"* | **Wrong document.** `PLATFORM_SPEC_v1.0_FROZEN.md`'s actual §3 is **"Database Indexing"** — nothing to do with categories. The 13-value taxonomy lives in `PLATFORM_SPEC_v1_FINAL.md` §3 ("Taxonomy Specification — FINAL"), a different, technically-superseded document. The frozen spec's own review of this exact taxonomy finding (§3.4's enum-vs-table closure) doesn't restate the value list at all — by the frozen doc's own stated policy (*"every decision the review did not challenge is carried forward unchanged... not repeated in full here"*), so there genuinely is no frozen-document section number to cite for "13 values" — the citation should point at `PLATFORM_SPEC_v1_FINAL.md §3` explicitly, not an unqualified "FROZEN §3." |
| `app/db/models.py`, `DESTINATION_REGIONS` comment | *"§7.2/§7.3"* | **Half wrong.** §7.3 is correct (region enforcement). §7.2 is **"Destination deletion has two contradictory mechanisms"** — entirely unrelated to region. The `/§7.2` half of this citation should not be there. |
| `app/db/models.py`, `legacy_geo` column comment | *"§2.2 (Legacy-only)"* | **Wrong document.** `PLATFORM_SPEC_v1.0_FROZEN.md` has no §2.2 at all — its §2 ("Beach Contradiction") runs 2.1–2.6, and 2.2 is specifically *"Canonical beach identity — the algorithm,"* not the Venue entity table. The Venue entity's field-by-field spec (where `legacy_geo` is actually described as "Legacy-only") is `PLATFORM_SPEC_v1_FINAL.md` §2.2. Same class of error as the first row. |

**Severity:** comment-only, zero functional/schema impact — every migration
still runs correctly and every constraint still enforces exactly what it
should. But these are exactly the kind of citation that, left uncorrected,
becomes indistinguishable from the "broken §0.3/§0.1" defect the review
process spent real effort closing. **Not fixed here**, per this task's "do
not modify code/migrations" instruction — flagged for a follow-up
documentation-only correction before or during Phase 2.

### 1.2 Everything else traces correctly

Re-verified against the frozen document's real headers, not assumed:

| Citation | Frozen doc's actual heading | Correct? |
|---|---|---|
| `§7.3` (region enforcement) | *"`region` is a closed vocabulary with no enforcement"* | ✅ |
| `§4` / `§4.2` / `§4.3` (version columns, concurrency) | *"Concurrent Editing" / "Schema change" / "Protocol"* | ✅ |
| `§5.1` / `§5.2` (translations) | *"Fields" / "Fallback rule"* | ✅ |
| `§7.8` (beach_details shape) | *"`beach_details` shape validated only at the application layer"* | ✅ |
| `§7.13` (legacy_geo retirement condition) | *"`legacy_geo` has no expiry or cleanup trigger"* | ✅ |
| `§3.1` (indexes) | *"Required indexes — final list"* | ✅ |
| `§1` (referential-closure composite index) | *"Referential Closure"* | ✅ |

Six of nine distinct citations are correct; three are not. The pattern in
the three errors is consistent: each is a case where content is genuinely
*inherited unchanged* from `PLATFORM_SPEC_v1_FINAL.md` (taxonomy, the
Venue entity table) rather than restated in the frozen document, and the
citation should have named the source document explicitly instead of
defaulting to "FROZEN."

---

## 2. Has every backlog correction been documented?

**Yes, all three.** Cross-checked against `PHASE1_COMPLETION_REPORT.md`:

1. `venues.legacy_geo`'s missing creation task — found, explained with
   exact section citations from both frozen documents, your sign-off
   obtained before implementing, documented in the completion report and in
   migration `0008`'s own docstring.
2. EP6's deferral (blocked on Phase 4's EP25) — documented, matches
   `IMPLEMENTATION_BACKLOG.md`'s own pre-existing Blockers section; not a
   new decision invented during execution.
3. EP2-T02's deferral (API/Studio scope, not schema) — documented, matches
   the backlog's own per-task Frontend/API columns.

No correction was made silently; none is undocumented.

---

## 3. Did any accidental scope expansion occur?

**No.** Re-diffed the full Phase 1 commit range against the prior baseline:

```
api/alembic/versions/0005_*.py  through  0010_*.py   (6 new files)
api/app/db/models.py                                  (modified)
api/tests/conftest.py                                 (modified)
api/tests/test_destinations.py                         (modified)
api/tests/test_schema_constraints.py                   (new)
docs/PHASE1_COMPLETION_REPORT.md                       (new)
```

Nothing under `api/app/api/` (routes, schemas) or `datalab-next/` was
touched — confirming Phase 2/3 work did not leak in. The two test-file
modifications are a direct, necessary consequence of EP2's new CHECK
constraint (existing fixtures used region values the new constraint
correctly rejects) — not unrelated cleanup; every changed line in both
files is a region-literal substitution, nothing else.

---

## 4. Was any technical debt introduced?

**No new debt. One real item of *latent*, pre-existing debt was found and
removed instead.**

The `none_as_null=True` fix for `beach_details` is a net debt reduction, not
an addition: SQLAlchemy's JSONB `None`-vs-`null` ambiguity existed on every
JSONB column in this schema (`opening_hours`, `translations`, `boundary`,
`legacy_geo`) since long before Phase 1 — it simply had no observable
consequence until EP5's constraint made the distinction load-bearing for
the first time. Fixing it only where it's actually consequential (scoped to
`beach_details` alone) is the correct minimal fix, not the introduction of
a workaround.

The three citation defects in §1.1 are a form of documentation debt, but a
freshly-introduced one worth being honest about rather than filing under
"technical debt was avoided."

---

## 5. Can any migration be simplified?

**No migration is individually simplifiable — each does exactly one epic's
worth of work, per the explicit "keep commits logically separated"
instruction.** Re-reviewed each of the six for internal bloat:

- `0005` (category): one constraint drop + recreate. Minimal.
- `0006` (region): one constraint creation. Minimal.
- `0007` (version columns): two `add_column` calls, no server-side logic
  beyond the default. Minimal.
- `0008` (translations + legacy_geo): three `add_column` calls — could
  arguably split further (translations vs. legacy_geo are different EPs'
  concerns, EP4 vs. the corrected gap), but they're the same *kind* of
  change (nullable JSONB additions) landing in the same corrective
  decision, and further splitting would add commit-count noise without
  adding rollback granularity that matters in practice (both are purely
  additive, independently reversible regardless of grouping).
- `0009` (beach_details CHECK): one constraint. Minimal.
- `0010` (indexes): six index operations + one extension — already the
  single most "bundled" migration in the set, but every item in it maps to
  the same epic (EP7) and the same acceptance criterion ("all named
  indexes exist"). Splitting per-index would be six near-empty migration
  files for one epic; not a real simplification.

**One cross-migration observation, not a same-migration redundancy:** see
§6 below.

---

## 6. Is any index or constraint redundant?

**No constraint is redundant.** Each enforces a distinct invariant
(category values, region values, beach-details shape) with no overlap.

**One index is now a genuine simplification candidate — not created
redundantly by Phase 1, but made *partially* redundant by Phase 1's own
addition.**

`ix_venues_destination_id` (single-column, from `0001_initial_schema.py`,
predating this phase) and the new `ix_venues_destination_id_status`
(composite, `0010`) share `destination_id` as their leading column.
PostgreSQL can serve a `destination_id`-only equality query using the
leading-column prefix of the composite index almost as efficiently as the
dedicated single-column one — meaning the standalone index may now be safe
to drop.

**Not acted on here, for two reasons:** (1) this task's instructions
forbid modifying migrations, and (2) `0001` predates Phase 1 entirely —
touching it would mean editing a migration this phase didn't create, which
is its own decision requiring explicit sign-off, not a Phase 1 cleanup.
**Flagged as a genuine candidate for Phase 7's `EP35` (Index Deployment &
Verification)**, which already owns re-examining index behavior against
real data volumes — the right place to decide this with real query-plan
evidence, not a guess made now.

---

## 7. Does every new test correspond to a real specification requirement?

**Yes — re-checked test-by-test, not just by class name:**

| Test class | Asserts | Frozen-spec requirement |
|---|---|---|
| `TestCategoryTaxonomy` | All 13 categories insert; a 14th is rejected | `PLATFORM_SPEC_v1_FINAL.md` §3 (unchanged by the frozen doc; the specific correction needed per §1.1 above) |
| `TestRegionEnforcement` | All 8 regions insert; an invalid one is rejected | `PLATFORM_SPEC_v1.0_FROZEN.md` §7.3 |
| `TestConcurrencyVersionColumn` | `version` defaults to `1` on both entities | `PLATFORM_SPEC_v1.0_FROZEN.md` §4.2 |
| `TestTranslationsColumn` | `translations` round-trips verbatim, including non-ASCII; `legacy_geo` round-trips verbatim | `PLATFORM_SPEC_v1.0_FROZEN.md` §5.1; `legacy_geo` per `PLATFORM_SPEC_v1_FINAL.md` §2.2 / `FROZEN` §7.13 |
| `TestBeachDetailsShape` | All 4 shape cases (Beach+both-keys, non-Beach+null, Beach+missing-key, non-Beach+populated) behave per spec | `PLATFORM_SPEC_v1.0_FROZEN.md` §7.8 |
| `TestRequiredIndexes` | Every named index exists; `pg_trgm` is enabled | `PLATFORM_SPEC_v1.0_FROZEN.md` §3.1 |

No test asserts behavior the frozen specification doesn't require, and no
specification requirement in Phase 1's scope is left without a test.

---

## Summary verdict

| Check | Result |
|---|---|
| Every change traces to the frozen spec | **Mostly — 3 citation defects found, documented above, not yet fixed** |
| Every backlog correction documented | ✅ Yes, all 3 |
| No accidental scope expansion | ✅ Confirmed by re-diff |
| No technical debt introduced | ✅ Net debt *reduction* (the `none_as_null` fix); 3 citation defects are the one honest exception |
| No migration can be simplified | ✅ Each is minimal for its epic |
| No index/constraint is redundant | ⚠️ One pre-existing index (`ix_venues_destination_id`, from `0001`) is now a simplification candidate given the new composite index — flagged for Phase 7's `EP35`, not acted on |
| Every test traces to a real requirement | ✅ Confirmed test-by-test |

**Net assessment:** Phase 1's actual schema, constraints, and data-integrity
behavior are sound and fully verified. The retrospective's real finding is
in the *documentation layer wrapped around* that work — three section
citations that point at the wrong document or the wrong section — which
matters disproportionately here because eliminating exactly that defect
class was the stated purpose of the review-and-freeze process this
implementation is built on top of. Recommend correcting the three citations
(comment-only changes, no schema/migration impact) as the first small item
of Phase 2, or as a standalone documentation fix before Phase 2 begins —
your call, not decided here.

**Not starting Phase 2.**
