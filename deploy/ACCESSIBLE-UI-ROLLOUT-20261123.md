# Smart Parish: accessible UI rollout and capstone role map

Status: UI implemented in PR #27; **NOT DEPLOYED** until CI and acceptance checks pass. No database migrations, role grants, payment changes or storage resets in this PR.

## Source blueprint interpreted
- Public homepage: header / left integrated Login-or-Register card / right rotating parish photo slides / right lower published announcements / footer; parish calendar remains beneath.
- Header does not duplicate an anonymous Login button on the homepage. Bookmarks to /login and /register redirect to the respective in-page form.
- Users with existing sessions continue to their role-specific dashboard via a header shortcut.
- All workspaces use neutral white surfaces, the same maroon accent, readable typography, keyboard focus states, consistent minimum 44px controls and mobile sidebars.
- Parishioner dashboard: three top tasks (request certificate, notices/calendar, watch Mass), direct latest request tracking, opt-in notification details and a small latest-updates area. Removing visual clutter does **not** delete any notification or request record.
- Staff workspace: one place for all sacramental archives, requests, and historic deceased record inspection; Staff does not manage Mass, policy or accounts.
- Super Admin: overview/oversight, staff management, membership, Mass transcription, announcements, reports, website editor, settings, and audit. No Staff-only document mutation controls.

## Roles
Exactly three current app roles: ADMIN (shown as Super Admin), STAFF (shown as Church Staff), USER (shown as Parishioner). The legacy BURIAL_ADMIN enum label remains for compatibility but is not an active final user role. The requested PRIEST category is a possible staff/title designation, **not an additional privileged role**, unless the adviser approves a role model change.

## Admin feature inventory: actual project status
- Dashboard: live summary, archive categories, request and historical burial-record monthly activity, recent audit feed and quick actions in PR #27. New upload counts mean archived document scans recorded this month. Not a substitute for formal analytics.
- Parish Records: existing archive/search/request functionality is assigned to STAFF. Duplicate detection, CSV/Excel bulk import, version diff/history and soft-delete-only enforcement need separate backend QA/work.
- Burial Services: historical deceased records are STAFF read-only; cemetery plot reservation, leases, renewal alerts, burial schedules and payments were removed from the old Burial Admin scope and are **not** restored in this UI PR. Thesis scope must explicitly resolve this.
- Requests: STAFF retains existing Pending → Approved/Rejected → Ready → Released state and payment release safeguards; "Under Review" is NOT an existing backend status. Adding it is a separate end-to-end migration/test.
- AI: PR #26 added browser-hosted short-clip transcription draft and summary; a long Mass queue, progress/retries, storage and Latin validation remain distinct tasks.
- Media Library: Mass recordings and summaries remain under Super Admin; tags, visibility tiers and durable usage gauges are not added here.
- Users: Staff invitations/deactivation and member approval already exist. Login history and reset workflows need acceptance QA.
- Announcements/calendar: existing features retained; public homepage now shows active published announcements using a new read-only endpoint.
- Reports: existing reporting and PDFs linked; additional printable registry exports and burial report QA remain.
- Settings: existing site content and editable policies/fees retained; backup-and-restore controls are NOT invented by this UI change.
- Security: current role enforcement, sessions/MFA, activity audit and payment checks stay unchanged. A full RA 10173 compliance review still requires parish policy and documented handling practice.

## Mandatory pre-merge manual smoke checks
1. Confirm GitHub Actions latest PR #27 head commit all green. Keep live `staging` deployments unchanged before merge.
2. Verify `/` at 100% browser zoom, 360px mobile and 768/1280 desktop. Use keyboard-only Tab/Enter, text zoom to 200%, reduced motion, nav/masthead.
3. Homepage: login with USER, STAFF and ADMIN credentials. Confirm MFA for privileged roles, email verification errors, signout, forgotten password and old bookmarks.
4. Registration: required name/email/password, phone validation, confirmation mismatch, required privacy consent, resend verification, and Google signup only after consent.
5. Super Admin: summary counts, staff management, member approvals, Mass recordings cloud transcript/editor/save, announcements publishing, audit and fees.
6. Staff: unified archive categories and certificate requests, deceased read-only view; STAFF must fail to enter /admin, admin/staff or configure announcements, fees, AI.
7. Parishioner: requests and payment tracking preserved, only own certificates downloadable; published Masses and announcements still accessible.
8. Public announcements: current active notices visible, future/expired scheduled slide entries hidden when publication metadata exists; unavailable DB displays a useful message.
9. Both Render services deploy the **same approved staging commit** if code changes touch both; this PR only changes Next.js/Prisma API and does not require Flask redeployment.
10. Roll back web deploy if core auth/certificate flows regress. No production tables are dropped and no account roles are migrated in this UI PR.

## Do not claim these are complete before evidence
- Live visual accessibility/user testing by older parishioners
- Bulk archival import, duplicate matching or legal document versioning
- Lease renewal scheduling, cemetery services transactions
- Cloud long-duration transcription processing queue
- Full report exports and restore rehearsal
