"""Locate the local Tesseract OCR binary in Windows/Linux development environments.

pytesseract is a Python wrapper, not the OCR executable itself. A GUI-launched
Flask process may not inherit the same PATH as a newly opened PowerShell.
"""
from __future__ import annotations

import os
import shutil


def find_tesseract_executable() -> str | None:
    """Return a verified executable path, or None without changing PATH.

    Precedence: explicit TESSERACT_CMD / TESSERACT_PATH, process PATH, then
    common Windows installer directories. The command may also be a directory.
    """
    exe = "tesseract.exe" if os.name == "nt" else "tesseract"
    candidates: list[str] = []

    for key in ("TESSERACT_CMD", "TESSERACT_PATH"):
        value = os.getenv(key)
        if value:
            candidates.append(value)

    on_path = shutil.which("tesseract")
    if on_path:
        candidates.append(on_path)

    if os.name == "nt":
        roots = (
            os.environ.get("ProgramFiles"),
            os.environ.get("ProgramFiles(x86)"),
            r"C:\Program Files",
            r"C:\Program Files (x86)",
            os.environ.get("LOCALAPPDATA"),
        )
        for base in roots:
            if base:
                candidates.append(os.path.join(base, "Tesseract-OCR", "tesseract.exe"))

    for candidate in candidates:
        location = os.path.expandvars(os.path.expanduser(candidate.strip().strip('"')))
        if os.path.isdir(location):
            location = os.path.join(location, exe)
        if os.path.isfile(location):
            return os.path.abspath(location)
        resolved = shutil.which(location)
        if resolved and os.path.isfile(resolved):
            return os.path.abspath(resolved)
    return None
