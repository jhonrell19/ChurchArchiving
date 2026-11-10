"""Parish-approved fee catalog. Do not charge unpriced services online."""
import json
from pathlib import Path

_FEE_FILE = Path(__file__).resolve().parent.parent / "config" / "parish_fees.json"
with _FEE_FILE.open("r", encoding="utf-8") as source:
    PARISH_FEES = json.load(source)

CERTIFICATE_COPY_FEES = {key: (int(value) if value is not None else 0)
                         for key, value in PARISH_FEES["certificateCopies"].items()}
CEMETERY_OPENING_PERMIT_FEE = int(PARISH_FEES["cemetery"]["openingPermit"])
CEMETERY_DUES_PER_YEAR = int(PARISH_FEES["cemetery"]["perpetualDuesPerYear"])


def cemetery_fixed_charge(payment_type, years=None):
    """Returns (amount_php, years) or None for negotiable/non-fixed charges.

    Dues years are a positive whole number; booleans and floats are forbidden.
    """
    if payment_type == "OPENING_PERMIT":
        return CEMETERY_OPENING_PERMIT_FEE, None
    if payment_type == "PERPETUAL_DUES":
        if isinstance(years, bool) or not isinstance(years, int) or not (1 <= years <= 50):
            raise ValueError("Dues years must be a whole number from 1 to 50.")
        return CEMETERY_DUES_PER_YEAR * years, years
    return None
