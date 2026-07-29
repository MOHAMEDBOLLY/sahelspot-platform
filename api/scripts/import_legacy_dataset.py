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
    # optional: --region-map <path>, defaults to
    # api/data/legacy_destination_regions.json next to this script.

Matching order (never rely on the legacy `id` alone — see the audit's
"Existing Data Strategy" section for why this exact order):
    1. slug            (destination: legacy slug == our id; venue: (destination_id, vslug))
    2. Google Maps URL  (venue only — destinations have no mapsUrl field)
    3. name + destination
    4. coordinates      (exact lat/lng match)
A record that matches nothing at any tier is new.

A record that *does* match is synchronized deterministically, but only
for the fields in `DESTINATION_SYNC_FIELDS`/`VENUE_SYNC_FIELDS` below —
an explicit whitelist of editorial content this import is actually
responsible for, always set to the (normalized) legacy value regardless
of what's currently there. Everything outside that whitelist —
`status`, `region`, `version`, every timestamp, and any column this
import was never told to touch — is administrative/system-managed and
is never written to an existing row under any circumstance, matched or
not. (`region` is the one field set at *creation* time for a brand-new
destination, since the column is `NOT NULL` — but never re-synced once
a destination exists.)

Everything runs inside one transaction. `--dry-run` never calls
`session.add()` at all (not just "adds then rolls back" — the objects
that would be inserted are never constructed as pending session state),
so there is no path by which a dry run can leave anything behind even
under a partial failure. `--apply` commits only if every validation
check across the entire dataset passes; a single unmapped region, or
any other validation error, aborts the whole run before a single row is
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
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import DESTINATION_REGIONS, VENUE_CATEGORIES, Destination, Venue
from app.db.session import SessionLocal

DEFAULT_REGION_MAP_PATH = Path(__file__).resolve().parent.parent / "data" / "legacy_destination_regions.json"

# PLATFORM_SPEC_v1.0_FROZEN.md §7.3 / the audit's §2.4 — the only two
# legacy category strings that don't already equal a value in
# VENUE_CATEGORIES verbatim. Every other legacy category is used as-is.
CATEGORY_MAP: dict[str, str] = {"Café": "Cafe", "Service": "Services"}

# Provenance only (`venues.source` has no CHECK, no meaning to the
# platform) — lets a future human tell an imported row apart from one
# created through Studio. Set at creation only, never re-synced (it's
# not "editorial content", it's a one-time creation fact).
IMPORT_SOURCE = "legacy-import-v19"

# ---------------------------------------------------------------------------
# Explicit sync whitelist. Everything listed here is editorial content
# within this import's scope, and is overwritten deterministically on a
# matched row — the legacy (normalized) value always wins, regardless of
# what the existing row currently has. Everything NOT listed — id, slug,
# destination_id, status, region, version, source, created_at,
# updated_at, last_published_at, and every field this import was told is
# out of scope (cover_image_url on venues, gallery_image_urls,
# beach_details, opening_hours, internal_notes, translations,
# is_featured, is_verified) — is never written to an existing row.
# ---------------------------------------------------------------------------
DESTINATION_SYNC_FIELDS: tuple[str, ...] = ("name", "boundary", "notes", "cover_image_url")
VENUE_SYNC_FIELDS: tuple[str, ...] = (
    "name",
    "district",
    "category",
    "latitude",
    "longitude",
    "phone",
    "whatsapp",
    "website",
    "maps_url",
    "instagram_handle",
    "facebook_handle",
    "tiktok_handle",
    "short_description",
    "legacy_geo",
)


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
# Region map — loaded from a standalone JSON file, not the Python source.
# Deliberately not inferred at runtime, and deliberately allowed to be
# incomplete: `_validate` aborts the entire run (before anything else
# happens) if any destination in the source dataset has no entry here.
# ---------------------------------------------------------------------------


def _load_json_file(path: Path, *, description: str) -> dict | list:
    """Every JSON file this script reads goes through here, so a missing
    file or malformed JSON produces one clear, actionable line — not a
    raw traceback — and exits cleanly before any database work starts.
    """
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"ERROR: {description} not found: {path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"ERROR: {description} at {path} is not valid JSON: {exc}", file=sys.stderr)
        sys.exit(1)
    except OSError as exc:
        print(f"ERROR: could not read {description} at {path}: {exc}", file=sys.stderr)
        sys.exit(1)


def load_region_map(path: Path) -> dict[str, str]:
    raw = _load_json_file(path, description="region map file")
    return {slug: region for slug, region in raw.items() if not slug.startswith("_")}


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


def _is_real_url(value: str | None) -> bool:
    return bool(value) and value.startswith(("http://", "https://"))


def _legacy_destination_values(legacy: dict) -> dict:
    """Normalized legacy values for exactly `DESTINATION_SYNC_FIELDS`."""
    cover = legacy.get("coverUrl")
    return {
        "name": _norm_str(legacy["name"]) or legacy["slug"],
        "boundary": legacy.get("boundary"),
        "notes": _norm_str(legacy.get("shortDesc")),
        "cover_image_url": _norm_str(cover) if _is_real_url(cover) else None,
    }


def _legacy_venue_values(legacy: dict, *, category: str) -> dict:
    """Normalized legacy values for exactly `VENUE_SYNC_FIELDS`."""
    return {
        "name": _norm_str(legacy["name"]) or legacy["id"],
        "district": _norm_str(legacy.get("district")),
        "category": category,
        "latitude": _norm_decimal(legacy.get("lat")),
        "longitude": _norm_decimal(legacy.get("lng")),
        "phone": _norm_str(legacy.get("phone")),
        "whatsapp": _norm_str(legacy.get("whatsapp")),
        "website": _norm_str(legacy.get("website")),
        "maps_url": _norm_str(legacy.get("mapsUrl")),
        "instagram_handle": _norm_str(legacy.get("instagram")),
        "facebook_handle": _norm_str(legacy.get("facebook")),
        "tiktok_handle": _norm_str(legacy.get("tiktok")),
        "short_description": _norm_str(legacy.get("shortDesc")),
        "legacy_geo": legacy.get("geo"),
    }


# ---------------------------------------------------------------------------
# Validation — runs over the *entire* dataset before anything else. Any
# error found here aborts the whole run; nothing partial is ever written.
# ---------------------------------------------------------------------------


def _validate(data: dict, region_map: dict[str, str], report: Report) -> bool:
    ok = True

    for d in data["destinations"]:
        slug = d["slug"]
        if slug not in region_map:
            report.errors.append(
                f"destination '{slug}' ({d['name']!r}, {d['venueCount']} venues) "
                f"has no region-map entry — add one of {DESTINATION_REGIONS} to the region "
                f"map file before re-running"
            )
            ok = False
        elif region_map[slug] not in DESTINATION_REGIONS:
            report.errors.append(
                f"destination '{slug}' is mapped to {region_map[slug]!r} in the region map, "
                f"which is not one of {DESTINATION_REGIONS} — fix the region map file before re-running"
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
    # 1. slug, scoped to the resolved destination — DB-constraint-backed
    # (uq_venues_destination_id_slug), so at most one row can ever match.
    existing = db.execute(
        select(Venue).where(Venue.destination_id == destination_id, Venue.slug == legacy["vslug"])
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    # 2-4 below have no such uniqueness guarantee — the source data itself
    # has dozens of venues sharing one Google Maps URL (a shared pin for
    # multiple businesses at one address), duplicate name+destination pairs,
    # and duplicate coordinates (see the audit). `_first_match` picks the
    # lowest-id candidate deterministically rather than raising when more
    # than one row matches.

    # 2. Google Maps URL
    if legacy.get("mapsUrl"):
        existing = _first_match(db, select(Venue).where(Venue.maps_url == legacy["mapsUrl"]))
        if existing is not None:
            return existing

    # 3. name + destination (case-insensitive)
    existing = _first_match(
        db,
        select(Venue).where(
            Venue.destination_id == destination_id,
            Venue.name.ilike(legacy["name"]),
        ),
    )
    if existing is not None:
        return existing

    # 4. coordinates (last resort — see the audit for why this is weakest)
    lat, lng = _norm_decimal(legacy.get("lat")), _norm_decimal(legacy.get("lng"))
    if lat is not None and lng is not None:
        existing = _first_match(db, select(Venue).where(Venue.latitude == lat, Venue.longitude == lng))
        if existing is not None:
            return existing

    return None


def _first_match(db: Session, stmt) -> Venue | None:
    """Same intent as `scalar_one_or_none()`, but never raises on more
    than one match — picks the lowest-id candidate deterministically.
    Only safe to use where "more than one plausible match" is a real,
    expected possibility (tiers 2-4 above), never as a substitute for an
    actual uniqueness guarantee (tier 1 keeps `scalar_one_or_none()`).
    """
    return db.execute(stmt.order_by(Venue.id).limit(1)).scalars().first()


def _sync_whitelisted_fields(obj: object, whitelist: tuple[str, ...], values: dict, diff: dict) -> None:
    """Deterministically sets every whitelisted field to its (normalized)
    legacy value, unconditionally — not gated on the field currently
    being empty. Anything not in `whitelist` is never touched, no matter
    what. `diff` only records fields whose value actually changed, for
    reporting.
    """
    for attr in whitelist:
        new_value = values[attr]
        if getattr(obj, attr) != new_value:
            setattr(obj, attr, new_value)
            diff[attr] = new_value


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


def run_import(db: Session, data: dict, region_map: dict[str, str], *, apply: bool) -> Report:
    report = Report()
    started = time.monotonic()

    beach_count = len(data.get("beaches", []))
    if beach_count:
        report.skipped.append(f"{beach_count} beaches — deferred, out of scope (no id/slug/coordinates in source)")

    if not _validate(data, region_map, report):
        report.aborted = True
        report.elapsed_seconds = time.monotonic() - started
        return report

    # --- destinations ---
    dest_id_by_slug: dict[str, str] = {}
    for legacy in data["destinations"]:
        slug = legacy["slug"]
        values = _legacy_destination_values(legacy)
        existing = _match_destination(db, slug)
        if existing is None:
            dest = Destination(
                id=slug,
                region=region_map[slug],
                status="draft",
                **values,
            )
            report.new_destinations.append(f"{slug} ({legacy['name']})")
            if apply:
                db.add(dest)
            dest_id_by_slug[slug] = slug
        else:
            diff: dict = {}
            _sync_whitelisted_fields(existing, DESTINATION_SYNC_FIELDS, values, diff)
            # status/region/version/timestamps: administrative/system-managed,
            # never written to an existing row, full stop.
            if diff:
                report.updated_destinations.append((f"{slug} ({legacy['name']})", diff))
            else:
                report.skipped.append(f"destination '{slug}' — already in sync")
            dest_id_by_slug[slug] = existing.id

    # --- venues ---
    for legacy in data["venues"]:
        destination_id = dest_id_by_slug[legacy["destSlug"]]
        category = _norm_category(legacy["category"])
        values = _legacy_venue_values(legacy, category=category)
        existing = _match_venue(db, legacy, destination_id)

        if existing is None:
            venue = Venue(
                id=legacy["id"],
                slug=legacy["vslug"],
                destination_id=destination_id,
                status="draft",
                source=IMPORT_SOURCE,
                **values,
            )
            report.new_venues.append(f"{legacy['id']} ({legacy['name']})")
            if apply:
                db.add(venue)
        else:
            diff = {}
            _sync_whitelisted_fields(existing, VENUE_SYNC_FIELDS, values, diff)
            # status/version/timestamps/source and every out-of-scope field
            # (cover_image_url, gallery_image_urls, beach_details,
            # opening_hours, internal_notes, translations, is_featured,
            # is_verified): never written to an existing row.
            if diff:
                report.updated_venues.append((f"{legacy['id']} ({legacy['name']})", diff))
            else:
                report.skipped.append(f"venue '{legacy['id']}' — already in sync")

    if _any_facebook_or_tiktok_is_url(data):
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


def _any_facebook_or_tiktok_is_url(data: dict) -> bool:
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
    parser.add_argument(
        "--region-map",
        default=str(DEFAULT_REGION_MAP_PATH),
        help=f"path to the destination-slug -> region JSON file (default: {DEFAULT_REGION_MAP_PATH})",
    )
    args = parser.parse_args()

    data = _load_json_file(Path(args.path), description="dataset file")
    region_map = load_region_map(Path(args.region_map))

    db = SessionLocal()
    try:
        report = run_import(db, data, region_map, apply=args.apply)
    finally:
        db.close()

    report.print(mode="APPLY" if args.apply else "DRY RUN")

    if report.aborted or report.errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
