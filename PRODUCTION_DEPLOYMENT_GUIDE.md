# Smart Parish System — Production Deployment Guide

This file covers the parts that cannot be made "live" from source code alone because they require real parish/provider accounts or infrastructure.

## Phase 1 — Freeze a tested release

On the development PC:

```powershell
npm install
npx prisma generate
npx prisma db push
npm run lint
npm run build

.\venv\Scripts\Activate.ps1
python -m pip install -r church_backend\requirements.txt
python church_backend\migrate_panel_phase1.py
python -m py_compile church_backend\server.py church_backend\models.py church_backend\wsgi.py
```

Complete every item in `TESTING_GUIDE.md`.

Do not deploy `.env`, local databases, private parish scans, or test uploads to Git.

## Phase 2 — Real email verification using Resend

The source already supports Resend through its HTTPS API. No extra npm package is required.

1. Create the parish/team Resend account.
2. Add a domain/subdomain that the parish controls.
3. Add the DNS records shown by Resend and wait until the domain is verified.
4. Create a sending-only API key if possible.
5. Choose a sender address on the verified domain, e.g. `no-reply@your-parish-domain`.
6. Put the values only in the production environment:

```env
APP_BASE_URL="https://your-real-domain"
RESEND_API_KEY="re_..."
EMAIL_FROM="Smart Parish <no-reply@your-real-domain>"
```

7. Restart/redeploy Next.js.
8. Register a fresh test USER using an address you control.
9. Confirm the verification message arrives and its HTTPS link verifies the account.
10. Test Forgot Password the same way.

Keep the API key secret. Never expose it in browser JavaScript or commit it to Git.

## Phase 3 — OCR on the server

The Python requirements include `pytesseract`, Pillow, and PyMuPDF, but Tesseract itself is an operating-system application.

Windows development:
- Install a current Tesseract 5 Windows build.
- Add the Tesseract installation directory (commonly `C:\Program Files\Tesseract-OCR`) to PATH.
- Open a new terminal and run `tesseract --version`.

Linux production generally installs Tesseract from the distribution package manager. Ensure the English trained data is installed. Add Filipino/other language data only if the parish's actual records require it.

OCR is deliberately advisory. Staff must verify extracted names, dates, and certificate identifiers against the source scan.

## Phase 4 — Official parish certificate templates

The project currently offers either staff upload of a prepared final file or a system-generated draft PDF.

For official automatic certificate generation, obtain the approved templates from IFI Maragondon first.

For each document type define:
- exact template file;
- exact legal/religious wording;
- which fields may be auto-filled;
- who reviews it;
- who signs/seals it;
- whether an electronic copy may be released;
- retention/audit policy.

Then map verified archive metadata to template placeholders. Do not generate an "official" certificate from unverified OCR alone.

Recommended placeholders include fields such as:

```text
{{ person_name }}
{{ date_of_record }}
{{ certificate_number }}
{{ book_number }}
{{ page_number }}
{{ parish }}
{{ priest }}
```

Only replace the current draft generator after the parish approves the actual template and output.

## Phase 5 — Real PayMongo / QR Ph

The capstone source intentionally keeps `PAYMENT_MODE=DEMO` until the parish has a real PayMongo merchant account and confirms which payment methods are activated for that account.

Do not mark a production request Paid because the browser says payment succeeded. The backend must trust a verified provider result/webhook.

Recommended rollout:

1. Create/activate the parish PayMongo merchant account.
2. Complete required merchant/KYC activation.
3. In PayMongo, confirm the payment methods available to that specific account, including QR Ph if offered/activated.
4. Obtain TEST secret/public credentials first.
5. Create one server-side checkout/payment integration for a request amount. Keep the secret key server-only.
6. Give every payment a reference tied to the internal request ID (for example a request reference number).
7. Configure one public HTTPS webhook endpoint in PayMongo for successful payment events. Do not create a new webhook for every request.
8. Verify the webhook according to the current PayMongo security documentation before changing any local payment status.
9. When the verified provider event proves the correct amount/reference is paid, update:

```text
payment_status = Paid
payment_method = provider method
payment_reference = provider payment/reference ID
paid_at = provider-confirmed time
```

10. Test cancel/failure, duplicate webhook delivery, wrong amount/reference, already-paid request, and replay attempts.
11. After all TEST-mode cases pass, replace test credentials with live credentials in the hosting provider's secret manager/environment variables.
12. Set:

```env
PAYMENT_MODE="PAYMONGO"
PAYMONGO_SECRET_KEY="..."
PAYMONGO_WEBHOOK_SECRET="..."
```

The exact QR Ph API field/method name should be copied from the current PayMongo dashboard/docs for the activated account rather than hard-coded from an old tutorial.

## Phase 6 — Move authentication from SQLite to PostgreSQL

SQLite is appropriate for the current local capstone, but PostgreSQL is preferred for a multi-user public deployment.

Because the project currently has two operational data stores, migrate deliberately:

### Auth/Prisma database
1. Create a managed PostgreSQL database.
2. Back up `dev.db`.
3. Change Prisma datasource provider from `sqlite` to `postgresql` in a production branch.
4. Set production `DATABASE_URL` to the PostgreSQL connection string.
5. Create/review a PostgreSQL-compatible migration from the current schema; do not replay SQLite-specific SQL blindly.
6. Migrate users/sessions carefully, preserving password hashes and roles.
7. Validate login, registration, verification, reset, and sessions.

### Flask archive/transaction database
1. Create a second PostgreSQL database/schema or a clearly separated schema in the managed database.
2. Replace SQLite URL with a PostgreSQL SQLAlchemy URL supplied through an environment variable.
3. Use a proper migration tool such as Alembic/Flask-Migrate for production evolution.
4. Export/import archive/request/mass/announcement/audit rows.
5. Confirm every file path still points to the new persistent file store.

Do this migration on a staging copy first. Never experiment directly on the only parish database.

## Phase 7 — Persistent file/object storage

Local `church_backend/uploads/` is fine for local development but may disappear on many cloud hosts.

For public deployment, use persistent block storage or object storage (S3-compatible service, managed blob storage, etc.). Separate logical areas:

```text
archive-source/       private staff-only scans
release-documents/    private user-specific final files
mass-media/           parish-viewable media according to policy
transcripts/          parish-viewable transcript PDFs according to policy
```

Store object IDs/keys in the database instead of public raw URLs. Generate authenticated/short-lived download responses when needed.

## Phase 8 — Run Flask with a production WSGI server

Do not expose Flask's development server publicly.

Windows/staging example using the included Waitress entry point:

```powershell
cd church_backend
waitress-serve --host=127.0.0.1 --port=5000 wsgi:app
```

On Linux you can use an appropriate WSGI server/process manager. Keep Flask private behind the Next.js/reverse-proxy layer. `FLASK_INTERNAL_KEY` must be a long random secret shared only by the Next.js server and Flask service.

## Phase 9 — Next.js production

```powershell
npm ci
npx prisma generate
npm run build
npm run start
```

In the hosting environment configure at least:

```env
DATABASE_URL="..."
FLASK_API_URL="http://private-flask-host:5000"
FLASK_INTERNAL_KEY="long-random-secret"
APP_BASE_URL="https://your-real-domain"
RESEND_API_KEY="..."
EMAIL_FROM="..."
```

Do not place secret keys in `NEXT_PUBLIC_*` variables.

## Phase 10 — HTTPS, reverse proxy, domain

Use the hosting platform's TLS or a reverse proxy such as Nginx/Caddy.

External clients should use only HTTPS. Do not expose SQLite files, uploads folders, Flask debug pages, or internal secret headers publicly.

Set cookies to secure production behavior behind HTTPS and verify login/logout/session expiry in the deployed environment.

## Phase 11 — Background jobs for long AI transcription

Current transcription is synchronous and is suitable for capstone demonstrations/short tests.

For production 1–2 hour recordings, move transcription to a job queue/worker:

```text
Admin upload
-> create MassRecord + queued job
-> web request returns quickly
-> worker runs FFmpeg + Faster-Whisper
-> worker saves transcript/summary/PDF
-> status becomes Transcribed or Failed
```

This prevents long HTTP requests from timing out. A Redis-backed worker system is one common option, but select the queue based on the actual hosting environment.

## Phase 12 — Backup, privacy, monitoring

Before live launch define:
- daily database backup;
- object/file backup and restore test;
- audit log retention;
- who may access sacramental records;
- incident response/password reset policy;
- server error logging/monitoring;
- dependency/security update schedule;
- retention/deletion policy consistent with parish/legal requirements.

Never use real private parish records in public test/staging environments unless authorized.

## Final production acceptance checklist

- [ ] Staging environment passes `TESTING_GUIDE.md`.
- [ ] Real email verification/reset tested.
- [ ] Official templates approved by parish.
- [ ] PayMongo test payments/webhooks pass all success/failure/replay cases.
- [ ] PostgreSQL migration rehearsed from backup.
- [ ] Persistent file storage configured.
- [ ] HTTPS enabled.
- [ ] Flask runs behind production WSGI server and is not directly public.
- [ ] Long AI jobs moved to worker or accepted operational limit documented.
- [ ] Backups/restores tested.
- [ ] Security/role matrix retested with USER, ADMIN, BURIAL_ADMIN, logged-out browser.
