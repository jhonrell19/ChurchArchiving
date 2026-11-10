# Smart Parish — OCR Runtime Fix (November 8, 2026)

## What these files fix

The uploaded `Latest_files.zip` already contains the archive workflow that saves the reviewed, filled IFI template PDF as `Document.filepath` and retains the original scan in `Document.extracted_metadata`. Do **not** reset your database or change schema to fix the OCR error.

Your error `POST /api/archive/ocr-preview 503` was caused by this line in the previous server code:

`shutil.which("tesseract")`

That check fails if the Python/Flask process doesn't inherit the Windows PATH that contains the Tesseract installation. This patch resolves the executable from: (1) `TESSERACT_CMD` / `TESSERACT_PATH`, (2) PATH, (3) common Windows install directories, and then configures `pytesseract.pytesseract.tesseract_cmd` explicitly.

It does **not** install Tesseract. `pytesseract` and the Tesseract executable are different dependencies.

The patch also gives clearer error guidance when the official template has no extracted data. A minor OCR parser change avoids writing the literal words `Not provided` into an empty Contact # field.

## Files included

- `church_backend/server.py` — OCR engine discovery fix, preserves your latest existing filled-primary PDF save flow
- `church_backend/tesseract_runtime.py` — new executable finder
- `church_backend/ocr_fields.py` — handles missing phone placeholders conservatively
- `src/app/admin/components/ArchivesPage.tsx` — friendly preview error and OCR label
- `check_smartparish_ocr.py` — read-only engine and scan test
- `tests/test_tesseract_runtime.py` — 3 executable-finder tests

## Install — Windows PowerShell

1. Stop Flask (`Ctrl+C`) and Next.js (`Ctrl+C`).
2. **Back up both databases and `church_backend/uploads`**, and save a Git checkpoint. The archive documents are valuable and should not be overwritten.
3. Extract this ZIP into the project root `C:\Users\biga\Desktop\jscode\backup-church`, preserving folder structure and replacing matching source files only. **Do not** overwrite `.env`, `dev.db`, `archive.db` or user-uploaded files (not included).
4. Open a fresh terminal at the project root and activate your existing environment if not already active:

   ```powershell
   .\venv\Scripts\Activate.ps1
   python check_smartparish_ocr.py
   ```

5. If the diagnostic says it cannot find Tesseract, check the common install location:

   ```powershell
   Test-Path "C:\Program Files\Tesseract-OCR\tesseract.exe"
   ```

   If `True`, run this in the **same terminal** used to start Flask:

   ```powershell
   $env:TESSERACT_CMD = "C:\Program Files\Tesseract-OCR\tesseract.exe"
   python check_smartparish_ocr.py
   ```

   If the executable is installed elsewhere, set `$env:TESSERACT_CMD` to that actual file's full path. To keep the setting after terminal restarts, put `TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe` in your local `.env` (never commit the `.env` file). Restart Flask after changes. If Tesseract is not installed anywhere, install the **Tesseract OCR application** (not merely the `pytesseract` pip package).

6. Optional: Verify the fictional Sofia scan from your existing project:

   ```powershell
   python check_smartparish_ocr.py --scan "church_backend\uploads\baptismal\Baptismal_Test_Scan_Sofia_Navarro.png"
   ```

   It should print recognized field **names** (not personal values). This file must exist for that optional step.

7. Run tests and syntax checks:

   ```powershell
   python -m unittest discover -s tests -p "test_tesseract_runtime.py" -v
   python -m unittest discover -s church_backend -p "test_ocr_fields.py" -v
   python -m py_compile church_backend\server.py
   npx tsc --noEmit
   npm run build
   ```

8. Restart backend and frontend:

   ```powershell
   python church_backend\server.py
   ```

   In a second terminal:

   ```powershell
   npm run dev
   ```

## Acceptance test

In Main Admin > Certificate Archives > Baptismal > Add Archive Record:

1. Choose the fictional Sofia scan. The automatic OCR preview (or `Preview OCR`) should succeed with status **200**, not **503**.
2. Review extracted field values and tick the staff-review checkbox.
3. Click **Preview Filled Official Template**. You should receive a PDF preview (HTTP 200), not a 400 caused by missing fields.
4. Click **Save to Archive**. The upload should return **201**. The new row should be titled **Primary: Filled IFI Template (PDF Draft)**, with an **Original Scan** link.
5. Use View/Print and confirm they open the filled PDF rather than a scanned PNG; keep the original scan for reference.

If step 4 fails, capture the **HTTP response body** from the failed `/api/archive/upload` request and the Flask log traceback; do not reset SQLite or keep retrying on real documents.

## Verification already completed for this patch

- Python syntax compilation: passed
- `test_ocr_fields.py`: 3/3 passed
- `test_tesseract_runtime.py`: 3/3 passed
- On a system with Tesseract, the **exact fictional Sofia scanned PNG** extracted names, dates, sponsors, parish, priest, and other recognized fields
- The extracted fields generated a valid IFI template PDF containing the child's name, both parents, and baptism date
- `ArchivesPage.tsx` syntax transpilation: passed

**Not verified here:** complete Next.js build, Windows/Flask browser round-trip, database-backed Save to Archive. Verify those on your system before claiming final success.
