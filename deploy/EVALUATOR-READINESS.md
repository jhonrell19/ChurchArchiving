# Smart Parish evaluator implementation record

Baseline: GitHub staging d4a3c0b, November 21, 2026. PRs 8 and 9 are already merged. The inventory describes source on this baseline plus the review branch. It does not establish which version, grants, buckets or feature flags are active on Render.

## Implementation matrix and changelog

| Stage and requirement | Current implementation and evidence | Acceptance still required |
|---|---|---|
| 0. Availability, AI isolation, controlled errors | Flask health checks the archive DB. The web-service transcription pause is covered by tests/test_web_transcription_pause.py. This branch gives interactive proxy reads a 90-second deadline and returns 504 when the upstream fails to send headers in time. Signed-in notices now show a retry action when loading fails. | Check cold starts on both real services and simultaneous dashboard and certificate access. An interrupted body after headers have streamed can still surface as a client read error. |
| 1. Identity, profiles and status | prisma/schema.prisma, src/lib/auth.ts, church_backend/models.py. Prisma uses parish_auth, Flask uses parish_private, transactions for evidence also query parish_private. Both configurations target PostgreSQL through ARCHIVE_POSTGRES_URL. | Verify the same database on both services. Retain legacy status values and staff office separation. Existing sessions and MFA keys must survive any future mapping. |
| 1. Durable documents and quota | private_uploads.py, migrations for upload_object and storage_quota. Content hashes, byte limits, private bucket checks, scoped download routes. Legacy files may exist only under SMART_PARISH_UPLOAD_ROOT. | Reconcile physical copies and every category before a restart. Demonstrate owner/staff download and unrelated-account denial after a staging restart. Limits are per storage category. |
| 1. Backups and logs | scripts/backup_private_postgres.py creates a consistent database/object snapshot and a checksum manifest. scripts/verify_upload_backup.py compares legacy file copies. | Drill on actual provider and restore into a separate database/bucket. A backup manifest covers successful copies. Central failure history, retention and a recurring operator job remain open. |
| 1. Constraints, triggers and RLS | Nine SQL migrations under deploy/migrations include capacity and fee history, indexes and RLS on new private tables. scripts/audit_postgres_storage.sql now reports effective role, owner, RLS bypass status and table privileges. | Run read-only inventory with actual service roles. Legacy table policies, ownership bypass, sequence/function grants, sensitive-table old/new audit coverage and row access need individual review. Enabling FORCE RLS without policies for this custom session model can block service access. |
| 2. Registration, ID and record matching | Register, login, verification and admin membership routes. Versioned policy consent, limited pending session, private image evidence, exact baptismal certificate number, reason, reviewer and decision. | Prove ordinary-recipient email, Google sign-in and pending/rejected access with test accounts. Matching a number establishes record existence. Staff must still compare the identity in the ID with the record. |
| 2. Relative verification | relationship_claims.py and /claims. Private proof, declared owner and relationship, staff cross-match, office-scoped review, reason and supervisor escalation. | Exercise a real staging dispute using synthetic proof, and check separation between main and burial staff. |
| 2. Policies, roles and MFA | Versioned policies and consent via portalConfig.ts. PARISH_SUPER_ADMIN_ID designates an existing ADMIN. Staff MFA and database-backed sessions remain in place. | Review all legacy settings routes for supervisor-only enforcement before claiming full three-role parity. Rotate exposed credentials through provider consoles with a coordinated recovery plan. |
| 3. Archives, fees, dropdowns and request lifecycle | Existing document and certificate_request models and office routes; fee-history trigger records effective changes; versioned purposes and certificate-specific lists. | Verify issue/download, old fees, duplicate retries and legacy status mappings. A configurable purpose list is narrower than a generic dropdown editor. |
| 3. Payments, receipts and duplicate references | QR Ph checkout, server confirmation and provider-ID ledger. Cemetery payments have their own method and receipt fields. | Validate one signed test webhook twice, one rejected amount and duplicate clerical references. Cemetery cash recording does not establish a complete certificate-office cash ledger. Agree on receipt issuer, uniqueness scope and reversals before changing financial records. |
| 3. Slots, announcements and media | appointments.py uses transactional capacity control. Scheduled public calendar notices expire in Asia/Manila. Mass transcript and summary have separate fields, draft import and staff editing. | Last-place contention, final-day visibility and bilingual recording review on staging. Summary generation currently selects opening sentences. The paused web process must stay paused. |
| 4. Reports, charts and exports | office_reports.py, ReportView.tsx, ReportChart.tsx and SupervisorReports.tsx. Office filters for date, type, status and payment method. Supervisor activity supports a staff email filter. This branch adds payment-date grouping to charts, PDF and XLSX; test-mode payments are excluded from collections. | Verify against receipts. Entries without paid_at cannot be assigned a collection month. An activity email filter does not attribute each historical certificate to a processing staff member. |
| 4. Wider metrics and schedules | Registration growth, active/inactive/unassessed members, storage bytes, cemetery status, appointment utilization, staff events; report_schedule/report_run and run_scheduled_reports.py. | Configure and monitor an authorized scheduler; verify a missed invocation and retry. Scheduled reports currently use request-creation dates. No paid cron is required to run the command manually. |
| 5. UX, errors and evaluation | PR 9 introduced shared sage, white and forest-green styling, larger controls, homepage account actions, marked calendar and responsive dashboards. This branch distinguishes failed notice loading from a genuinely empty list. | Test at tablet width, keyboard-only navigation, zoom, sign-out/back, protected downloads and real older-user tasks. The navy/gold wording in the original checklist predates the approved redesign. |

## Architecture decisions requiring review

Keep foreign keys on the existing parish_auth user IDs. A Supabase auth.uid() policy will not contain the identity from a custom Next session. Select a documented database identity propagation strategy and least-privilege roles before migrating legacy grants. Preserve raw provider events and historical status spellings. Do not synthesize staff IDs, paid dates or legacy cash receipts. Use a verified account for supervisor designation instead of seeding an active placeholder login. Keep mocks in isolated tests.

## Verify on Windows

From the existing backup-church checkout:

~~~powershell
git fetch origin
git worktree add --detach ..\parish-review origin/evaluation/staging-readiness
cd ..\parish-review
npm ci
npx prisma generate
npx tsc --noEmit
# Set ARCHIVE_POSTGRES_URL to the disposable PostgreSQL clone before the build.
npm run build
py -3.11 -m venv ..\parish-review-env
$py = '..\parish-review-env\Scripts\python.exe'
& $py -m pip install -r church_backend/requirements.txt
$env:PYTHONPATH = 'church_backend'
# Set PARISH_TEST_POSTGRES_URL to a disposable SQLAlchemy postgresql+psycopg URL.
& $py -m py_compile church_backend/server.py church_backend/office_reports.py
& $py -m unittest discover -s tests
& $py -m unittest discover -s church_backend -p test_ocr_fields.py
node tests/test_totp_reference.cjs
node tests/test_interactive_proxy.cjs
git diff --check origin/staging...HEAD
~~~

The payment report test creates a transient temporary table and covers payments crossing midnight in Manila, office isolation, exclusion of test payments, filters and both exports. The optional PostgreSQL test skips when its fixture URL is absent. On the clone, run the read-only inventory with each application role:

~~~powershell
psql -X -v ON_ERROR_STOP=1 -f scripts/audit_postgres_storage.sql
~~~

Use deploy/EVALUATOR-ROLLOUT.md for each stage's feature settings, migration order, backup and restore commands. This branch needs no new schema migration. To contribute further changes, use a new branch from the review checkout, stage only named files, inspect git diff --cached, commit, and open a PR against staging. On Render confirm the Live SHA of ifimarag and smart-parish-api; render.yaml uses smart-parish-web as its blueprint name. Confirm the actual service mapping before editing configuration. Merge/deploy only when authorized and after backing up ephemeral legacy files. Roll back this branch by reverting its merge and redeploying the previous reviewed application version. Preserve all database records and reconcile submissions since release.

## Defense questions

1. How do you verify a parish member? Email confirms control of an inbox. Staff compare private ID evidence against a parish record and record a decision and reason.
2. Who can request a relative's certificate? A claimant submits relationship proof. Staff check the owner and an existing record; disputed claims go to the designated supervisor.
3. How do you limit office access? The session role, API scope and record category determine which requests and downloads the office can handle.
4. Why keep custom authentication? It preserves existing account IDs, passwords, MFA enrollments, sessions and links to records.
5. How are payments verified? Server confirmation uses provider identifiers and ledger records. Test payments are excluded from reported collections.
6. Why can November collections differ from November requests? Someone can pay in November for an October request. The payment-date report uses the recorded payment timestamp in Philippine time.
7. How do you prevent double booking? The database serializes capacity changes. Test two competing bookings for the final slot.
8. What survives a server restart? PostgreSQL rows and objects successfully copied to durable private storage. Legacy local-only files need an independent backup.
9. How is restoration demonstrated? Restore a snapshot into an empty test database, restore matching objects, verify checksums, then retrieve an authorized document.
10. What happens if transcription fails? The web API does not run Whisper. Staff can retry the separate worker, review its draft and save corrections while the parish portal continues serving requests.

## Source inventory at the audited revision

### Next pages (21)

`/about`, `/admin/member-approvals`, `/admin`, `/admin/portal-settings`, `/appointments`, `/burial-admin`, `/claims`, `/complete-profile`, `/contact`, `/dashboard`, `/forgot-password`, `/login`, `/office-reports`, `/`, `/privacy`, `/register`, `/reset-password`, `/services`, `/staff-mfa`, `/verification`, `/verify-email`

### Next API routes (22)

`/api/admin/membership/[id]/evidence`, `/api/admin/membership`, `/api/auth/complete-profile`, `/api/auth/forgot-password`, `/api/auth/google`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/phone-otp`, `/api/auth/profile`, `/api/auth/register`, `/api/auth/resend-verification`, `/api/auth/reset-password`, `/api/auth/staff-mfa`, `/api/auth/verify-email`, `/api/backend/[path]`, `/api/location/ph`, `/api/parish-calendar`, `/api/paymongo/webhook`, `/api/portal-config`, `/api/ready`, `/api/verification`

### Flask endpoints

- appointments.py — `/api/appointments`
- office_reports.py — `/api/reports/certificates`, `/api/reports/members`, `/api/reports/schedules`, `/api/reports/schedules/<int:schedule_id>/latest`
- relationship_claims.py — `/api/claims`, `/api/claims/<int:claim_id>/proof`, `/api/claims/<int:claim_id>/review`
- server.py — `/`, `/api/announcements`, `/api/announcements/<int:announcement_id>`, `/api/archive/audit-logs`, `/api/archive/deleted-documents`, `/api/archive/documents`, `/api/archive/documents/<int:document_id>/delete`, `/api/archive/documents/<int:document_id>/filled-template`, `/api/archive/documents/<int:document_id>/original-scan`, `/api/archive/documents/<int:document_id>/promote-filled-template`, `/api/archive/documents/<int:document_id>/restore`, `/api/archive/documents/<sacrament_type>`, `/api/archive/ocr-preview`, `/api/archive/stats`, `/api/archive/template-preview`, `/api/archive/upload`, `/api/cemetery/burials`, `/api/cemetery/dashboard`, `/api/cemetery/files/<path:filepath>`, `/api/cemetery/map`, `/api/cemetery/payments`, `/api/cemetery/reservations`, `/api/cemetery/reservations/<int:reservation_id>/contract`, `/api/cemetery/reservations/<int:reservation_id>/payments`, `/api/cemetery/slots`, `/api/cemetery/slots/<int:slot_id>`, `/api/health`, `/api/masses`, `/api/masses/<int:mass_id>`, `/api/masses/<int:mass_id>/status`, `/api/masses/<int:mass_id>/transcribe-ai`, `/api/masses/<int:mass_id>/transcription`, `/api/paymongo/confirm-internal`, `/api/public/calendar`, `/api/requests`, `/api/requests/<int:request_id>`, `/api/requests/<int:request_id>/attach-document`, `/api/requests/<int:request_id>/cancel`, `/api/requests/<int:request_id>/demo-pay`, `/api/requests/<int:request_id>/download`, `/api/requests/<int:request_id>/generate-document`, `/api/requests/<int:request_id>/hide`, `/api/requests/<int:request_id>/paymongo-checkout`, `/api/requests/<int:request_id>/release-document`, `/api/requests/<int:request_id>/select-record`, `/api/requests/<int:request_id>/status`, `/api/requests/pricing`, `/api/transcriptions`, `/api/user/cemetery/available-slots`, `/api/user/dashboard-summary`, `/dashboard`, `/delete/<int:id>`, `/download/<path:filepath>`, `/files/<path:filepath>`, `/folder/<sacrament_type>`, `/generated/<filename>`, `/request-baptismal`, `/search`, `/upload`

### Data definitions

- Prisma models — `User`, `Session`, `EmailVerificationToken`, `PasswordResetToken`, `StaffMfa`, `StaffMfaChallenge`, `PhoneVerification`
- SQLAlchemy models — `Document`, `AuditLog`, `CertificateRequest`, `MassRecord`, `Announcement`, `CemeterySlot`, `CemeteryReservation`, `CemeteryPayment`, `BurialRecord`
- Additive SQL tables — `parish_auth.membership_evidence`, `parish_auth.policy_consent`, `parish_private.announcement_slide`, `parish_private.appointment_booking`, `parish_private.appointment_slot`, `parish_private.certificate_fee_history`, `parish_private.member_activity`, `parish_private.policy_version`, `parish_private.purpose_catalog`, `parish_private.relationship_claim`, `parish_private.report_run`, `parish_private.report_schedule`, `parish_private.request_claim`, `parish_private.storage_quota`, `parish_private.upload_object`

Provider payment ledger and legacy fee tables also have separate migration helpers in scripts/. Compare the catalog inventory with these source definitions to find drift.
