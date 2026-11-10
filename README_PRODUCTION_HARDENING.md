# Smart Parish: production-hardening candidate (November 8, 2026)

This is a **candidate patch**, not approval to accept real money or real parishioner data. It was prepared from the `asd.zip` uploaded in this conversation. Its safe installer checks exact SHA256 hashes of existing code and refuses mismatched files; no databases, `.env`, or uploads are bundled.

## Critical current findings

- Existing staff script resets administrator credentials to known fixed demo passwords. This patch replaces it with env-only provisioning and adds a read-only auditor. **Rotate existing staff passwords immediately** and use unique private email addresses controlled by authorized staff.
- Existing PayMongo was **test-only**. This patch adds an explicitly-gated `PAYMONGO_MODE=live` path, live-vs-test signature separation, transaction amount/currency/mode verification against PayMongo, and an additive ledger. **Live mode remains disabled by default.** You must configure a real approved merchant account and secret, live webhook endpoint, approved fee schedule, HTTPS domain, and settlement verification.
- Existing client UI displayed demo fee constants. The patch loads server-authoritative fees from `/api/requests/pricing` and retains server-side checkout price verification.
- Browser-origin checks for mutation APIs, server-process login throttling, stronger *new* user password policy and shorter staff sessions are included. **Admin multi-factor authentication is NOT yet implemented.** Do not represent this as complete high-assurance staff security. Place a reverse proxy/WAF rate limiter in front of the app.
- Adds `SMART_PARISH_UPLOAD_ROOT` for persistent uploads (backend DB filepaths remain `uploads/...`); the existing uploads directory must be migrated to persistent storage if using this setting.

## 1. Installation — NEVER extract into your project root

Extract the package as a separate directory, e.g. `C:\Users\biga\Desktop\SmartParish_Production_Candidate_20261108`. In VS Code PowerShell within `backup-church`:

```powershell
python backup_smart_parish_databases.py
$installer = Get-ChildItem "$HOME\Desktop\SmartParish_Production_Candidate_20261108" -Filter install_production_patch.py -Recurse -File | Select-Object -First 1
python "$($installer.FullName)" --project .
```

Review the report. ONLY if every file is `MATCH_BASE` or `ALREADY_PATCHED`, stop Next/Flask and run:

```powershell
python "$($installer.FullName)" --project . --apply
```

The installer backs up overwritten original sources to a timestamped folder **beside** the Git project. It does **not** alter SQLite, PayMongo, or your `.env`. If any file is `CHANGED`, stop rather than force-overwriting newer changes.

## 2. Required database change (stop Flask, backup already verified)

```powershell
python scripts/migrate_payment_ledger.py
python scripts/migrate_payment_ledger.py --apply
python scripts/migrate_payment_ledger.py
```

The migration creates an immutable-identifier ledger table; it does not rewrite certificates or request rows. Check the backup destination reported by the script. Never use `prisma migrate reset` or `prisma db push` on your existing production DB.

## 3. Prisma baseline: do not blindly replay the three old migrations

Your previously run `migrate diff --from-config-datasource --to-schema ...` returned **empty**, confirming the current SQLite tables match your Prisma schema. The three older migration files are NOT a valid representation of that full schema.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\prisma_baseline_preview.ps1
```

Review `prisma_baseline_review.sql` beside the project. The **official Prisma 7 baseline workflow** is: back up the DB and migration folder outside the repo; coordinate migration history with your teammate(s); create one new `prisma/migrations/0_init/migration.sql` from that reviewed SQL; remove/retire the conflicting old migration chain only after team coordination; run `npx prisma migrate resolve --applied 0_init` on each *existing* matching database; run `npx prisma migrate status` and `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`; test a fresh empty database by applying that baseline in a disposable environment. Do not mark the old three migrations blindly, and do not run these migration commands against another team's database without their consent.

https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining

## 4. Live-money activation (only AFTER HTTPS staging and audit)

1. In the PayMongo **merchant dashboard**, finish live merchant verification and bank/payout setup under the authorized parish owner. Do not share keys in chat, screenshots, or GitHub.
2. Confirm and document parish-authorized PHP fees, whether rush processing is permitted, payment/receipt/refund terms, settlement responsibility, and handling of cancelled or disputed payments.
3. Deploy at a permanent HTTPS domain. Ensure Flask and both SQLite databases/uploads are never publicly readable. Register a **live** PayMongo webhook for `checkout_session.payment.paid` at `https://YOUR-DOMAIN/api/paymongo/webhook`. Keep live and test webhook secrets separate.
4. Confirm Google OAuth client origins and Resend sending domain for that exact HTTPS hostname. Verify real password reset and email verification; do not expose development tokens.
5. While in TEST mode, run signed webhook, duplicate webhook, wrong amount, wrong currency, mode mismatch, forged signature, cancelled checkout, failed provider query, and payment ownership scenarios. Verify that only a verified, unique `pay_...` payment enters `paymongo_verified_payment` and marks the correct approved request paid.
6. To activate LIVE **after** these tests and official sign-off: set `SMART_PARISH_ENV=production`, `PAYMONGO_MODE=live`, `PAYMONGO_SECRET_KEY=sk_live_...`, `PAYMONGO_WEBHOOK_SECRET=<LIVE SIGNING SECRET>`, `PAYMONGO_LIVE_ENABLED=YES`, `CERT_FEES_APPROVED=YES`, all `CERT_FEE_*` values, HTTPS `APP_BASE_URL`, and `FLASK_DEBUG=0` in your private production secrets. Restart both services.
7. Perform **one authorized low-value real payment**, confirm the parish's PayMongo Dashboard ledger and bank payout configuration, verify the DB request/ledger, issue receipt, and test refund/reconciliation procedures. Only then consider enabling general public payments.
8. If the live webhook fails, leave the request `Unpaid` pending provider reconciliation. Never treat browser redirect success as payment proof. Implement daily operational reconciliation, dispute/refund procedures, and manual escalation for outages.

PayMongo docs:
- https://docs.paymongo.com/docs/developer-tools-go-live-checklist
- https://docs.paymongo.com/docs/developer-tools-webhook-setup-management

## 5. Staff security

Run **read-only** staff password audit:

```powershell
npx tsx scripts/audit_staff_passwords.ts
```

If the audit detects legacy demo credentials, replace immediately using *process-scoped* environment variables only (never commit or paste them into chat). Example in your own private terminal session:

```powershell
$env:MAIN_ADMIN_EMAIL = 'private-main-admin@example.com'
$env:BURIAL_ADMIN_EMAIL = 'private-burial-admin@example.com'
# Set $env:MAIN_ADMIN_PASSWORD and $env:BURIAL_ADMIN_PASSWORD securely without command history.
$env:STAFF_PASSWORD_ROTATION = 'YES'
npx tsx scripts/create-staff-accounts.ts
Remove-Item Env:MAIN_ADMIN_PASSWORD,Env:BURIAL_ADMIN_PASSWORD -ErrorAction SilentlyContinue
```

**WARNING:** The replacement script intentionally does not elevate an existing `USER` account to staff, nor create staff with weak passwords. Use known existing staff email addresses when rotating. An approved, verified MFA solution is still required before real staff and parishioner records can be trusted in production. Do not confuse email verification with MFA.

## 6. Hosted environment

Recommended single Linux VPS with persistent `/srv/smartparish/data` and `/srv/smartparish/uploads`, private service user, and separate protected `/etc/smartparish/production.env`. Examples under `deploy/` cover Nginx, systemd and environment keys.

- Bind Next.js to `127.0.0.1:3000` and Waitress/Flask to `127.0.0.1:5000`.
- Nginx alone exposes ports 80/443, redirects HTTP to HTTPS, and rate-limits login.
- Use real Let's Encrypt certificates/renewals and a valid domain (do not use ngrok for long-term live operation).
- Set `DATABASE_URL=file:/srv/smartparish/data/dev.db` and `ARCHIVE_DATABASE_URL=sqlite:////srv/smartparish/data/archive.db`. Copy live SQLite with consistent backup method, not manual deletion. Set `SMART_PARISH_UPLOAD_ROOT=/srv/smartparish/uploads`, move the entire previous `church_backend/uploads/` tree to it preserving relative subpaths and owner permissions.
- Test restoring SQLite and uploads after restarting services. Back up daily to encrypted **offsite** storage using `scripts/production_backup.py` as a starting point; configure scheduling separately.
- Install FFmpeg and Tesseract on VPS and validate CPU/memory for Faster-Whisper. Download Whisper models before public rollout to avoid runtime model fetch failures. Use a background worker for substantial transcription to avoid request timeouts.

## 7. Acceptance tests (the app is NOT yet verified end to end)

For **USER**: registration, email verification, Google sign-in, reset, unauthorized access, submit, cancel/hide, pay and download. For **MAIN ADMIN**: approve only baptismal/confirmation/marriage, OCR → reviewed IFI template → primary PDF save, release only paid documents, cannot access burial records. For **BURIAL ADMIN**: cemetery slots, record lookup, ownership docs, reservation, payments, cannot access regular sacramental documents.

For external integrations: deliver Google ID token from deployed origin; verify Resend domain; check PayMongo test+live signatures, replay and provider reconciliation; upload Mass audio/video and transcribe; test large file limits, PDF generation, and restart/persistence. Check `scripts/deployment_preflight.py --mode production` and `npm run build` first.

**Not included:** Admin MFA, verified real PayMongo transactions/payouts, hosting/HTTPS/domain procurement, production mail/Google authorization, live browser acceptance, server-side transcription worker queue, and any outstanding burial chat/SMS OTP. These are still deployment blockers. Remove/disable any demo controls that have not passed acceptance, rather than asserting they're real.

## 8. Build and regression verification

```powershell
python -m py_compile church_backend/server.py
python scripts/migrate_payment_ledger.py
python -m unittest discover -s tests -p 'test_final_release_regressions.py' -v
npx tsc --noEmit
npm run build
python scripts/deployment_preflight.py --mode production
```

The production preflight will intentionally report FAILs until actual secrets and hostname exist. **Do not interpret that as a patch installation failure.**
