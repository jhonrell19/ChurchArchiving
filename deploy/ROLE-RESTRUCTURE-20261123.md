# Smart Parish — Super Admin / Church Staff / Parishioner role migration

Status: DESIGN SPECIFICATION ONLY. Do not deploy or execute a database migration from this document alone.
Base: staging after PR #24 (ee100640be111e2088e06eba3e88042aff9f4cae).
Objective: replace the legacy Burial Admin role with a general document-only Church Staff role, consolidate all document types and request workflows under Staff, and make Super Admin the site supervisor plus Mass/AI/announcement owner.

## Final roles and boundaries

1. SUPER ADMIN (existing internal ADMIN can remain during a compatibility stage):
   - Owns: staff account creation, suspension/revocation, permissions, membership approval policy, system/site configuration, request purposes and fees, privacy policy, audit logs, dashboards/reports, backup/storage policies, Mass recordings, transcription review/publication, announcements.
   - Can oversee all documents and requests in read-only reports/audit views. Routine archive uploads/changes, certificate preparation, approval/release are assigned to Staff.
   - Staff provisioning MUST require validated email and MFA. A supervisor may not delete their only surviving supervisor account.
2. CHURCH STAFF (new STAFF role, replaces legacy BURIAL_ADMIN):
   - One unified `/staff` dashboard: Archive, Certificate Requests, Document Reports (within permissions), Request Notification Outbox.
   - Archive categories: baptismal, confirmation, marriage, burial, land_agreement, ownership (including deceased records and historical ownership agreements where applicable).
   - Request lifecycle: find matching archived record, approve/reject, draft/generate, attach reviewed final file, confirm request-linked authorized payment state, release after payment and review. Respect owner authorization and test-payment release restrictions.
   - Cannot manage roles/staff, site policy/configuration, fee schedules, backups, audit log administration, Mass/AI, announcements, or unrelated cemetery slot sales/payment accounting.
3. PARISHIONER (existing USER):
   - Register, verify email and phone, membership verification, request documents, view own tracking/payment, download only appropriately released own documents, view published parish materials.

## Migration plan (phased, NO one-shot destructive rename)

A. Readiness: backup PostgreSQL and Supabase Storage; inventory current ADMIN and BURIAL_ADMIN users, MFA enrollment, existing requests/docs and payment records; record both Render deployed revisions. Work only in isolated branch; no live deployment until checks pass.
B. Database: add STAFF value to parish_auth.Role using an explicit reviewed SQL/Prisma migration, migrate only verified legacy BURIAL_ADMIN staff account(s), preserve IDs, MFA and audit references, invalidate changed-role sessions and challenge tokens. Do not drop the old enum value until compatibility references have been removed and verified. Keep ADMIN as internal value until a safe separate rename, but label it Super Admin in UI.
C. Auth/routing: map ADMIN -> /admin, STAFF -> /staff, USER -> /dashboard; rename or redirect old /burial-admin only after role checks. Secure all pages and APIs with backend enforcement. Staff login continues email verification and TOTP MFA. Existing ADMIN remains able to log in.
D. Flask and Next.js proxy: remove ADMIN=main, BURIAL_ADMIN=burial document silo assumptions. A STAFF session can work across all six document types and one consolidated request queue. ADMIN gets narrowly scoped administrative oversight only, not request/archival mutations. Preserve independent owner/payment/verified record restrictions and reject privileged access by manipulating scope query params or spoofing role headers.
E. UI: Super Admin has Dashboard, Staff Accounts, Membership Approvals, Mass Recordings, Transcriptions, Announcements, Site/Fees/Policies, Reports, Logs/Backup controls. Church Staff has Dashboard, Archives (six categories), Requests (one queue, filters by document type/status), request-linked payment/notifications, document reporting if authorized. No Urgent Requests, Recycle Bin, separate Burial Admin or cemetery slot-sale UI.
F. Staff management: only Super Admin creates/disables staff, invites/verified email, enforces MFA, revokes sessions upon deactivation/role changes; audit all privileged changes.
G. Tests: after Prisma generation, TypeScript build and Python tests, exercise each role and every archive type; verify STAFF 403 on Mass/transcription, announcement writes, settings, staff management, audit/backup; USER 403 on staff/admin data; ADMIN oversight works but cannot perform staff-only record mutations. Test cross-office archive/request workflow, test payment safeguards, notification outbox, ID evidence and MFA. Test signed-in and signed-out back-button protection.
H. Rollout: apply tested additive migration before deploying compatible backend and frontend at the same revision; verify existing ADMIN login, migrated STAFF login and both data scopes, then perform reversible cutover. Keep PR unmerged until evaluation acceptance.

## Explicit non-goals
- DO NOT delete burial documents, ownership/land agreements, payment ledgers, backups, audit logs, or existing account history.
- DO NOT run `TRUNCATE CASCADE`, drop production tables, disable financial safeguards or bypass MFA.
- DO NOT assume AI transcription is cloud-based; separate background-worker implementation is a distinct task.
- DO NOT merge older draft PR #17 wholesale to implement this role change.

## Acceptance scenario
Super Admin logs in with MFA, creates/activates Staff and changes settings. Staff logs in with MFA, opens a single Archives screen to find a baptismal and a burial document, receives a parishioner's certificate request, verifies the source, prepares/reviews a final document, and releases only after legitimate payment confirmation. Parishioner sees the timeline and authorized download. Super Admin can still manage Mass transcription, announcements and staff, while Staff is forbidden from those endpoints.
