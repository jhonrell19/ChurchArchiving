# Smart Parish System — Consolidated Final Stabilization Candidate

**Date:** 2026-11-08  
**Basis:** User-uploaded `Latest_files.zip` + the later `SmartParish_OCR_Runtime_Fix_20261108.zip` (OCR runtime overlay).  
**Scope:** A staged release candidate, **not** a verified production deployment. Do not put real parishioner records or real money through a public domain until acceptance and security testing pass.

## What this patch actually changes

1. **OCR and templates:** Consolidates Tesseract executable detection and OCR field parsing, preserving the working primary filled-PDF save code. Archive upload now requires explicit staff review and rejects unsupported/mismatched, empty, or oversized scan files. All baptismal/confirmation/marriage templates remain unchanged, and the original scan is preserved separately.
2. **Certificate numbers:** New archive numbers use the highest existing sequence number **including recycled records**, rather than counting only active rows. Deleted or recycled numbers are not reused.
3. **Requests:** A user may cancel their *own* pending unpaid request if no payment checkout has been started. The user may hide their own Released, Rejected, or Cancelled request from personal history. The record is **not deleted**: it remains visible to staff for accounting and audit. The new additive SQLite column is `certificate_request.history_hidden`.
4. **Data exposure:** Parishioners no longer receive matched archive's full `recordData` inside request summaries while a request is being processed. Backend internal failures return generic 500 responses instead of raw database/infrastructure exception text; backend logs retain diagnostics.
5. **Database startup:** Flask development startup may still apply *additive* compatibility columns, but **no longer silently rewrites archive departments or request statuses**. In `SMART_PARISH_ENV=production`, Flask checks its schema and fails safely if a required migration is missing rather than automatically changing tables.
6. **Staff account seeding:** Replaces the committed example admin passwords with **explicit, create-only staff seeding**, controlled by server-only environment variables. Existing passwords are never reset by rerunning the seed.
7. **Readiness tooling:** Includes a read-only preflight, an additive backup-first Flask migration script, a read-only Prisma baseline audit, and focused regression tests.

**Not included:** SMS OTP, verified phone ownership, new Burial Admin chat/inquiry/payment arrangement system, PayMongo live payments, migration-history resolution in your actual Prisma DB, automatic cloud deployment, or a complete security penetration test. These still require separate review. Phone carrier lookup remains optional and coverage-limited. The map file must be deployed onto persistent storage.

## Safe installation (Windows / VS Code)

**1. Stop the servers.** Press `Ctrl+C` in the Flask and Next.js terminals. Do not run migrations while they are serving requests.

**2. Back up BOTH databases and uploaded documents**, outside the repository:

```powershell
python backup_smart_parish_databases.py
$backupPath = Join-Path $HOME 'Desktop\SmartParish_Uploads_Backup_20261108.zip'
Compress-Archive -Path '.\church_backend\uploads' -DestinationPath $backupPath -Force
```

Check the database backup command reports success. Do not send private databases or archive uploads to ChatGPT or GitHub. Keep a copy off the hosting machine.

**3. Save a source checkpoint** (do not stage `.env`, `*.db` or private uploads):

```powershell
git status
git branch --show-current
```

Commit reviewed source changes if appropriate. Keep the current working branch as a rollback point.

**4. Extract this ZIP** into the `backup-church` project root; it creates `SmartParish_Final_Integration_20261108` as a sibling to your existing `src` / `church_backend` folders. Then run:

```powershell
python .\SmartParish_Final_Integration_20261108\install_patch.py --project .
```

This is **check-only** by default. If it says a file is unrecognized, STOP: you have local changes since the upload, and we should merge rather than overwrite them. If it passes:

```powershell
python .\SmartParish_Final_Integration_20261108\install_patch.py --project . --apply
```

The installer creates a timestamped backup of every overwritten source file **outside the repository**. No secrets, database files or uploads are copied into the patch.

**5. Run the one-time additive Flask DB migration**, which explicitly backs up the database before any schema change:

```powershell
python scripts\migrate_flask_additive.py
python scripts\migrate_flask_additive.py --apply
```

This adds missing columns only. The `--apply` run must report `PASS`. If you are using a custom `ARCHIVE_DATABASE_URL`, do not use this local DB script until the database path is reviewed.

**6. Run source and dependency verification:**

```powershell
python check_smartparish_ocr.py
python -m unittest discover -s tests -p "test_final_release_regressions.py" -v
python -m unittest discover -s tests -p "test_tesseract_runtime.py" -v
python -m py_compile church_backend\server.py church_backend\models.py
npx tsc --noEmit
npm run build
python scripts\prisma_baseline_audit.py
python scripts\deployment_preflight.py --mode defense
```

Do **not** run `prisma migrate reset`, `prisma migrate dev`, `prisma migrate deploy`, or `prisma db push` on your populated `dev.db` until the Prisma migration baseline has been reviewed and a verified backup exists.

**7. Restart** with the correct Python interpreter and Tesseract executable:

```powershell
.\venv\Scripts\Activate.ps1
$env:TESSERACT_CMD = 'C:\Program Files\Tesseract-OCR\tesseract.exe'  # only if that file exists
python church_backend\server.py
```

In a second terminal, run `npm run dev`. For the defense's public staging environment, use a persistent HTTPS host, not ngrok as permanent hosting.

## Acceptance tests — do not skip

1. **Baptismal:** Upload fictional Sofia scan, wait for OCR 200, correct fields, check review box, preview draft, Save, and reopen row. **View/Print must open generated filled PDF; Original Scan remains separate.** Check PDF names/dates and ensure the generated file exists on disk after restart.
2. **Confirmation:** Repeat with a fictional confirmation scan. Check field placement and dates, never assume OCR is exact.
3. **Marriage:** Repeat with a fictional marriage scan. The draft must have two pages, and the unsigned legal back page remains blank.
4. **Number uniqueness:** Create and recycle a *test* archive, then create another of same category/year; the new certificate number must not reuse the recycled one.
5. **User requests:** Using two different user accounts, confirm one cannot cancel/hide the other's request. Cancel only Pending/Unpaid with no checkout; hide only terminal requests. Staff must still see hidden requests; all payment and audit data remains intact.
6. **Roles:** Main Admin cannot reach burial data; Burial Admin cannot reach Baptismal/Confirmation/Marriage archives; USER cannot open another user's final file or any archival scan.
7. **Auth:** User, Main Admin, Burial Admin, email verification/password reset, Google Sign-In, logout, and protected routes all pass again. Prior patches affected auth; treat this as mandatory.
8. **Payments:** PayMongo **sandbox** successful, cancelled and duplicate callbacks; verify amount and signature on backend, never mark payments as Paid from browser-only success.
9. **Media:** AI Mass transcription and PDF download with realistic file sizes on hosting hardware; FFmpeg + model download; no crash after server restart.
10. **Burial map:** Place `site_master_plan_reference.png` under `church_backend/uploads/cemetery/` on the hosting volume. Test on real HTTPS address with Burial Admin. Don't expose the map publicly.
11. **Persistence:** After restart, check both DBs, all uploaded files, and generated archive drafts survive. Test restoring backups on a separate instance.

## Prisma migration-history blocker — must be resolved before production

Your existing `dev.db` previously had the expected tables but **no `_prisma_migrations` history**. The three original SQL migrations rebuild a legacy User table; applying them directly could destroy current account data. The canonical Prisma 7 procedure is to baseline an existing database only **after comparing the actual DB to the current schema**. Run:

```powershell
python scripts\prisma_baseline_audit.py
npx prisma migrate status
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

If the diff is nonempty, reconcile it on a copy first. Do not mark historical migrations applied until the migration plan is reviewed. Do not treat an existing `User` table as proof the schema exactly matches. This release does not automatically write Prisma migration history.

## Production differences

Run Flask via a production WSGI server, bind its private port to `127.0.0.1`, use Next.js `npm run build` + `npm run start`, set `SMART_PARISH_ENV=production`, and place nginx/Caddy with TLS in front. Use a persistent disk for the `dev.db`, `church_backend/instance/archive.db`, `church_backend/uploads` and generated files. Configure strong, private keys; verified email sender and correct final OAuth origins/redirects; PayMongo remains test mode for defense.

The current implementation has not been live-tested here because credentials, installed Python/Node dependencies, the active databases and the target server aren't available. A successful syntax check is **not** proof of end-to-end correctness.
