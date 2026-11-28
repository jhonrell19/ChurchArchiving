import base64
import binascii
import json
import unicodedata
from datetime import date
from pathlib import Path

FIELDS = json.loads((Path(__file__).resolve().parents[1] / "config" / "certificate_identity.json").read_text(encoding="utf-8"))


def valid_name(value):
    return (2 <= len(value) <= 150 and any(c.isalpha() for c in value)
            and all(c.isalpha() or unicodedata.category(c).startswith("M") or c in " .-'’" for c in value))


def validate_identity(category, data, person_name):
    source = data.get("identity")
    if not isinstance(source, dict) or not valid_name(person_name):
        raise ValueError("Enter the full name from the church record and complete the identity fields.")
    fields = {}
    for spec in FIELDS[category]:
        value = source.get(spec["key"], "")
        if not isinstance(value, str) or len(value) > 180:
            raise ValueError("Invalid " + spec["label"])
        value = value.strip()
        if not value and not spec["required"]:
            continue
        kind = spec["kind"]
        if not value or (kind == "name" and not valid_name(value)) or (kind == "choice" and value not in spec["options"]):
            raise ValueError("Check " + spec["label"])
        if kind in {"date", "yearDate"}:
            try:
                when = date(int(value), 1, 1) if kind == "yearDate" and len(value) == 4 else date.fromisoformat(value)
                if when > date.today() or (len(value) != 4 and when.isoformat() != value):
                    raise ValueError()
            except ValueError:
                raise ValueError("Enter a valid past date or permitted year for " + spec["label"])
        fields[spec["key"]] = value
    fields["unredacted"] = source.get("unredacted") is True
    if not fields["unredacted"]:
        return fields, None
    encoded = data.get("proofBase64")
    if not isinstance(encoded, str) or len(encoded) > 4194304:
        raise ValueError("Attach a PDF, JPG or PNG identity document up to 3 MB.")
    try:
        proof = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise ValueError("Invalid identity document.")
    for prefix, mime in [(b"%PDF-", "application/pdf"), (b"\xff\xd8\xff", "image/jpeg"), (b"\x89PNG\r\n\x1a\n", "image/png")]:
        if proof.startswith(prefix):
            fields["proofType"] = mime
            return fields, proof
    raise ValueError("Identity document must be a PDF, JPG or PNG.")
