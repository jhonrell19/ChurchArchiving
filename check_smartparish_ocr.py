"""Read-only check for the OCR engine used by the Smart Parish Flask process.

From project root (with the same venv as Flask):
    python check_smartparish_ocr.py
    python check_smartparish_ocr.py --scan "path/to/fictional-test-scan.png"

Does not modify source files, scan files, or databases; prints no extracted names.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# Match server.py, which loads project .env before using OCR configuration.
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass
sys.path.insert(0, str(ROOT / "church_backend"))
from tesseract_runtime import find_tesseract_executable  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Smart Parish OCR runtime check (read only)")
    parser.add_argument("--scan", type=Path, help="Optional fictional test scan to verify OCR and field mapping")
    parser.add_argument("--category", choices=("baptismal", "confirmation", "marriage"), default="baptismal")
    args = parser.parse_args()

    exe = find_tesseract_executable()
    if not exe:
        print("OCR NOT READY: Tesseract executable not found by this Python process.")
        print('Windows: verify "C:\\Program Files\\Tesseract-OCR\\tesseract.exe" exists.')
        print('If installed elsewhere, set TESSERACT_CMD to the complete .exe path, then restart Flask.')
        return 2
    print(f"Tesseract executable found: {exe}")

    try:
        import pytesseract
        from PIL import Image, ImageOps
        pytesseract.pytesseract.tesseract_cmd = exe
        print(f"Tesseract version: {pytesseract.get_tesseract_version()}")
    except Exception as exc:
        print(f"OCR NOT READY: OCR Python wrapper or engine failed ({type(exc).__name__}: {exc}).")
        return 2

    if args.scan:
        scan = args.scan.expanduser().resolve()
        if not scan.is_file():
            print(f"File not found: {scan}")
            return 2
        try:
            with Image.open(scan) as img:
                prepared = ImageOps.autocontrast(ImageOps.grayscale(ImageOps.exif_transpose(img)))
                if prepared.width < 1300:
                    factor = min(2.0, 1300 / max(prepared.width, 1))
                    prepared = prepared.resize((int(prepared.width * factor), int(prepared.height * factor)))
                recognized = pytesseract.image_to_string(prepared, config="--psm 6", timeout=45)
            from ocr_fields import parse_official_form_fields
            fields = parse_official_form_fields(recognized, args.category)
            print(f"Scan OCR complete: {len(recognized.strip())} recognized text characters")
            print("Recognized form field names:", ", ".join(fields['recordData'].keys()) or "none")
            print("Recognized archive field names:", ", ".join(fields['archiveFields'].keys()) or "none")
            if not fields['recordData']:
                print("OCR ran but no supported fields were parsed; verify scan quality and field labels.")
                return 1
        except Exception as exc:
            print(f"OCR TEST FAILED: {type(exc).__name__}: {exc}")
            return 2

    print("OCR ENGINE READY. Restart Flask so it loads the updated server code.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
