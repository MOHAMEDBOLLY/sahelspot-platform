"""One-time legacy dataset import — `production_dataset_v19.json`.

Not a reusable import framework, not a new feature, not an API endpoint.
A standalone, direct-model script (same pattern as `scripts/seed.py`),
run once against the production database to bring in the legacy
DataLab dataset's destinations and venues. See
`docs/LEGACY_IMPORT_AUDIT_v19.md` for the full field-by-field audit this
implements, and `docs/LEGACY_IMPORT_RESULTS.md` for this script's actual
run output.

In scope: destinations, venues, social links, `legacy_geo`, the existing
editorial fields the audit marked "Direct mapping" or "Needs
transformation". Out of scope, deliberately: beaches (no ID/slug/
coordinates in the source — see the audit), cover images and gallery
(legacy `coverUrl` values are on-disk paths, not fetchable URLs).

Usage:
    python scripts/import_legacy_dataset.py --dry-run <path-to-json>
    python scripts/import_legacy_dataset.py --apply   <path-to-json>

Matching order (never rely on the legacy `id` alone — see the audit's
"Existing Data Strategy" section for why this exact order):
    1. slug            (destination: legacy slug == our id; venue: (destination_id, vslug))
    2. Google Maps URL  (venue only — destinations have no mapsUrl field)
    3. name + destination
    4. coordinates      (exact lat/lng match)
A record that matches nothing at any tier is new. A record that matches
is only ever *enriched* — a field is written only when the existing row's
value is currently null/empty, never overwritten if already set. Status
and region on an existing destination are never touched by this script,
under any circumstance.

Everything runs inside one transaction. `--dry-run` never calls
`session.add()` at all (not just "adds then rolls back" — the objects
that would be inserted are never constructed as pending session state),
so there is no path by which a dry run can leave anything behind even
under a partial failure. `--apply` commits only if every validation
check across the entire dataset passes; a single unmapped region, or any
other validation error, aborts the whole run before a single row is
written — see `docs/LEGACY_IMPORT_AUDIT_v19.md`'s Import Plan, "never
leave the database partially imported."
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import DESTINATION_REGIONS, VENUE_CATEGORIES, Destination, Venue
from app.db.session import SessionLocal

# ---------------------------------------------------------------------------
# Explicit, human-curated destination -> region mapping. Deliberately not
# inferred at runtime, and deliberately incomplete: only slugs this script
# can point to concrete evidence for are listed (an exact string match
# against one of the 8 canonical DESTINATION_REGIONS values, or — for
# `marassi` — the value already live in production, seeded independently
# of this import). Every other legacy destination is well-known real North
# Coast geography, but "well-known" is still a guess this script was
# explicitly told not to make. Add the remaining slugs here, each mapped
# to one of DESTINATION_REGIONS, once a real decision is made — the import
# will refuse to run (see `_validate_regions`) until every destination in
# the source file has an entry.
# ---------------------------------------------------------------------------
REGION_MAP: dict[str, str] = {
    "marassi": "Sidi Abdelrahman Area",  # matches the existing production row
    "almaza-bay": "Almaza Bay",  # exact name match
    "fouka-bay": "Fouka Bay",  # exact name match
    "mountain-view-ras-el-hekma": "Ras El Hekma",  # name contains the exact region
    "new-alamein": "New Alamein City",  # destination's own `name` is "New Alamein City"
    "dabaa-city": "Dabaa City",  # exact name match
    "telal": "Telal North Coast",  # destination's own `name` is "Telal North Coast"
    "marina": "Marina",  # exact name match
}

# PLATFORM_SPEC_v1.0_FROZEN.md §7.3 / the audit's §2.4 — the only two
# legacy category strings that don't already equal a value in
# VENUE_CATEGORIES verbatim. Every other legacy category is used as-is.
CATEGORY_MAP: dict[str, str] = {"Café": "Cafe", "Service": "Services"}

# Provenance only (`venues.source` has no CHECK, no meaning to the
# platform) — lets a future human tell an imported row apart from one
# created through Studio, without touching any editorial field.
IMPORT_SOURCE = "legacy-import-v19"


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


@dataclass
class Report:
    new_destinations: list[str] = field(default_factory=list)
    new_venues: list[str] = field(default_factory=list)
    updated_destinations: list[tuple[str, dict]] = field(default_factory=list)
    updated_venues: list[tuple[str, dict]] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    aborted: bool = False
    elapsed_seconds: float = 0.0

    def print(self, *, mode: str) -> None:
        print(f"\n=== Legacy import report ({mode}) ===")
        if self.aborted:
            print("\nABORTED — no rows were written. Fix the errors below and re-run.")
        print(f"\nNew destinations ({len(self.new_destinations)}):")
        for name in self.new_destinations:
            print(f"  + {name}")
        print(f"\nNew venues ({len(self.new_venues)}):")
        for name in self.new_venues[:20]:
            print(f"  + {name}")
        if len(self.new_venues) > 20:
            print(f"  ... and {len(self.new_venues) - 20} more")
        print(f"\nUpdated destinations ({len(self.updated_destinations)}):")
        for name, diff in self.updated_destinations:
            print(f"  ~ {name}: {diff}")
        print(f"\nUpdated venues ({len(self.updated_venues)}):")
        for name, diff in self.updated_venues:
            print(f"  ~ {name}: {diff}")
        print(f"\nSkipped ({len(self.skipped)}):")
        for s in self.skipped:
            print(f"  - {s}")
        print(f"\nWarnings ({len(self.warnings)}):")
        for w in self.warnings:
            print(f"  ! {w}")
        print(f"\nErrors ({len(self.errors)}):")
        for e in self.errors:
            print(f"  x {e}")
        print(f"\nElapsed: {self.elapsed_seconds:.2f}s")


# ---------------------------------------------------------------------------
# Normalization — deliberately minimal. Only what the task authorized:
# trim strings, normalize URLs/phone numbers (whitespace only — no
# reformatting, no invented country codes), and the category conversion
# above. Nothing here touches editorial meaning.
# ---------------------------------------------------------------------------


def _norm_str(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _norm_category(raw: str) -> str:
    return CATEGORY_MAP.get(raw, raw)


def _norm_decimal(value: float | None) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value)).quantize(Decimal("0.000001"))
    except InvalidOperation:
        return None


# ---------------------------------------------------------------------------
# Validation — runs over the *entire* dataset before anything else. Any
# error found here aborts the whole run; nothing partial is ever written.
# ---------------------------------------------------------------------------


def _validate(data: dict, report: Report) -> bool:
    ok = True

    missing_regions = [d["slug"] for d in data["destinations"] if d["slug"] not in REGION_MAP]
    if missing_regions:
        for slug in missing_regions:
            dest = next(d for d in data["destinations"] if d["slug"] == slug)
            report.errors.append(
                f"destination '{slug}' ({dest['name']!r}, {dest['venueCount']} venues) "
                f"has no REGION_MAP entry — add one of {DESTINATION_REGIONS} before re-running"
            )
        ok = False

    dest_slugs = {d["slug"] for d in data["destinations"]}
    for v in data["venues"]:
        if v["destSlug"] not in dest_slugs:
            report.errors.append(f"venue '{v['id']}' references unknown destSlug '{v['destSlug']}'")
            ok = False
        category = _norm_category(v["category"])
        if category not in VENUE_CATEGORIES:
            report.errors.append(f"venue '{v['id']}' has unmappable category '{v['category']}'")
            ok = False

    return ok


# ---------------------------------------------------------------------------
# Matching — the 4-tier order from the audit. Read-only.
# ---------------------------------------------------------------------------


def _match_destination(db: Session, legacy_slug: str) -> Destination | None:
    return db.get(Destination, legacy_slug)


def _match_venue(db: Session, legacy: dict, destination_id: str) -> Venue | None:
    # 1. slug, scoped to the resolved destination
    existing = db.execute(
        select(Venue).where(Venue.destination_id == destination_id, Venue.slug == legacy["vslug"])
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    # 2. Google Maps URL
    if legacy.get("mapsUrl"):
        existing = db.execute(select(Venue).where(Venue.maps_url == legacy["mapsUrl"])).scalar_one_or_none()
        if existing is not None:
            return existing

    # 3. name + destination (case-insensitive)
    existing = db.execute(
        select(Venue).where(
            Venue.destination_id == destination_id,
            Venue.name.ilike(legacy["name"]),
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    # 4. coordinates (last resort — see the audit for why this is weakest)
    lat, lng = _norm_decimal(legacy.get("lat")), _norm_decimal(legacy.get("lng"))
    if lat is not None and lng is not None:
        existing = db.execute(
            select(Venue).where(Venue.latitude == lat, Venue.longitude == lng)
        ).scalar_one_or_none()
        if existing is not None:
            return existing

    return None


def _enrich(obj: object, attr: str, new_value, diff: dict) -> None:
    """Only ever fills a currently-empty field. Never overwrites a value
    that's already set — the "never downgrade production data" rule.
    """
    if new_value in (None, "", [], {}):
        return
    current = getattr(obj, attr)
    if current in (None, "", [], {}):
        setattr(obj, attr, new_value)
        diff[attr] = new_value


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


def run_import(db: Session, data: dict, *, apply: bool) -> Report:
    report = Report()
    started = time.monotonic()

    beach_count = len(data.get("beaches", []))
    if beach_count:
        report.skipped.append(f"{beach_count} beaches — deferred, out of scope (no id/slug/coordinates in source)")

    if not _validate(data, report):
        report.aborted = True
        report.elapsed_seconds = time.monotonic() - started
        return report

    # --- destinations ---
    dest_id_by_slug: dict[str, str] = {}
    for legacy in data["destinations"]:
        slug = legacy["slug"]
        existing = _match_destination(db, slug)
        if existing is None:
            dest = Destination(
                id=slug,
                name=_norm_str(legacy["name"]) or slug,
                region=REGION_MAP[slug],
                status="draft",
                boundary=legacy.get("boundary"),
                notes=_norm_str(legacy.get("shortDesc")),
                cover_image_url=_norm_str(legacy.get("coverUrl")) if _is_real_url(legacy.get("coverUrl")) else None,
            )
            report.new_destinations.append(f"{slug} ({legacy['name']})")
            if apply:
                db.add(dest)
            dest_id_by_slug[slug] = slug
        else:
            diff: dict = {}
            _enrich(existing, "boundary", legacy.get("boundary"), diff)
            _enrich(existing, "notes", _norm_str(legacy.get("shortDesc")), diff)
            if _is_real_url(legacy.get("coverUrl")):
                _enrich(existing, "cover_image_url", _norm_str(legacy.get("coverUrl")), diff)
            # region/status are never touched for an existing row, full stop.
            if diff:
                report.updated_destinations.append((f"{slug} ({legacy['name']})", diff))
            else:
                report.skipped.append(f"destination '{slug}' — already up to date, nothing to enrich")
            dest_id_by_slug[slug] = existing.id

    # --- venues ---
    for legacy in data["venues"]:
        destination_id = dest_id_by_slug[legacy["destSlug"]]
        existing = _match_venue(db, legacy, destination_id)
        category = _norm_category(legacy["category"])

        if existing is None:
            venue = Venue(
                id=legacy["id"],
                name=_norm_str(legacy["name"]) or legacy["id"],
                slug=legacy["vslug"],
                destination_id=destination_id,
                district=_norm_str(legacy.get("district")),
                category=category,
                status="draft",
                latitude=_norm_decimal(legacy.get("lat")),
                longitude=_norm_decimal(legacy.get("lng")),
                phone=_norm_str(legacy.get("phone")),
                whatsapp=_norm_str(legacy.get("whatsapp")),
                website=_norm_str(legacy.get("website")),
                maps_url=_norm_str(legacy.get("mapsUrl")),
                instagram_handle=_norm_str(legacy.get("instagram")),
                facebook_handle=_norm_str(legacy.get("facebook")),
                tiktok_handle=_norm_str(legacy.get("tiktok")),
                short_description=_norm_str(legacy.get("shortDesc")),
                legacy_geo=legacy.get("geo"),
                source=IMPORT_SOURCE,
            )
            report.new_venues.append(f"{legacy['id']} ({legacy['name']})")
            if apply:
                db.add(venue)
        else:
            diff = {}
            _enrich(existing, "district", _norm_str(legacy.get("district")), diff)
            _enrich(existing, "phone", _norm_str(legacy.get("phone")), diff)
            _enrich(existing, "whatsapp", _norm_str(legacy.get("whatsapp")), diff)
            _enrich(existing, "website", _norm_str(legacy.get("website")), diff)
            _enrich(existing, "maps_url", _norm_str(legacy.get("mapsUrl")), diff)
            _enrich(existing, "instagram_handle", _norm_str(legacy.get("instagram")), diff)
            _enrich(existing, "facebook_handle", _norm_str(legacy.get("facebook")), diff)
            _enrich(existing, "tiktok_handle", _norm_str(legacy.get("tiktok")), diff)
            _enrich(existing, "short_description", _norm_str(legacy.get("shortDesc")), diff)
            _enrich(existing, "legacy_geo", legacy.get("geo"), diff)
            if diff:
                report.updated_venues.append((f"{legacy['id']} ({legacy['name']})", diff))
            else:
                report.skipped.append(f"venue '{legacy['id']}' — already up to date, nothing to enrich")

    if legacy_facebook_or_tiktok_are_urls(data):
        report.warnings.append(
            "facebook_handle/tiktok_handle were imported as full URLs (not bare handles) — "
            "the source data itself stores full URLs; no handle-extraction was in the "
            "authorized normalization list, so values were preserved as-is. Review manually."
        )
    unresolvable_covers = sum(1 for v in data["venues"] if v.get("coverUrl") and not _is_real_url(v["coverUrl"]))
    if unresolvable_covers:
        report.warnings.append(
            f"{unresolvable_covers} venue(s) have a legacy coverUrl that is a local path, not a "
            "fetchable URL — left unset. Cover image migration is out of scope for this import."
        )

    report.elapsed_seconds = time.monotonic() - started

    if apply:
        db.commit()
    else:
        db.rollback()

    return report


def _is_real_url(value: str | None) -> bool:
    return bool(value) and value.startswith(("http://", "https://"))


def legacy_facebook_or_tiktok_are_urls(data: dict) -> bool:
    return any(
        (v.get("facebook") and v["facebook"].startswith("http"))
        or (v.get("tiktok") and v["tiktok"].startswith("http"))
        for v in data["venues"]
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="validate, match, normalize — write nothing")
    mode.add_argument("--apply", action="store_true", help="perform the real import")
    parser.add_argument("path", help="path to the legacy dataset JSON file")
    args = parser.parse_args()

    with open(args.path, encoding="utf-8") as f:
        data = json.load(f)

    db = SessionLocal()
    try:
        report = run_import(db, data, apply=args.apply)
    finally:
        db.close()

    report.print(mode="APPLY" if args.apply else "DRY RUN")

    if report.aborted or report.errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
