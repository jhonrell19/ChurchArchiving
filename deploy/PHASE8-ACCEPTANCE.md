# Phase 8 — Staging integration and acceptance checklist

Branch: `integration/phase8-readiness-20261120`. This branch is **not deployed**. Both Render services were seen as Live on `d4a3c0b` on November 20, 2026, but that only confirms deployed revision parity.

## What this change does
- Adds an **optional Twilio SMS sender** to the existing parishioner phone OTP flow. Existing TextBee mode remains the default when `PHONE_OTP_PROVIDER` is unset and `TEXTBEE_OTP_ENABLED=true`.
- Allows the existing private S3-compatible storage adapter to target **Oracle Cloud Object Storage**. The existing Supabase adapter remains the default.
- Adds local AI tuning options (`--model`, `--beam-size`) and an offline word error rate scorer for a staff-corrected bilingual Mass.
- Adds read-only public staging probes. No deployed secrets, migrations, payment switches, or database changes are made by these tools.

## Read-only smoke test

```powershell
py -3.11 scripts/phase8_smoke.py
python -m unittest tests.test_phase8_readiness
```

The smoke test probes the homepage, Next readiness, public calendar and Flask health. A cold Render free instance can take more than 50 seconds to wake. All four probes succeeding **does not** prove authentication, registration, permission boundaries, payments, object storage or backups.

## Twilio OTP — optional, disabled by default
Set these **server-side only on the Next.js `ifimarag` service** after trial testing with a verified recipient:
- `PHONE_OTP_PROVIDER=twilio`
- `TWILIO_SMS_ENABLED=YES`
- `TWILIO_ACCOUNT_SID=AC...` and `TWILIO_AUTH_TOKEN` (keep private)
- Either `TWILIO_MESSAGING_SERVICE_SID=MG...` **or** `TWILIO_SMS_FROM=+...`
- `PHONE_OTP_PEPPER`: retain the existing secret; never rotate casually because it invalidates pending codes

Do **not** set any of these secrets as `NEXT_PUBLIC_*`. The current six-digit OTP expires after five minutes; SMS requests are throttled and guesses limited. Provider acceptance is **not** proof of delivery. Twilio trial restrictions, sender requirements and per-message fees apply. Twilio Lookup is **separate**: it does not verify phone ownership. Test one synthetic parishioner at a time.

To retain TextBee behavior, omit `PHONE_OTP_PROVIDER` and keep its existing settings, or set `PHONE_OTP_PROVIDER=textbee`.

## Oracle Object Storage — configuration proposal, NOT a live migration
First decide whether Supabase storage should remain active or Oracle should replace it; preserve a private backup of original uploads. Do not enable while existing uploads are not copied or restored.

On the **Flask `smart-parish-api` service**, the optional adapter needs:
- `PARISH_STORAGE_PROVIDER=oci`
- `PARISH_S3_ENDPOINT=https://<namespace>.compat.objectstorage.<region>.oraclecloud.com`
- `PARISH_S3_REGION=<region>`
- `PARISH_S3_BUCKET=<private-bucket>`
- `PARISH_S3_ACCESS_KEY` and `PARISH_S3_SECRET_KEY` from OCI customer secret keys
- `PARISH_OCI_BUCKET_PRIVATE_CONFIRMED=YES` **only after manually checking in OCI Console** that public access is disabled, IAM permissions are least-privilege, and bucket/object URLs are not public
- `PARISH_PRIVATE_UPLOADS=enabled` **only after** reviewed migrations, object-copy/retrieval tests and backups

The existing adapter uses content-hash object keys and verifies SHA-256 on download. OCI's S3 HeadBucket proves **access only**, not privacy. The private flag is an operator attestation, not a security audit. Access must remain through authenticated Flask download routes. OCI Always Free eligibility, quotas and payment-verification requirements must be checked in the actual account. Do not delete the Supabase bucket or legacy local uploads until migration and restore tests pass.

## AI accuracy assessment (offline)
```powershell
py -3.11 worker/transcribe.py test-mass.mp4 mass-draft.json --language auto --model small --beam-size 5
```
The draft JSON preserves separate `transcriptText` and `summaryText`; staff must review both. Increasing model size is a trade-off, not a guarantee of better Tagalog recognition. The summary is **still the first three sentences** and must not be represented as a production-quality abstractive summary.

Export the **staff-corrected** reference transcript as UTF-8 `reviewed.txt` and the raw AI transcript as `generated.txt`. Then:
```powershell
py -3.11 worker/evaluate_transcript.py reviewed.txt generated.txt
```
The reported WER ignores punctuation and casing. Evaluate personal names, scripture references and meaning separately. Keep real church recordings and transcripts outside Git.

## Required manual acceptance gates
1. Confirm both Render deploys and configuration; verify migration versions and all feature flags without displaying secret values.
2. Signed-out public calendar: synthetic public notice, Asia/Manila inclusive end date, member-only notice hidden.
3. Registration: email consent, delivery, membership evidence and supervisor/staff approval; verify rejected cases.
4. Certificate journey: claim evidence, office-scoped review, payment confirmation, signed/sealed release and owner-only download. Use synthetic records only.
5. Concurrent appointment reservations: exactly one last capacity, then cancel/rebook.
6. Private storage: upload/read/deny another user; test S3 copy of legacy objects and restore into a disposable environment.
7. Run a **real** authorized scheduled report job on a disposable or staging database; validate PDF and XLSX outputs.
8. Test staff MFA, expired tokens, direct route denial, audit logs, mobile screen-reader labels and keyboard navigation.
9. PayMongo QR Ph: test-mode payment/webhook; do not activate live merchant mode without explicit approval.
10. Record passes/failures, screenshots, backup path, rollback commit and evaluator sign-off.

**Rollback**: disable new provider modes and `PARISH_PRIVATE_UPLOADS` before a deployment rollback. Do not delete new database data or payment events. Never enable external paid integrations without approval.
