"""External Data Enrichment Workflow (Phase 1) — parsing external
research files into plain dicts. Deliberately source-agnostic: nothing
here is iSahel-specific, no filename or "source" value is ever checked
by name. Two shapes are supported, matching how a research dataset
actually arrives in two parts:

- "detail" rows: one full external venue record per row (name, category,
  destination, description, amenities, images, booking info, ...).
- "match" rows: a matching-candidate overlay keyed by (source name),
  produced by whatever external process attempted to line the detail
  rows up against existing Studio venues (candidate venue id, a
  confidence label, optional operator notes).

Both accept CSV or JSON. "Match" rows may also arrive as an .xlsx
workbook — parsed here with the stdlib only (`zipfile` + `xml.etree`,
no `openpyxl`/`pandas` dependency added), reading whichever sheet name
is passed in (default "All Review").
"""

from __future__ import annotations

import csv
import io
import json
import zipfile
from xml.etree import ElementTree as ET

_XLSX_NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def _split_list(value: str | None) -> list[str]:
    """Amenities/image URLs arrive `;`-joined in CSV, already a JSON array
    in JSON. Empty/missing means an empty list, not `None` — external
    research simply not mentioning amenities isn't meaningfully different
    from an explicit empty list for this workflow's purposes."""
    if not value:
        return []
    return [part.strip() for part in value.split(";") if part.strip()]


def parse_detail_rows(content: bytes, filename: str) -> list[dict]:
    """Parses one "detail" file (rich per-venue external record) into a
    list of plain dicts with normalized keys. Accepts `.csv` or `.json`
    by file extension."""
    if filename.lower().endswith(".json"):
        rows = json.loads(content.decode("utf-8"))
    else:
        rows = list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))

    normalized = []
    for row in rows:
        amenities = row.get("amenities") or []
        if isinstance(amenities, str):
            amenities = _split_list(amenities)
        images = row.get("image_urls") or []
        if isinstance(images, str):
            images = _split_list(images)
        normalized.append(
            {
                "source": row.get("source"),
                "source_url": row.get("source_url") or None,
                "external_name": row.get("name"),
                "external_category": row.get("category") or None,
                "external_destination": row.get("destination") or None,
                "external_description": row.get("description") or None,
                "external_amenities": amenities,
                "external_maps_url": row.get("google_maps_url") or None,
                "external_booking_type": row.get("booking_type") or None,
                "external_booking_url": row.get("booking_url") or None,
                "external_image_urls": images,
                "source_review_status": row.get("review_status") or None,
                "raw_row": row,
            }
        )
    return normalized


# A pre-computed match overlay's confidence label isn't always the exact
# four-value vocabulary this app stores (`HIGH`/`MEDIUM`/`LOW` on
# `ExternalRecord.match_confidence`, `MATCH_CONFIRMED`/`MATCH_PROBABLE`/
# `REVIEW_REQUIRED`/`NO_MATCH` on `match_status`) — an external process is
# free to phrase its own labels however it likes (e.g. "POSSIBLE",
# "REVIEW / NO CLEAR MATCH"). This table is the one place that
# vocabulary gets normalized; add a row here for a new source's label
# style rather than teaching the parser new source-specific logic.
_CONFIDENCE_LABEL_MAP: dict[str, tuple[str, str | None]] = {
    "HIGH": ("MATCH_CONFIRMED", "HIGH"),
    "MEDIUM": ("MATCH_PROBABLE", "MEDIUM"),
    "POSSIBLE": ("REVIEW_REQUIRED", "LOW"),
}


def normalize_match_confidence(raw_label: str | None) -> tuple[str, str | None]:
    """Returns `(match_status, match_confidence)` for a raw label from a
    match overlay file. Anything not recognized (including no label at
    all) is `NO_MATCH`/`None` — the safe default when a source's
    confidence phrasing is unfamiliar, never guessed into a more
    confident bucket than the data actually supports."""
    if not raw_label:
        return "NO_MATCH", None
    return _CONFIDENCE_LABEL_MAP.get(raw_label.strip().upper(), ("NO_MATCH", None))


def parse_match_rows_csv(content: bytes) -> list[dict]:
    return list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))


def _xlsx_col_to_idx(cell_ref: str) -> int:
    letters = "".join(c for c in cell_ref if c.isalpha())
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch.upper()) - ord("A") + 1)
    return idx - 1


def parse_match_rows_xlsx(content: bytes, sheet_name: str = "All Review") -> list[dict]:
    """Minimal stdlib-only .xlsx reader (no `openpyxl`/`pandas` dependency
    added for one workbook read) — an xlsx is a zip of XML; this reads
    just enough of it (sheet list, inline/shared cell values) to recover
    plain rows. Handles inline strings (`<is><t>`) directly; falls back
    to `xl/sharedStrings.xml` if the workbook uses that form instead."""
    z = zipfile.ZipFile(io.BytesIO(content))

    workbook = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rel_ns = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
    target_by_rid = {
        rel.get("Id"): rel.get("Target").lstrip("/") for rel in rels.findall("r:Relationship", rel_ns)
    }

    sheet_target = None
    for sheet in workbook.findall(".//a:sheets/a:sheet", _XLSX_NS):
        if sheet.get("name") == sheet_name:
            rid = sheet.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            sheet_target = target_by_rid.get(rid)
            break
    if sheet_target is None:
        raise ValueError(f"Sheet '{sheet_name}' not found in workbook")

    shared_strings: list[str] = []
    if "xl/sharedStrings.xml" in z.namelist():
        shared_root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in shared_root.findall("a:si", _XLSX_NS):
            shared_strings.append("".join(t.text or "" for t in si.findall(".//a:t", _XLSX_NS)))

    sheet_root = ET.fromstring(z.read(sheet_target if sheet_target.startswith("xl/") else f"xl/{sheet_target}"))
    rows: list[list[str]] = []
    for row_el in sheet_root.findall(".//a:sheetData/a:row", _XLSX_NS):
        cells: dict[int, str] = {}
        for c in row_el.findall("a:c", _XLSX_NS):
            idx = _xlsx_col_to_idx(c.get("r"))
            is_el = c.find("a:is", _XLSX_NS)
            v_el = c.find("a:v", _XLSX_NS)
            if is_el is not None:
                t_el = is_el.find("a:t", _XLSX_NS)
                value = t_el.text if t_el is not None else ""
            elif v_el is not None and c.get("t") == "s":
                value = shared_strings[int(v_el.text)]
            elif v_el is not None:
                value = v_el.text
            else:
                value = ""
            cells[idx] = value or ""
        if cells:
            width = max(cells.keys()) + 1
            rows.append([cells.get(i, "") for i in range(width)])

    if not rows:
        return []
    header = rows[0]
    return [dict(zip(header, row)) for row in rows[1:]]
