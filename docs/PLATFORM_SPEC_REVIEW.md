# Independent Architecture Review — `PLATFORM_SPEC_v1_FINAL.md`

**Reviewer stance:** Independent Principal Architect, not involved in
authoring the specification under review. My mandate was to try to reject
it. This document reports what survived that attempt and what did not.

**No code, schema, or the specification itself was modified to produce this
review.**

---

## How to read this review

Each finding has a **severity**, **rationale**, **risk**, and **suggested
resolution**. Severities:

- **Critical** — blocks freeze. The spec cannot be implemented as written
  without producing a defect or an unresolvable ambiguity.
- **High** — should block freeze. Not an immediate defect, but a load-bearing
  gap the spec claims to have already closed.
- **Medium** — should be resolved before implementation begins, but could be
  handled as a fast-follow amendment without re-opening the whole document.
- **Low** — worth recording, not blocking.

---

## 1. Contradictions

### 1.1 Broken internal cross-references — **Critical**

**Finding.** §0 cites `§0.3` and `§0.1` twice:

> *"would violate §0.3 below (no field may exist with no writer)"* (line 31)
> *"beaches are in scope for v1 (§0.1) rather than deferred"* (line 87)

§0 has no numbered subsections — it contains two plain numbered items ("1."
and "2."), neither called §0.1 or §0.3. **Neither citation resolves to
anything.** "No field may exist with no writer" is stated nowhere else in the
document either — it is asserted as an existing rule and is not one.

**Rationale.** This is not cosmetic. Principle 1.5 is *"Explicit over
implicit... every decision... is written down here, not left to be inferred."*
A specification whose own foundational contradiction-resolution section cites
itself incorrectly fails its own stated standard on line one of substantive
content.

**Risk.** An implementer who goes looking for "§0.3" to understand why beach
identity must be resolved before migration will find nothing, and will have
to *infer* the rule the citation was supposed to make explicit — precisely
the failure mode Principle 1.5 exists to prevent.

**Resolution.** Number §0's two items as §0.1/§0.2, and either state "no field
may exist with no writer" as a real, numbered rule (it's a reasonable one —
consider promoting it to Principle 1.10) or rewrite the two citations to
point at where the rule actually lives (arguably Principle 1.7 for the
beaches case).

---

### 1.2 Destination deletion has two contradictory mechanisms

**Severity: High**

**Finding.** §2.1 gives `Destination.status` an `archived` value (soft
removal, via workflow). §8.1 separately lists `DELETE /editor/destinations/{id}`
as a required, existing endpoint (hard removal). The spec never states which
one an editor should use, when, or what happens to the other. The current
schema's `venues.destination_id` FK is `ON DELETE RESTRICT`, meaning the hard
`DELETE` only succeeds for a destination with zero venues — a constraint the
spec doesn't mention, so a reader would not know the hard-delete path is
effectively unusable for any destination that has ever had a venue.

**Rationale.** Principle 1.8 ("no duplicated concepts... if two fields would
ever answer the same question, one is deleted") applies just as much to
*operations* as to *fields*. Two removal mechanisms with silently different
blast radii is exactly the kind of duplication that principle forbids.

**Risk.** An editor archives a destination expecting it to behave like an
archived venue (recoverable, §4.2's `archived → draft` restore path exists).
A different editor, or a future integration, calls `DELETE` on a destination
with no venues, expecting the same semantics as archive — but it is
**permanent and has no restore path in this spec at all**. Nothing here
prevents two people from reasonably expecting two different outcomes from
what looks like "the same" removal action.

**Resolution.** Pick one. Either (a) remove `DELETE
/editor/destinations/{id}` from the required surface entirely and rely on
`archived` exclusively, matching venues' own model where no hard-delete
endpoint exists at all — or (b) keep `DELETE` but scope it explicitly to
"only ever called on a destination with zero venues, as an admin-only
correction for a destination created in error," and state that in §7.

---

### 1.3 Beach identity derivation is deferred, not decided — contradicts "no ambiguity, final spec"

**Severity: High**

**Finding.** §6.4 states identity derivation for migrated beaches "is
specified in §10, not here." §10.4 then says the actual rule will be
*"written down in the migration runbook before the script runs."* **No
runbook exists. No derivation algorithm is given anywhere in this document.**
The spec asserts finality over a decision it has not actually made.

**Rationale.** This is the same failure class as 1.1: a citation that leads
nowhere. Worse here, because §0 explicitly frames beach migration as the
resolved half of the document's one open contradiction — and the resolution
itself turns out to still be open.

**Risk.** Beach identity (§6.4) directly feeds §10.8's acceptance criteria
("zero duplicate ids"). Without the actual algorithm specified, two different
implementers could derive different ids from the same 187 beach records,
producing different, non-reproducible outcomes from the same "final" spec —
which is precisely what a frozen specification exists to prevent.

**Resolution.** State the actual rule in §6.4 or §10.4 now, e.g.: *"`id` =
`{destination_id}-beach-{slugify(name)}`, truncated to 200 chars, with a
numeric suffix appended on collision within the same destination."* This is
a two-sentence fix that closes a real gap.

---

### 1.4 Hidden assumption: publish snapshot does not guarantee referential closure

**Severity: Critical**

**Finding.** `publish()` (§5.1, and the current `engine.py` it describes)
gathers `destinations WHERE status='approved'` and `venues WHERE
status='approved'` as **two independent queries**. Nothing requires that a
venue's parent destination is *also* `approved` at publish time. A venue can
be approved and published while its destination is still `draft` or `review`.

The resulting snapshot then contains a venue whose `destination_id` does not
match any entry in that same snapshot's `destinations` array.

**Rationale.** §5.2 states the snapshot is `{"destinations": [...], "venues":
[...]}`, and the public API (`PublishedVenueOut`) exposes a resolved
`destination: DestinationRef {id, name}` per venue. If that resolution is
built from the snapshot alone (not a live table lookup), it has no destination
to resolve against for such a venue. If it silently falls back to a live
table lookup instead, that violates §5.1's own claim that the public path
"reads only the current publish revision, never `destinations`/`venues`
directly" (a claim inherited from the pre-existing architecture, restated
here without re-examination).

**Risk.** This is not a hypothetical edge case for a small, curated
catalogue with multiple editors — it is the *default* outcome of two
independently-filtered queries whenever approval doesn't happen to be
perfectly ordered parent-before-child. A public venue page could 404, render
with a missing/blank destination, or (if there's a silent live-table
fallback) violate the platform's own "publish is source of truth" invariant.

**Resolution.** Add a hard rule to §5.1: **"A venue is eligible for a publish
snapshot only if its destination is also `approved`."** Enforce it either as
a join condition in the publish query, or as a validation rule at Approve
time (§4.4: a venue cannot move to `approved` if its destination is not
`approved` or further along). This is a one-sentence spec addition with a
small, well-scoped implementation change — but it must be decided before
freeze, because it changes what "Approve" is allowed to do.

---

## 2. Future scalability

### 2.1 No indexing strategy for a spec that explicitly targets 100,000 venues

**Severity: High**

**Finding.** The spec discusses `Numeric(9,6)`, JSONB shapes, and CHECK
constraints in detail, but **never once mentions an index** beyond the two
existing unique constraints (`is_current` partial index, `(destination_id,
slug)` uniqueness). At 100,000 venues, `GET /editor/venues` filtering by
`destination_id`, `category`, or `status` — every one of §8.2's existing
query parameters — requires an index on each to avoid a sequential scan. The
`q` parameter is documented elsewhere in the codebase as plain `ILIKE`,
explicitly deferred pending "AI Search" — that deferral is reasonable, but
this spec doesn't even acknowledge the deferral exists, let alone restate the
trigger condition for revisiting it.

**Rationale.** Principle 1.6 ("forward-compatible... nothing is designed to
require a schema-breaking change for a currently-known near-term need") is
violated by omission: index creation is not schema-breaking, so there is no
excuse for the spec not to name the requirement, given it explicitly poses
"100,000 venues" as a scale target for its own review.

**Risk.** Every list/filter endpoint degrades from "instant" to "scans 100k
rows per request" silently, with no forcing function to notice until user
complaints arrive in production.

**Resolution.** Add a short "Indexing" subsection to §8: B-tree indexes on
`venues.destination_id`, `venues.category`, `venues.status`,
`destinations.status`; explicitly restate (don't just inherit) the deferred
full-text-search trigger for `q`.

### 2.2 No internationalization primitive, despite bilingual data that already exists today

**Severity: High**

**Finding.** `name`, `short_description`, `notes`, `internal_notes` are all
single plain-text columns with no locale dimension anywhere in the schema.
This is not a hypothetical future need: the audited legacy export **already
contains Arabic-named venues** (`أبراج العلمين الجديدة`, `شاطئ اوهانا`). A
North Coast Egyptian tourism platform serving both Arabic- and
English-speaking audiences is a *current*, evidenced requirement, not a
speculative one.

**Rationale.** This is the one scalability axis in the review prompt that
isn't speculative — the audit that fed this very spec proved the data is
already bilingual. Principle 1.6 says forward-compatible provisions should be
made "where a lightweight version... exists cheaply." A nullable
`name_ar`/`name_en` pair (or a `translations` JSONB column, following the
same pattern already used for `opening_hours`) is exactly that: cheap,
additive, and directly evidenced by data already in hand.

**Risk.** Two years from now, adding bilingual support requires an actual
schema migration and a backfill strategy for every existing row — the "second
migration event" Principle 1.7 was specifically written to prevent, just for
a different entity than the one it names.

**Resolution.** At minimum, document the single-language assumption
explicitly as a stated, deliberate v1 limitation (currently it is not stated
at all — it is simply absent). Better: add a nullable `name_ar` (or
equivalent) column now, populated from the legacy Arabic names during
migration rather than discarded or merged awkwardly into a single field.

### 2.3 No concurrency control for multiple simultaneous editors

**Severity: High**

**Finding.** §7 (Editorial workflow) is asked about explicitly in this
review's prompt, and the spec has no answer for it. `PATCH
/editor/venues/{id}` (Save Draft) has no optimistic-concurrency mechanism —
no `If-Match`/version check, no "this row changed since you loaded it"
detection. Two editors opening the same draft venue and both saving produce
silent last-write-wins data loss.

**Rationale.** The legacy system's field-locking mechanism existed to solve
exactly this problem (badly, via manual locks — correctly rejected in §11).
Rejecting the *mechanism* does not make the *problem* disappear; the spec
treats it as though it does.

**Risk.** Grows directly with the "multiple editors" axis this review was
asked to test. At 2 editors it's rare; at 10 it's routine; the platform has
no detection, let alone resolution, for either case.

**Resolution.** Minimum viable fix: compare the row's `updated_at` sent by the
client against the current value at write time; reject with `409` on
mismatch, same pattern as the concurrent-publish handling §5.7 already
specifies. This does not require a redesign — it requires the spec to say it
plainly, which it currently does not.

### 2.4 Multiple countries — assumption is implicit, not stated

**Severity: Medium**

**Finding.** `region` is described (§7.2) as *"broad corridor grouping"* with
"~5–8 known values." There is no `country` field anywhere in `Destination`.
The entire schema implicitly assumes a single country (Egypt's North Coast).

**Rationale.** Not a defect for v1's actual, current scope — but Principle
1.6 asks that assumptions be written down, not left implicit. This one isn't
written down anywhere; a reader has to infer it from the *absence* of a
country field, which is the opposite of Principle 1.5.

**Risk.** Low near-term (no evidence multi-country expansion is planned), but
if it ever happens, `region` would need to be disambiguated from `country`
retroactively across every existing row.

**Resolution.** One sentence in §7: *"This schema assumes a single country
(Egypt). Multi-country support is out of scope for v1 and would require a
`country` column added to `destinations` — not addressed further here since
no near-term requirement exists."* Costs nothing, closes the omission.

### 2.5 Multiple media providers — not a real gap

No finding. `cover_image_url`/`gallery_image_urls` are opaque URL strings;
switching storage providers changes upload-path code, not schema. Correctly
out of scope for this document.

---

## 3. Domain model

### 3.1 `region` is a closed vocabulary in every way except enforcement

**Severity: Medium** (see also §5.4 below — related database-model finding)

**Finding.** §7.2 describes region as effectively closed ("~5–8 known
values") but the schema gives it **no CHECK constraint**, unlike `category`
and `status`, which get exactly that treatment for the same reason
("small, closed, product-defined"). The audit that produced this very spec
found `venues.destination` (a similarly "small and closed" free-text field)
had drifted — the same destination displayed under two different spellings.
Nothing in this spec's design prevents `region` from suffering the identical
fate.

**Rationale.** This is an internal inconsistency, not just a missing nice-to-
have: the spec applies "small closed set → enforce it" reasoning to
`category` (§3) but not to `region` (§7.2), despite describing both in
identical terms.

**Risk.** Typo'd or inconsistently-cased region values fragment destination
groupings exactly as the legacy `destination` field did — a defect this
entire specification exists to prevent, reappearing one field over.

**Resolution.** Either give `region` the same CHECK-constraint treatment as
`category` (a short, named list, per the actual ~5–8 known values), or
explicitly document why it's treated differently (e.g., "region values are
expected to grow with expansion, unlike category" — but that claim would
itself need to be true, and §2.4 above suggests the opposite: it's not
expected to grow without a country field first).

### 3.2 No rejection-reason capture in the Review → Draft transition

**Severity: Medium**

**Finding.** §4.2's `review → draft` (Reject) transition has no
`validation_gate` entry and no field anywhere in `Venue`/`Destination`/
`activity_log`'s documented shape for *why* a submission was rejected.

**Rationale.** Directly relevant to §7 of this review (editorial workflow,
multiple editors). A reject with no recorded reason means the submitting
editor has no way to learn what to fix, and a second reviewer has no way to
see why the first one rejected it.

**Risk.** Grows with editor count and submission volume — exactly the
scaling axis this review was asked to test.

**Resolution.** Require a reason string on Reject, logged via the existing
`activity_log.metadata` JSONB (already the mechanism for structured,
per-action detail) — no new column needed, just a spec requirement that
Reject always populates it.

### 3.3 No ownership/assignment concept

**Severity: Low**

**Finding.** No "assigned to" field on any entity. At small editor counts
this is irrelevant; flagged only because §7 of this review explicitly asks
about ownership.

**Resolution.** Not a v1 requirement. Worth a one-line acknowledgment in §9's
"Future" tier rather than silence, so it's recognized as a deliberate
deferral rather than an oversight.

---

## 4. API design

### 4.1 No versioning strategy in a document that forbids "API redesign" permanently

**Severity: High**

**Finding.** §12 states *"No API redesign"* is permanent, yet nowhere does
the API have a version marker — no `/v1/` path prefix, no version header, no
content-type negotiation. Every endpoint in §8 is unversioned.

**Rationale.** A specification that freezes its API surface while providing
no mechanism to introduce a v2 without breaking every existing consumer
(Studio, Consumer, any future integration) has frozen itself into a corner.
This is the single highest-leverage "regretted in two years" candidate in the
entire document (see §8 of this review).

**Risk.** The first genuinely breaking change this platform ever needs — and
over a multi-year lifetime there will be one — has no path that doesn't
involve breaking every client simultaneously, or bolting on versioning
reactively, under pressure, after the fact.

**Resolution.** Does not require implementing versioning now. Requires
stating, in §8, that the current unversioned surface is implicitly "v1" and
that a v2 (if ever needed) will be introduced via a path prefix — a one-
paragraph addition that costs nothing today and removes a real design debt.

### 4.2 Two bulk-update endpoints that should be one

**Severity: Low** (see §9, Simplicity)

**Finding.** `PATCH /editor/venues/bulk/category` and `PATCH
/editor/venues/bulk/destination` (§8.2) are two narrow endpoints, each
updating exactly one field across a venue-id list.

**Rationale/Risk/Resolution:** see §9.1 below — this is fundamentally a
simplicity finding, not a correctness one.

### 4.3 `bulk` as a path segment is a soft REST inconsistency

**Severity: Low**

**Finding.** `/editor/venues/bulk/validate` etc. treat `bulk` as a
pseudo-resource under the venues collection. This is a common, pragmatic
pattern (not wrong), but it does technically collide with the
`/editor/venues/{venue_id}` route shape — a venue whose id happened to be
literally `bulk` would be unreachable. Current venue ids (`v00033` etc.) make
this practically impossible, but the spec never states the constraint that
prevents it.

**Resolution.** One sentence: "venue and destination ids must never collide
with a reserved path segment (`bulk`, `export`, `duplicates`)." Free to add,
closes a theoretical but real ambiguity.

---

## 5. Database model

### 5.1 See §2.1 (indexing) and §3.1 (region enforcement) above — not repeated here.

### 5.2 `beach_details` shape is validated only at the application layer

**Severity: Medium**

**Finding.** §6.3 requires the API/validation layer to reject a malformed
`beach_details` shape, but the column itself has no DB-level CHECK (unlike
`category`/`status`, which are DB-enforced). Any future direct-model write
that bypasses the validation function — including, notably, §10's own
migration script, which the spec itself insists must use "the platform's own
validation function" precisely because a parallel path could diverge — has
no database-level backstop if that discipline ever slips.

**Rationale.** The spec is internally aware of this exact risk class: §5.2
requires *"snapshots are never updated after insert... enforced at the
database level... not merely assumed by application discipline."** The same
standard is not applied to `beach_details`.

**Risk.** Low probability, given the migration explicitly reuses application
validation — but the inconsistency is the finding, not the immediate risk.

**Resolution.** Either add a Postgres CHECK constraint validating
`beach_details`'s two keys/value-domains when `category = 'Beach'`, or
explicitly note in §6.3 that this invariant is intentionally
application-only (with a stated reason) rather than leaving the asymmetry
unaddressed.

### 5.3 `PublishRevision.destination_count`/`venue_count` are redundant, not just "an exception"

**Severity: Low**

**Finding.** §2.5 justifies these two columns as *"an exception to §1.4...
there is no drift risk once written."* True — but the same snapshot row
already contains the full `destinations`/`venues` arrays in its `snapshot`
JSONB column. `len(snapshot['venues'])` is computable from data already
present in the same row, at zero additional query cost, with no join and no
extra storage.

**Rationale.** "No drift risk" is a defense against the wrong objection.
Principle 1.4 isn't only about drift — it's about not storing what's already
derivable. This is a case where "derivable in the very same row" is even
stronger than the usual "derivable via a query" standard the principle
already applies to statistics (§2.9).

**Resolution.** Drop both columns; compute revision-list counts as
`jsonb_array_length(snapshot->'venues')` at read time. Costs nothing at read
time given the row is already fetched; removes two columns and their
justification-as-exception.

### 5.4 See §3.1 above (region CHECK constraint) — the strongest database-model finding overall.

---

## 6. Workflow

### 6.1 Approve-time re-validation failure has no specified outcome

**Severity: Medium**

**Finding.** §4.2 states Approve re-checks validation "since state may have
changed since submission," but never specifies what happens **if it fails**.
Does the row stay in `review` with an error surfaced? Does it snap back to
`draft`? Is the approval call rejected with a 422, or does it silently
promote an invalid row?

**Rationale.** This is the one genuinely under-specified transition in an
otherwise well-specified state machine (§4.1–4.2 are otherwise a strong part
of the document).

**Risk.** Without a stated behavior, two implementations could diverge —
one silently approving an invalid row, another blocking it — from the same
"final" spec.

**Resolution.** One sentence: *"If re-validation fails at Approve time, the
call is rejected with 422 and the row remains in `review`; the approver must
have the reviewer request changes (§3.2's new reject-reason requirement)
before the row can proceed."*

### 6.2 No SLA/staleness signal for rows stuck in `review`

**Severity: Low**

Noted for completeness per this review's checklist; not a defect, a possible
future addition (a "days in review" indicator), correctly out of scope for
v1.

---

## 7. Editorial workflow

Covered above: concurrency (§2.3), rejection reason (§3.2), ownership (§3.3).
One additional finding specific to auditability:

### 7.1 Save Draft is unlogged — a real blind spot for multi-editor auditability

**Severity: Medium**

**Finding.** The current implementation (inherited, not re-examined by this
spec) deliberately does not log Save Draft to `activity_log` — only
workflow-transition actions (submit, approve, publish) are recorded. The spec
carries this forward silently rather than re-evaluating it against its own
stated multi-editor context.

**Rationale.** `activity_log` answers "who submitted/approved/published and
when" but not "who changed what, and when, while it was in draft." For a
single editor this is irrelevant. For the multiple-editor axis this review
was explicitly asked to test, it is a real gap: there is no way to
reconstruct what changed between two edits, or who made a specific factual
change that later needed correcting.

**Risk.** Grows directly with editor count — exactly the axis under test.

**Resolution.** Not necessarily "log every keystroke" — even a coarse
field-diff on each Save Draft, logged to `activity_log.metadata`, would close
most of the gap. At minimum, the spec should state this is a **known,
accepted limitation of v1** rather than passing over it silently, since
silence here reads as "not a gap" rather than "a deliberately deferred one."

---

## 8. Long-term maintenance

Synthesizing findings already detailed above, ranked by how likely each is to
be regretted:

| Rank | Item | Why it's the most likely regret |
|---|---|---|
| 1 | **No i18n primitive** (§2.2) | The data proving the need already exists *today* — this isn't speculative, it's already true and unaddressed |
| 2 | **No API versioning** (§4.1) | A "permanently frozen" API with no version escape hatch guarantees a painful first breaking change |
| 3 | **No concurrency control** (§2.3) | Silent data loss that gets *more* likely, not less, as the team the platform is presumably being built to scale toward actually grows |
| 4 | **`region` unconstrained** (§3.1) | The exact failure mode (`venues.destination` drift) that this spec was written specifically to fix, reappearing in a sibling field |
| 5 | **`legacy_geo` living permanently in the hot `venues` table** | One-time migration residue with no expiry, no archival plan, and no documented "safe to drop after N months" trigger — likely to become "that column nobody remembers the reason for" |

`legacy_geo`'s permanence deserves its own note: §2.2 marks it "Legacy-only,"
but the spec never states when, if ever, it can be dropped. A "drop after
migration is verified stable for N months" note would convert this from
permanent debt into a scheduled cleanup.

---

## 9. Simplicity

### 9.1 Unify the two single-field bulk endpoints

**Severity: Low**

`PATCH /editor/venues/bulk/category` and `PATCH /editor/venues/bulk/destination`
(§8.2) are structurally identical — a venue-id list plus one field to set.
**Resolution:** one `PATCH /editor/venues/bulk` accepting `{venue_ids: [...],
patch: {category?, destination_id?}}`, validated to touch only the fields the
bulk-update use case actually needs. Removes one endpoint, one schema, one
route handler, with no loss of capability.

### 9.2 Drop `PublishRevision.destination_count`/`venue_count`

Already covered in §5.3 — repeated here because it is also, independently, a
simplicity finding: two columns removable with a one-line read-time
computation.

### 9.3 Nothing else in the document is over-engineered

Worth stating plainly, since a review that only lists complaints risks
implying the whole document is weak: the JSONB-vs-table decisions (§3.4, §7.2
for region's *shape* if not its *enforcement*, `opening_hours`, `boundary`)
are each well-reasoned, each names its own promotion trigger, and none of
them invent infrastructure ahead of a real need. This is the document's
strongest section and survived this review's attempt to find fault with it
essentially unscathed.

---

## 10. Final Verdict

> ### **C — Requires architectural revision before implementation.**

**This is not a rejection of the document's direction or its overall
quality.** The entity model, the taxonomy resolution (§3), the beach model
(§6), and the publishing mechanics (§5, aside from 1.4) are well-reasoned and
mostly survive adversarial review intact. Section 9.3 above says so directly,
because a fair review has to.

**The verdict is C rather than B specifically because of the following four
findings, which are not polish:**

1. **§1.4 — the publish snapshot has no guaranteed referential closure
   between an approved venue and its destination.** This is a correctness
   gap in the platform's core publishing guarantee, not a style issue.
2. **§1.1 and §1.3 — the document's own contradiction-resolution section
   cites sections that don't exist, and defers a "final" decision (beach
   identity) to a document that doesn't exist yet.** A frozen specification
   cannot contain unresolved forward references to itself.
3. **§2.1 — no indexing strategy, despite the document explicitly being
   tested against (and by its own scope, targeting) 100,000-venue scale.**
4. **§2.3 — no concurrency control for simultaneous editors**, in a document
   whose entire premise is supporting an editorial team larger than the one
   that operated the legacy tool.

Each of these is a **small, well-scoped fix** — none require re-architecting
an entity, reworking the taxonomy, or redesigning the workflow. That is
exactly why this is C-with-a-narrow-path rather than a wholesale rejection:
the four items above, plus the High-severity i18n and API-versioning
findings (§2.2, §4.1), should be resolved as amendments to this same
document, not as a reason to restart it.

**Recommended path:** address the four Critical/High-blocking items above
plus §2.2 and §4.1, re-circulate the amended sections only (§0, §5.1, §8,
plus a new short "Indexing" and "Concurrency" note), and then freeze. This
review does not ask for a new document — it asks for this one to actually be
finished before it is declared final.
