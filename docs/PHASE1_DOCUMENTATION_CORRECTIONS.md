# Phase 1 Documentation Corrections

**Type:** Documentation/comment correction only. No schema, migration, SQL,
API, test, or behavior change. The Phase 1 implementation accepted in
`PHASE1_COMPLETION_REPORT.md` is unmodified in substance — only the
citation text in five files was corrected.

**Source of findings:** `docs/PHASE1_RETROSPECTIVE.md` §1, re-verified
independently against the actual headers of both
`docs/PLATFORM_SPEC_v1.0_FROZEN.md` and `docs/PLATFORM_SPEC_v1_FINAL.md`
before making any change.

---

## Corrections made

### 1. `api/alembic/versions/0005_venue_category_extension.py`

- **Incorrect reference:** `PLATFORM_SPEC_v1.0_FROZEN.md §3`
- **Correct reference:** `PLATFORM_SPEC_v1_FINAL.md §3` ("Taxonomy Specification — FINAL")
- **Reason:** `PLATFORM_SPEC_v1.0_FROZEN.md`'s actual §3 is **"Database Indexing"** — unrelated to categories. The 13-value taxonomy is inherited unchanged from `PLATFORM_SPEC_v1_FINAL.md` §3; the frozen document deliberately does not restate it under its own numbering (its stated policy: decisions the architecture review didn't challenge are carried forward, not repeated). The citation must therefore name the document where the content actually lives.
- **Verification result:** Confirmed `PLATFORM_SPEC_v1_FINAL.md` line 237 = `## 3. Taxonomy Specification — FINAL`, containing the 13-value list. Confirmed `PLATFORM_SPEC_v1.0_FROZEN.md` line 212 = `## 3. Database Indexing`. Docstring now states both facts explicitly, including *why* the FROZEN document has no matching section, so a future reader isn't left to rediscover this.

### 2. `api/app/db/models.py`, `DESTINATION_REGIONS` comment (line 44)

- **Incorrect reference:** `PLATFORM_SPEC_v1.0_FROZEN.md §7.2/§7.3`
- **Correct reference:** `PLATFORM_SPEC_v1.0_FROZEN.md §7.3`
- **Reason:** §7.3 is correct (*"`region` is a closed vocabulary with no enforcement"*). §7.2 is **"Destination deletion has two contradictory mechanisms"** — entirely unrelated to region; it should never have been in this citation.
- **Verification result:** Confirmed `PLATFORM_SPEC_v1.0_FROZEN.md` line 541 = `### 7.3 \`region\` is a closed vocabulary with no enforcement`, line 509 = `### 7.2 Destination deletion has two contradictory mechanisms`. `§7.2` removed; `§7.3` retained as the sole, correct citation.

### 3. `api/app/db/models.py`, `Venue.legacy_geo` comment (lines 174–178)

- **Incorrect reference:** `§2.2 (Legacy-only) / §7.13` (both implicitly attributed to `PLATFORM_SPEC_v1.0_FROZEN.md`, the only document named anywhere near this comment)
- **Correct reference:** `PLATFORM_SPEC_v1_FINAL.md §2.2` (Venue, Legacy-only) for the field's origin; `PLATFORM_SPEC_v1.0_FROZEN.md §7.13` for the drop-eligibility condition
- **Reason:** `PLATFORM_SPEC_v1.0_FROZEN.md` has no §2.2 at all — its §2 ("Beach Contradiction") runs 2.1–2.6, and 2.2 specifically is *"Canonical beach identity — the algorithm,"* unrelated to the Venue entity table. The Venue entity's field-by-field spec — where `legacy_geo` is actually described as "Legacy-only" — is `PLATFORM_SPEC_v1_FINAL.md` §2.2. §7.13 was already correctly attributed to the FROZEN document; only the §2.2 half was wrong.
- **Verification result:** Confirmed `PLATFORM_SPEC_v1_FINAL.md` line 128 = `### 2.2 Venue`. Confirmed `PLATFORM_SPEC_v1.0_FROZEN.md` line 768 = `### 7.13 \`legacy_geo\` has no expiry or cleanup trigger`. Comment now attributes each half to its correct source document explicitly.

### 4. `api/alembic/versions/0008_i18n_and_legacy_geo_columns.py` (line 12)

- **Incorrect reference:** `per §2.2/§7.13` (shorthand implying both belong to the same, unnamed document — ambiguous at best, and this file's docstring already separately named `PLATFORM_SPEC_v1_FINAL.md`'s Venue entity table two lines later, creating an internal inconsistency between the shorthand and the fuller explanation right below it)
- **Correct reference:** `PLATFORM_SPEC_v1_FINAL.md §2.2` for the field's origin; `PLATFORM_SPEC_v1.0_FROZEN.md §7.13` for the drop-eligibility condition
- **Reason:** Same underlying defect as correction 3, appearing a second time in this migration's own docstring, with the added problem of contradicting its own next sentence (which *did* correctly name `PLATFORM_SPEC_v1_FINAL.md`).
- **Verification result:** Docstring now attributes both halves consistently and matches the fuller explanation immediately following it — no internal contradiction remains within the same docstring.

### 5. `docs/PHASE1_COMPLETION_REPORT.md` (line 34)

- **Incorrect reference:** `PLATFORM_SPEC_v1.0_FROZEN.md (§2.2, §7.13)`
- **Correct reference:** `PLATFORM_SPEC_v1_FINAL.md §2.2` (Venue entity table) and `PLATFORM_SPEC_v1.0_FROZEN.md §7.13` (drop-eligibility condition)
- **Reason:** Same defect as correction 3, repeated in the completion report's own account of the `legacy_geo` gap-discovery.
- **Verification result:** Both documents now cited separately and correctly; matches the corrected model/migration comments exactly, so the report and the code no longer disagree with each other.

---

## Full re-verification sweep

Every `§`-bearing line in every reviewed file was re-checked after making
the five corrections above — not spot-checked, all of them:

| File | `§` citations found | Resolve correctly? |
|---|---|---|
| `api/app/db/models.py` | `§7.3`, `§3.1` ×3, `§5.1` ×2, `§5.2`, `§4.2` ×2, `§4.3`, `§7.8`, `§7.13` (FROZEN); `§2.2` (FINAL) | ✅ All |
| `api/alembic/versions/0005_venue_category_extension.py` | `§3` (FINAL, now explicit) | ✅ |
| `api/alembic/versions/0006_destination_region_check.py` | `§7.3` (FROZEN) | ✅ |
| `api/alembic/versions/0007_concurrency_version_columns.py` | `§4`, `§4.3` (FROZEN) | ✅ |
| `api/alembic/versions/0008_i18n_and_legacy_geo_columns.py` | `§5.1`, `§5.2` (FROZEN); `§2.2` (FINAL, now explicit) | ✅ |
| `api/alembic/versions/0009_beach_details_shape_constraint.py` | `§7.8` (FROZEN) | ✅ |
| `api/alembic/versions/0010_required_indexes.py` | `§3.1`, `§1` (FROZEN) | ✅ |
| `docs/PHASE1_COMPLETION_REPORT.md` | `§2.2` (FINAL, now explicit), `§7.13` (FROZEN) | ✅ |
| `docs/PHASE1_RETROSPECTIVE.md` | Unchanged — this document's citations are *about* the defects (quoting the wrong text to describe it), not asserting it; each is accurate as a description of what was wrong |
| `docs/PLATFORM_SPEC_v1.0_FROZEN.md` | ~60 self-references and "prior spec's §X" references | ✅ All — cross-checked against both documents' real headers during this review; every self-reference resolves within the FROZEN document itself, every "prior spec" reference resolves correctly against `PLATFORM_SPEC_v1_FINAL.md`'s real headers (§0, §2.2, §2.5, §2.9, §4, §4.2, §7, §7.2, §8, §8.2, §9.1, §9.3, §10, §10.4, §10.6, §11 all confirmed present with matching content) |
| `docs/PLATFORM_SPEC_v1_FINAL.md` | Not separately re-swept — its content is the reference standard the other files were checked against, not itself under suspicion; no citation *within* it pointing at itself or at FROZEN was flagged by the retrospective |

## Confirmation checks

- **No broken section numbers:** every numeric citation (`§N`, `§N.N`) in
  every reviewed file now names a section number that exists in the
  document it's attributed to.
- **No references to non-existent sections:** confirmed by direct
  line-number lookup against both specification documents' actual
  headers (shown in the table above), not by assumption.
- **Every reference points to the correct concept, not merely an existing
  section:** each of the five corrections above was a case where the old
  citation pointed at a real, existing section — just the *wrong* one
  (Database Indexing instead of Taxonomy; Destination Deletion instead of
  Region; the FROZEN document's own §2.2 instead of FINAL's). Concept-match,
  not just number-existence, was the actual standard applied throughout
  this review, consistent with the task's explicit sixth verification
  requirement.

## Behavior verification

Re-ran the full migration chain (`alembic upgrade head`, clean database)
and the complete test suite after making all five corrections, to confirm
these were genuinely comment-only changes:

```
alembic upgrade head  →  0001 through 0010, clean
pytest -q              →  249 passed
```

Identical result to before the corrections — as expected, since every
change was inside a comment or docstring, never inside executable code.

---

## Verdict

> ### **DOCUMENTATION VERIFIED**

Phase 1 is fully closed. Implementation may proceed to Phase 2.
