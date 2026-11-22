# Smart Parish panel rescue: operational release gates

Current base: `staging` revision `02a4914`; candidate: draft PR #14. **No merge/production rollout without explicit operator approval.**

## A. Smallest functioning panel demonstration (synthetic data)
1. Render **ifimarag → Deploys** and **smart-parish-api → Deploys**: record both Live Git SHAs; they should match the approved merge. Do not treat "Deployed" as an acceptance test.
2. Open `https://ifimarag.onrender.com/api/ready`; allow for free-tier cold start, retry once. Document 200/503 and log time.
3. Signed out: public calendar displays Mass and synthetic notice with correct Asia/Manila end day; member-only notice is hidden.
4. Sign in with a **pre-approved synthetic Main Admin** (MFA). Open **Digital Church Archives**. Check storage and OCR warning banners.
5. Upload a synthetic baptismal scan, run **Preview OCR**, correct details in **Official Form Data**, check **Reviewed**, preview draft, save, reopen the filled PDF and original scan. Never use a real ID.
6. Sign in as approved synthetic parishioner. File one certificate request, verify Main Admin selected correct source and approved, attach final fictional signed PDF, verify test payment / authorized cash ledger only in isolated environment, release, then download as owner. Try the same link as a second account: 403/404, never bytes.
7. Main Admin → Mass Recordings → enter a YouTube link, save, play embedded video (must allow embedding). Download **Prepare transcript** assistant, generate a draft on parish PC using a short fictional Tagalog–English recording, import, correct transcript and summary, save, reopen. The web server must not run Whisper.
8. Export office report to PDF/XLSX. Report synthetic test-mode payments separately and never count them as live collections.
9. Fill `deploy/PHASE8-TEST-LOG.md` and gather no-coaching observations using `deploy/PHASE8-OLDER-USER-TEST.md`.

## B. Private Supabase storage (Flask service only)

**You must perform these real dashboard steps; GitHub code cannot configure or prove them.**
- Supabase project → **Storage → Buckets** → create or inspect a **private** bucket (public access OFF). Use a test bucket/clone first.
- Supabase project → **Storage → S3 Connection / S3 access keys**: get S3 endpoint, region and scoped access keys. Keep keys in Render secrets and never in Git or chat.
- Render → **smart-parish-api → Environment**: review `PARISH_S3_ENDPOINT`, `PARISH_S3_REGION`, `PARISH_S3_BUCKET`, `PARISH_S3_ACCESS_KEY`, `PARISH_S3_SECRET_KEY`; configure `PARISH_PRIVATE_UPLOADS=enabled` only after backup and migrations `20261120_private_uploads.sql` and `20261120_upload_quota.sql` have been confirmed. Before enabling verify the archive DB role can check `storage.buckets`.
- The revised archive UI calls `/api/backend/api/archive/storage-status`: **durable=false means STOP — the server can lose files**. On Render, uploads now return 503 until durable storage is configured.
- Take inventory of old upload files on the host that owns them using `church_backend/sync_archive_storage.py` (default dry run), and apply copying only after backup. Render Free files already lost cannot be recreated from the DB.
- Prove upload + download of fictional original/filled PDF after backend restart. Only then use real records.

## C. OCR and file extraction

- On Windows local Flask terminal: `tesseract --version` and `tesseract --list-langs`. If missing, install Tesseract OCR and restart Flask. The backend looks in PATH, `TESSERACT_CMD`, `TESSERACT_PATH`, then common Windows installation folders.
- Docker Flask image already installs `tesseract-ocr` and `tesseract-ocr-eng`/`tesseract-ocr-fil`. If OCR still fails, inspect Render **smart-parish-api → Logs** for OCR timeout/memory/corrupt scan. Test a clear 300dpi scan first.
- Main Admin → Digital Church Archives: check **OCR warning**, **Preview OCR**, correct any wrong names/dates, tick review, preview the draft and save. OCR suggestions are never authoritative; use manual entry if OCR fails.

## D. Twilio SMS (test phone only)

- Render → **ifimarag → Environment**: `PHONE_OTP_PROVIDER=twilio`, `PHONE_OTP_PEPPER` (existing secret, ≥32 characters), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, plus `TWILIO_MESSAGING_SERVICE_SID` **or** `TWILIO_FROM_NUMBER`. Leave credentials private.
- Twilio Console: verify a permitted outbound sender and a **verified trial recipient** (if account is trial); check SMS permissions, balance and message logs.
- Sign in as an approved, email-verified test parishioner with a `+639XXXXXXXXX` format mobile number; open **Profile → Mobile verification**, request one code, enter it, then test retry limits. A provider ACCEPTED response is not actual handset delivery.
- A pending applicant cannot use the regular authenticated profile OTP; SMS verification is currently post-approval, not part of pre-approval registration.

## E. PayMongo QR Ph and cash

- PayMongo Console → Test mode: use test secret, test webhook signing secret, and checkout QR Ph, with webhook `https://ifimarag.onrender.com/api/paymongo/webhook`, event `checkout_session.payment.paid`.
- Render **ifimarag**: `PAYMONGO_MODE=test`, `PAYMONGO_WEBHOOK_SECRET`; **smart-parish-api**: `PAYMONGO_MODE=test`, `PAYMONGO_METHODS=qrph`, `PAYMONGO_SECRET_KEY` test key and `APP_BASE_URL`. Verify existing `FLASK_INTERNAL_KEY` matches both services.
- In test clone only: replay one signed event twice, confirm one `paymongo_verified_payment` ledger row; wrong amount or reference must not mark paid. Never switch to live mode merely for panel demonstration.
- **Cash ledger is NOT enabled yet.** New migration `deploy/migrations/20261122_cash_receipts.sql`, Flask `POST /api/backend/api/requests/<id>/cash-receipt`, `PARISH_CASH_RECEIPTS=enabled`. Review with authorized parish bookkeeper on test clone first. A reversal creates a new negative entry; original is never deleted.

## F. Local AI and operational reports

```powershell
py -3.11 -m pip install -r worker/requirements.txt
py -3.11 public/mass_transcription_assistant.py
# or:
py -3.11 public/mass_transcription_assistant.py fictional-mass.mp3 fictional-draft.json --language auto --model small --beam-size 5
```

The first use requires downloading the model. `small` may improve Tagalog/English recognition at higher RAM/CPU cost; accuracy is not guaranteed. The assistant emits separate transcript and ranked extractive summary. Import in **Mass Recordings** and edit both before saving.

For reports, `python church_backend/run_scheduled_reports.py` processes due schedules on an authorized host with its own secure DB environment; recurring automation needs an actual Windows Task Scheduler / authorized runner, not Render's sleeping free web process.

## G. Deployment rule

Run CI and local tests first; open PR #14 `Files changed`. Apply migrations only on an approved disposable clone. Back up and restore original/private objects before the first live storage activation or redeploy. Only merge after explicit owner approval; then record new Live SHA for **both** Render services and perform the public/secure smoke tests above. No rollback should erase payments or account records.

**Unresolved before real parish go-live:** real email delivery, live Twilio handset, actual bucket privacy and file restart recovery, authorization with separate staff role (not implemented), PDF issuance signature/stamp approval, negative access tests against staging, payment reconciliation and reversals.
