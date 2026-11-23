# Smart Parish announcement studio and notification rollout (2026-11-23)

This feature is **NOT live** until PR #28 is merged, the SQL is applied,
Render has all required server variables, both current services are healthy,
and the real SMS/email smoke tests have been performed.

## What is implemented in PR #28
- Super Admin notice studio: title/body, category, event date, publication start/end,
  priority, uploaded visuals and manual announcement notification queue.
- Media: max 4 JPG/PNG/WebP pictures under 5 MB each + 1 MP4 under 18 MB,
  maximum MP4 declared duration 30 seconds, and 24 MB combined per announcement.
  Server verifies MIME signatures and MP4 movie-header duration. Uploaded pictures
  are decoded, resized to at most 1920×1080, converted to WebP and stripped of
  EXIF/location metadata. Uploaded video is not transcoded; prepare a web-compatible H.264 MP4.
- Photo slideshow duration: configurable from 5 to 30 seconds; video is played
  muted as a background slideshow clip with playback controls. User may pause.
- Public homepage slideshow and notice previews; parishioner notices and calendar
  all read the same live date-filtered source. Event dates appear on the calendar;
  notices without event dates appear throughout their publication period.
- Publication dates follow **Asia/Manila** calendar days. A notice with end date
  2026-12-01 stops appearing at 2026-12-02 00:00 Philippine time.
- Uploaded files live in the existing PRIVATE Supabase bucket, under
  `notices/<announcement-id>/<uuid>.<extension>`. Viewers only receive
  `/api/notice-media/<id>` streams while that notice is active/published.
- Auto expiry: a public read is immediately hidden after its end date,
  independently of cron or API health. Secure cleanup removes expired DB rows,
  slides and private Storage files, leaving audit-log history.
- Announcement email/SMS: separately opted-in under My Profile; SMS additionally
  requires OTP-verified saved phone and an online txtBee phone. Super Admin explicitly
  queues each announcement once per consenting user; status queue is separate.
- Existing verified PayMongo, staff-approved certificate statuses, cash payment,
  cancellation and membership review notifications stay connected to their authoritative
  events; no simulated payment confirms as production payment.
- No modifications to sacramental records, user accounts, payment ledgers, or Mass data.

## Before merge
1. Make a fresh backup of the Supabase database and private bucket.
2. Open Supabase SQL Editor and **review/apply exactly once**:
   `deploy/migrations/20261123_notice_media_and_consent.sql`.
   This is an additive migration: no DROP TABLE, TRUNCATE or financial deletion.
3. On Render **ifimarag** (Next.js web), set server-only environment variables:
```env
PARISH_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
PARISH_SUPABASE_SERVICE_ROLE_KEY=<the existing service role secret>
PARISH_ANNOUNCEMENT_BUCKET=smart-parish-private
PARISH_STATUS_NOTIFICATIONS=enabled
PARISH_NOTIFICATION_EMAIL=enabled
PARISH_NOTIFICATION_SMS=enabled
PARISH_STATUS_AUTO_SEND=disabled
PARISH_NOTICE_CLEANUP_SECRET=<32+ random secret characters>
```
   Use the existing provider configuration:
   `RESEND_API_KEY` + `EMAIL_FROM` verified sender, **OR**
   `EMAIL_TRANSPORT=gmail-smtp` + Gmail app password (nodemailer required),
   and `PHONE_OTP_PROVIDER=textbee`, `TEXTBEE_API_KEY`,
   `TEXTBEE_DEVICE_ID`, `TEXTBEE_SIM_SLOT_INDEX`.
   Never enter API keys into React or NEXT_PUBLIC settings.
   The backend Flask service's private Supabase config does NOT imply
   the Next.js service has the same env variables.
4. Merge PR #28 to `staging` only after CI passes. Deploy **ifimarag**.
   The feature needs the DB migration on the *same* production database.
   The older Flask API can remain on the current compatible commit; this PR's
   new notice endpoints are handled by Next.js.
5. On GitHub `Repository Settings → Secrets and variables → Actions`, add
   `PARISH_NOTICE_CLEANUP_SECRET` with the **same** private value as Render.
   GitHub scheduled workflows run only from the repository's DEFAULT branch.
   If default is `master`, copy/merge the cleanup workflow into that branch
   after review; merging to staging alone will not activate it.
   Scheduled purge is 02:30 Philippine time each day. Manual Super Admin
   cleanup can be used until scheduled execution is configured.

## Evaluation smoke tests
A. Sign in as Super Admin. Open Announcements; save a fictional Mass event
   spanning today to tomorrow with a specific event date. Confirm the published
   notice is visible on the homepage, Parish Calendar, and Parishioner dashboard.
B. Attach a 1 MB JPEG and a 20–25 sec H.264 MP4 under 18 MB; upload and refresh.
   Confirm picture/clip previews, video playback and 5–30 sec photo duration.
C. Try a 31-second MP4, a mismatched MIME/type, and a large picture. Server
   must reject; nothing should appear on the public page.
D. Edit title/date and remove an attachment. Confirm the old media link becomes
   unavailable. Check expired future/older rows cannot be fetched by public media URL.
E. Create a fictional approved parishioner with verified email and phone.
   On My Profile, explicitly opt into announcement email/SMS. Super Admin queues
   this published notice, then sends a small batch.
   Confirm SMS arrives on the handset and email arrives in inbox.
   Gateway 'accepted' is NOT proof of handset delivery.
F. Disable SMS/email announcement opt-in and queue a different notice. Confirm
   no announcement provider send occurs for that recipient. Do not force-enable
   real parishioners' subscriptions for demonstrations.
G. Confirm a verified PayMongo TEST event says TEST, a verified cash payment
   triggers the correct request event, an unverified/pending payment triggers none,
   and a duplicate webhook/notice queue does not send twice.
H. Use the Admin cleanup button on an expired fictional notice. Confirm DB row
   and Supabase private files are removed and audit-log entry remains; repeat
   cleanup to verify idempotency. Do not delete an official sacraments record.
I. Check mobile 360px, 768px, desktop, keyboard navigation and 200% text zoom.
J. Confirm Church Staff and Parishioner cannot POST to any Admin notice API.

## Delivery mechanics and capacity
- Only new valid request transitions and member approvals trigger notifications;
  existing old records are not backfilled.
- In-app notifications never depend on an external SMS/email provider.
- A new announcement is not a public announcement SMS blast. Consent is
  separate from transactional request/payment preferences.
- Manual outbox dispatch sends at most 5 recipient events per click to avoid
  long free-Render requests and carrier limits. For larger audiences, a scheduled
  dispatch worker and quota budget should be reviewed before production launch.
- Each event uses a unique delivery key; accepted or uncertain provider sends
  are never automatically repeated. The parish must check actual delivery.
- The existing app supports Gmail SMTP as a fallback; production Resend requires
  a verified sending domain for arbitrary parishioner addresses.
- Storage cleanup uses GitHub Actions, not Render paid cron; if scheduled
  workflows are unavailable or inactive, public content still vanishes on
  expiry, but physical file deletion needs the manual Admin cleanup.

## Honest remaining features
- MP4 video transcoding, a streaming CDN and automatic video bitrate reduction
  are not supplied; upload an already compressed web-compatible MP4.
- No bulk SMS campaign system or emergency broadcast (needs separate
  explicit opt-in, budget, throttling, consent and delivery monitoring).
- No automatic retry of ambiguous external provider outcomes. Review rejected
  sends before deliberately retrying.
- No full calendar event reminder queue (e.g. "tomorrow's wedding") or
  periodic payment-due reminders; those need new domain models + scheduler.
- No proof that SMS is delivered to each phone until tested on the handset.
- Full retention/privacy-policy approval and consent records require parish review.
