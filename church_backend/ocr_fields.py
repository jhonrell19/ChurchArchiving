"""Conservative, template-oriented OCR text parsing for Smart Parish.

This module produces *suggestions*, never verified sacramental facts.  It only
extracts values beside recognized labels (or on the immediately following
line), to avoid inventing records from arbitrary prose.  Staff must review and
correct the result before saving an archive document.
"""
from __future__ import annotations

from datetime import datetime
import re
from typing import Any

MAX_TEXT_CHARS = 30000

# Anchored labels avoid accidentally treating a heading as a person name.
LABELS: dict[str, tuple[str, ...]] = {
    "child_name": (r"name\s+of\s+(?:the\s+)?child", r"child(?:'?s)?\s+(?:full\s+)?name", r"name\s+of\s+(?:the\s+)?(?:person\s+)?bapti[sz]ed", r"full\s+name"),
    "date_of_baptism": (r"date\s+of\s+bapti[sz]m", r"bapti[sz]m\s+date", r"bapti[sz]ed\s+on"),
    "date_of_confirmation": (r"date\s+of\s+confirmation", r"confirmation\s+date", r"confirmed\s+on"),
    "date_of_birth": (r"date\s+of\s+birth", r"birth\s+date", r"born\s+on"),
    "place_of_birth": (r"place\s+of\s+birth", r"birth\s+place", r"born\s+at"),
    "father_name": (r"(?:name\s+of\s+)?father(?:'?s)?(?:\s+name)?",),
    "mother_name": (r"(?:name\s+of\s+)?mother(?:'?s)?(?:\s+(?:maiden\s+)?name)?",),
    "address": (r"(?:home\s+|residential\s+)?address", r"residence"),
    "contact_number": (r"contact\s*(?:no\.?|number|#)", r"(?:mobile|telephone|phone)\s*(?:no\.?|number|#)?"),
    "sponsors": (r"sponsors?", r"godparents?", r"ninong\s*(?:and|&)\s*ninang"),
    "husband_name": (r"(?:full\s+)?name\s+of\s+(?:the\s+)?(?:husband|groom)", r"(?:husband|groom)(?:'?s)?\s+(?:full\s+)?name"),
    "wife_name": (r"(?:full\s+)?name\s+of\s+(?:the\s+)?(?:wife|bride)", r"(?:wife|bride)(?:'?s)?\s+(?:full\s+)?name"),
    "date_of_marriage": (r"date\s+of\s+marriage", r"marriage\s+date", r"married\s+on"),
    "place_of_marriage": (r"place\s+of\s+marriage", r"marriage\s+place", r"married\s+at"),
    "witnesses": (r"witnesses?",),
    "parish": (r"parish\s+of", r"(?:name\s+of\s+)?parish",),
    "priest": (r"(?:officiating\s+)?(?:priest|minister|reverend|rev\.)",),
}

_DATE_KEYS = {"date_of_baptism", "date_of_confirmation", "date_of_birth", "date_of_marriage"}


def parse_date(value: str) -> str:
    """Return ISO date only if format is unambiguous; ambiguous dates require review."""
    value = re.sub(r"\s+", " ", value).strip().strip('.,;')
    for fmt in ("%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%d %b %Y", "%B %d %Y", "%b %d %Y"):
        try:
            parsed = datetime.strptime(value, fmt)
            if 1800 <= parsed.year <= datetime.today().year:
                return parsed.strftime("%Y-%m-%d")
        except ValueError:
            pass
    match = re.fullmatch(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", value)
    if match:
        a, b, year = map(int, match.groups())
        if a <= 12 and b <= 12:  # 03/04/2025 is ambiguous: reject, don't guess
            return ""
        if a > 12 and b <= 12:
            day, month = a, b  # PH day-first
        elif b > 12 and a <= 12:
            day, month = b, a
        else:
            return ""
        try:
            return datetime(year, month, day).strftime("%Y-%m-%d")
        except ValueError:
            return ""
    return ""


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" \t,:;|-#")[:180]


def _looks_like_label(value: str) -> bool:
    for variants in LABELS.values():
        if any(re.fullmatch(rf"\s*(?:{label})\s*:?\s*", value, re.I) for label in variants):
            return True
    return bool(re.fullmatch(r"(?:RECORD REFERENCE|REGISTRY VOLUME / PAGE|PLACE OF BAPTISM|GODFATHER|GODMOTHER|OFFICIATING MINISTER)", value, re.I))


def _matched_value(lines: list[str], key: str) -> str:
    for i, line in enumerate(lines):
        for label in LABELS[key]:
            # Matches "Full Name: Jane Doe", "Full Name Jane Doe", or the
            # value on the next line. Reject another field label as a value.
            match = re.match(rf"^\s*(?:{label})(?:\s*[:#\-–]\s*|\s+)(.+)$", line, re.I)
            if match:
                value = _clean(match.group(1))
                if value and not _looks_like_label(value):
                    return value
            if re.fullmatch(rf"\s*(?:{label})\s*:?\s*", line, re.I):
                if i + 1 < len(lines):
                    value = _clean(lines[i+1])
                    if value and len(value) < 180 and not _looks_like_label(value):
                        return value
    return ""

def _split_names(value: str) -> dict[str, str]:
    """Only straightforward given-name/surname cases, never assume complex names."""
    parts = value.split()
    if len(parts) < 2 or len(parts) > 6:
        return {}
    return {"first_name": " ".join(parts[:-1]), "last_name": parts[-1]}


def parse_official_form_fields(text: str, sacrament_type: str) -> dict[str, Any]:
    """Extract best-effort form data for the selected church template."""
    lines = [x.strip() for x in (text or "")[:MAX_TEXT_CHARS].splitlines() if x.strip()]
    category = (sacrament_type or "").strip().lower()
    if category not in {"baptismal", "confirmation", "marriage"}:
        return {"recordData": {}, "archiveFields": {}, "warnings": ["Unsupported official form category."]}
    warnings: list[str] = []
    record: dict[str, Any] = {}
    archive: dict[str, str] = {}
    common_keys = ("date_of_baptism", "child_name", "date_of_birth", "place_of_birth", "father_name", "mother_name", "address", "contact_number", "sponsors")
    if category in {"baptismal", "confirmation"}:
        keys = common_keys + (("date_of_confirmation",) if category == "confirmation" else ())
        for key in keys:
            found = _matched_value(lines, key)
            if not found:
                continue
            if key in _DATE_KEYS:
                iso = parse_date(found)
                if iso:
                    record[key] = iso
                else:
                    warnings.append(f"Review {key.replace('_', ' ')} manually: date was ambiguous or unrecognized.")
            elif key == "contact_number":
                if found.strip().casefold() not in {"none", "n/a", "not provided", "not available", "unknown", "-"}:
                    record[key] = found
            elif key == "sponsors":
                # Comma/semicolon-separated sponsor names on an explicit label.
                names = [_clean(p) for p in re.split(r"[;,]", found) if _clean(p)]
                if names:
                    record[key] = names[:10]
            else:
                record[key] = found
        # Some registers label godfather/godmother individually rather than
        # listing all sponsors in one field.
        if not record.get("sponsors"):
            sponsors = []
            for sponsor_label in ("godfather", "godmother"):
                for i, line in enumerate(lines):
                    if re.fullmatch(rf"{sponsor_label}\s*:?", line, re.I) and i + 1 < len(lines):
                        sponsors.append(_clean(lines[i+1]))
                    else:
                        found = re.match(rf"^{sponsor_label}(?:\s*[:,#-]\s*|\s+)(.+)$", line, re.I)
                        if found:
                            sponsors.append(_clean(found.group(1)))
            if sponsors:
                record["sponsors"] = sponsors[:10]
        if record.get("child_name"):
            archive["person_name"] = record["child_name"]
        date_key = "date_of_confirmation" if category == "confirmation" else "date_of_baptism"
        if record.get(date_key):
            archive["date_of_record"] = record[date_key]
    else:
        for key in ("date_of_marriage", "place_of_marriage", "witnesses"):
            found = _matched_value(lines, key)
            if not found:
                continue
            if key == "date_of_marriage":
                iso = parse_date(found)
                if iso:
                    record[key] = iso
                else:
                    warnings.append("Review date of marriage manually: ambiguous or unrecognized date.")
            elif key == "witnesses":
                record[key] = [_clean(n) for n in re.split(r"[;,]", found) if _clean(n)][:10]
            else:
                record[key] = found
        for source_key, nested_key in (("husband_name", "husband"), ("wife_name", "wife")):
            full = _matched_value(lines, source_key)
            if full:
                split = _split_names(full)
                if split:
                    record[nested_key] = split
                else:
                    warnings.append(f"Please enter {nested_key} name manually.")
                if nested_key == "husband":
                    archive["person_name"] = full
        if record.get("date_of_marriage"):
            archive["date_of_record"] = record["date_of_marriage"]
    for field in ("parish", "priest"):
        val = _matched_value(lines, field)
        if val:
            archive[field] = val
    if not record:
        warnings.append("No supported official-form fields recognized. Enter values manually or use a clearer scan.")
    warnings.append("OCR results are unverified. Compare all values against the original scan before saving.")
    return {"recordData": record, "archiveFields": archive, "warnings": warnings}
