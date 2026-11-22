# Phase 9 — Parish-focused workflows (review before deploying)

This change intentionally contains only **low-risk UI scope reductions and a read-only dashboard calendar**. It does not remove legacy database records, drop tables, disable audit logs, or alter live payment/authorization logic. Continue using fictional records for evaluation.

## Included

- Main Admin: one Requests queue; no Urgent Requests or Recycle Bin navigation.
- Archive screens: ordinary Delete buttons hidden; historical restoration/deletion endpoints are retained temporarily for accountable recovery. They must later be reserved to the appropriate supervisor/retention workflow.
- Parishioner: removes urgent fee checkbox; new requests always send `isUrgent:false`. The Flask request endpoint **rejects** any new `isUrgent:true` submission (400), including crafted requests. Existing urgent requests remain in history.
- Burial Admin: document-only sidebar, with burial records, burial document requests, and burial archives. Slot/reservation/payment screens and the old cemetery KPI dashboard are not rendered. Historical data is untouched. NOTE: existing Land Agreement request logic still references cemetery slot data and must be separately redesigned, tested, and migrated before decommissioning the underlying endpoints.
- Parishioner dashboard: a compact accessible calendar queries the existing public calendar endpoint. Calendar data requires the existing announcement slides feature and migration; the component shows an honest error/empty state when unavailable.

## Activation prerequisites for scheduled notices

1. Confirm the `parish_private.announcement_slide` migration was applied (`deploy/migrations/20261120_announcement_slides.sql`). Do not run it repeatedly without reviewing state.
2. On Render **smart-parish-api**, enable `PARISH_ANNOUNCEMENT_SLIDES=enabled`.
3. On Render **ifimarag**, enable `NEXT_PUBLIC_PARISH_ANNOUNCEMENT_SLIDES=enabled`.
4. Publish one fictional **Public calendar notice** with start/end dates using the Admin Announcements page, then confirm it appears on the public calendar and the parishioner dashboard for the expected Manila date.
5. Verify a notice outside the publishing window does not appear. Scheduled announcement dates are not a general-purpose booking system.

## Still outstanding — do not claim these are working yet

- Announcement image/video **file uploads**: current admin UI supports only bundled parish slide images and existing `image_path` metadata. There is no general video upload/approval pipeline. Target: images <= 5 MB, clip <= 30 seconds and <= 20 MB, validated both server/client-side with content sniffing and a safe private/public serving policy. Supabase Free has a 50 MB max file size; the proposed 100 MB media file cannot be supported there. Do not configure a public bucket for membership IDs or sacramental scans.
- Twilio outbound notifications: current Twilio option is for **phone OTP**, not a verified payment/announcement/status outbox. Implement an idempotent outbox with opt-in, event filtering, provider delivery receipts, rate limits and fallback to email after explicit test approval. Never assume OTP code delivery means notices work.
- Authorizations: `PARISH_RELATIVE_CLAIMS` / `NEXT_PUBLIC_PARISH_RELATIVE_CLAIMS` are optional feature gates for the already-coded relationship claim review. Validate DB migrations and enforce server ownership first; no simple checkbox should replace evidence verification.
- Watermark-only preview: check the existing generated PDF permissions and watermark in a real non-official download. Do not treat a watermark as copy protection; the physical issued certificate is signed/released only by staff.
- Online payment and pickup: verify PayMongo webhook + staff approval + physical pickup records end-to-end; reversals must not delete ledger rows.
- Backups: `parish_private.upload_object` is indexed, but backup/restore drills must include actual Supabase Storage objects (not just PostgreSQL dumps).

## Acceptance — BEFORE merging

```powershell
git fetch origin
git switch -c phase9-review origin/phase9/parish-workflow-focus-20261122
npm ci
npx prisma generate
npx tsc --noEmit
npm run build
```

On an isolated staging account, confirm Main Admin requests/archive, Burial Admin document screens, parishioner request fee without urgent surcharge, calendar day selection, and no visible archive Delete. Verify backend role enforcement and existing records remain intact.
