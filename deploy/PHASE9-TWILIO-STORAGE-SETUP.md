# Smart Parish Phase 9 — Twilio + cloud setup checklist

**Environment:** Render web `ifimarag` (Next.js) and API `smart-parish-api` (Flask), Supabase `smart-parish-staging`. Do not copy secrets into Git, chat, screenshots or source files.

## A. Cloud document storage — already working on current staging deployment

On **Render → smart-parish-api → Environment** verify the existence of:

| Name | Description |
| --- | --- |
| `PARISH_STORAGE_PROVIDER` | `supabase_rest` |
| `PARISH_PRIVATE_UPLOADS` | `enabled` |
| `PARISH_SUPABASE_URL` | Project root: `https://YOUR-REF.supabase.co` (NOT /rest/v1, NOT Supabase dashboard, NOT storage S3 URL) |
| `PARISH_SUPABASE_SERVICE_ROLE_KEY` | Legacy `service_role` key or compatible backend secret; **backend only** |
| `PARISH_S3_BUCKET` | `smart-parish-private` |

The bucket must be **private** (`public=false`). Do not create a public bucket for sacramental scans, identity documents or relationship evidence. Storage currently uses content-addressed objects with checksums and `parish_private.upload_object` indexing. Deleting a DB row or clearing Render's filesystem does not substitute for a storage backup.

After any Render environment change, **Save, deploy** and verify:
- `https://ifimarag.onrender.com/api/backend/api/archive/storage-status` returns `"durable":true` under an authenticated admin account;
- one fictional image uploads, reopens after refresh and survives a service restart;
- an unauthorized user cannot fetch another user's protected document.

Run this read-only SQL in Supabase SQL Editor:

```sql
SELECT id, public FROM storage.buckets WHERE id = 'smart-parish-private';
SELECT category, byte_limit, max_file_bytes
FROM parish_private.storage_quota ORDER BY category;
SELECT COUNT(*) AS indexed_objects FROM parish_private.upload_object;
```

### Limits and storage capacity

Current official Supabase Free plan limit: **50 MB maximum per uploaded file**, approximately **1 GB file storage**. Storage service/provider and application quota constraints also apply. Suggested future policy: certificate scan <=10 MB, ID evidence <=3 MB, announcement image <=5 MB, video <=20 MB and <=30 seconds, no bulk Mass video in Supabase. **These are planned media limits, not proof that the current application accepts media uploads.**

The existing Flask `private_uploads.preserve` path enforces `storage_quota` category total and individual file limits for indexed documents. Review quotas before adding new categories. Keep video on YouTube or another permitted service until a secure upload, transcoding, MIME-check and playback path exists. Do not upload an unverified 100 MB video on the Free plan.

## B. Twilio PHONE OTP — already implemented as an optional provider

**Important:** Configure OTP on **Render → ifimarag → Environment**, not on the Flask `smart-parish-api` service. The Next.js route is `src/app/api/auth/phone-otp/route.ts`.

1. Create/sign into a Twilio account: https://console.twilio.com/
2. Verify your test Philippines mobile recipient and confirm the Twilio account permits outbound messages to the Philippines. **Trial accounts can send only to verified recipient numbers**; delivery and sender availability vary by account and country.
3. In Twilio Console, find **Account SID** (`AC...`) and **Auth Token**. Set up a Messaging Service with an authorized sender (`MG...`) where supported; otherwise use a Twilio sender number that can send to PH recipients.
4. In **ifimarag → Environment** add these server-only values:

```text
PHONE_OTP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=<AC... from your Twilio account>
TWILIO_AUTH_TOKEN=<secret from Twilio>
TWILIO_MESSAGING_SERVICE_SID=<MG...>
PHONE_OTP_PEPPER=<random secret at least 32 characters>
```

Either `TWILIO_MESSAGING_SERVICE_SID` **or** `TWILIO_FROM_NUMBER` is needed. For a sender-number configuration use `TWILIO_FROM_NUMBER` instead of the Messaging Service SID. Do not set both unnecessarily.

Generate a new pepper locally in Windows PowerShell without printing it into logs:

```powershell
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$pepper = [Convert]::ToBase64String($bytes)
Set-Clipboard $pepper
# Paste the clipboard into the private Render environment variable value, then clear the clipboard manually.
```

5. Save and deploy **ifimarag**. Sign in with a fictional, **approved and email-verified parishioner** using the verified test number saved in canonical `+639XXXXXXXXX` format. Open the profile's **Mobile number verification** panel and press **Send SMS code**. Submit the received six digits to verify.
6. Existing OTP safeguards in code: 5-minute expiry, 60-second resend cooldown, five sends/day, five attempts and exact Philippine E.164 mobile format. Verify the rate-limit behavior on test data without exhausting paid credits.

**Do not put Twilio SID/token/pepper in NEXT_PUBLIC_ variables.** Never store or print an OTP code in application logs.

## C. Payment tracking and SMS status updates — NOT enabled by OTP setup

The existing Twilio path is only for **phone ownership verification**. It does not automatically text payment status, pickup readiness or announcements. Implement independently using an **idempotent notification outbox**, with explicit consent, a verified payment webhook / staff transaction, event-type controls, provider response tracking and email fallback. The status should change in the database even if SMS fails. The UI must not claim a message was delivered unless the provider confirms it.

Suggested events: request approved or needs evidence, verified payment received, document ready for pickup, document physically released; general announcement blasts should require opt-in and a quota.

## D. Announcement calendar feature switch — requires confirmed migration

The scheduled announcement metadata migration is `deploy/migrations/20261120_announcement_slides.sql`. Verify its table exists in the current project. Only then, on **smart-parish-api** add `PARISH_ANNOUNCEMENT_SLIDES=enabled`, and on **ifimarag** add `NEXT_PUBLIC_PARISH_ANNOUNCEMENT_SLIDES=enabled`. Save/deploy the two services. From Admin Announcements, create a fictional `Public calendar notice` with valid from/to dates. Confirm it appears on both the public calendar and the compact parishioner dashboard calendar in Manila time.

Currently selectable announcement media are bundled parish slide photos; **generic 30-second media upload is not yet implemented**. Do not expose private bucket objects by pasting their URLs into announcement fields.

## E. Identity and relative record requests — staged verification

- Email verification and parish membership approval protect registration.
- Phone OTP proves control of a phone number, **not** relationship to another person's record.
- `PARISH_RELATIVE_CLAIMS` + `NEXT_PUBLIC_PARISH_RELATIVE_CLAIMS` opt-in features require an approved matching claim, review of identity/relationship evidence and existing relationship-claim DB migrations. Enable these only after testing role scope and the complete claim submission/approval process.
- The online archival filled template is marked `ARCHIVAL DRAFT - NOT AN ISSUED CERTIFICATE`. Physical staff-controlled pickup remains the official handover. A watermark is not technical copy prevention.

## F. Do-not-merge prerequisites

- CI passes (TypeScript, build, Python tests).
- Backup the Postgres database and private Storage objects, and test one restore.
- Test a fictional baptismal request end-to-end including permission checks.
- Test Burial Admin cannot access Main Admin archives.
- Do not disable/remove the legacy cemetery database before migrating Land Agreement request dependencies.
