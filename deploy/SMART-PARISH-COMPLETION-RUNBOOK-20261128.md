# Smart Parish — request, payment, SMS and evaluator completion runbook

**Deployment guard:** This branch does not change Render or Supabase itself. Test in a nonproduction environment first. Never copy real SMS keys, passwords or church records into GitHub issues, screenshots or test fixtures. Take a verified backup before applying SQL migrations.

## 1. Before enabling payment or SMS

- Keep **PayMongo test mode** clearly identified. A simulated or previously test-Paid certificate must **not** be silently converted into cash or live-Paid. Reconcile it separately with a documented process; do not delete financial audit records.
- Obtain the church's approval for who may collect cash, which receipt/reference format to use, and where official collections are recorded. Real cash must have been physically handed to the parish's authorized cashier; a screenshot or a promised transfer is not enough.
- Verify the Render Flask backend is live and `/api/ready` reports `ready`; do not run a heavy AI transcription job on the web worker.
- Verify all three roles with independent normal and Incognito sessions, especially Staff-only request access and Admin Homily access.

### Safe database checks (Supabase SQL Editor: read-only)

```sql
SELECT
  to_regclass('parish_private.certificate_request') AS requests,
  to_regclass('parish_private.cash_receipt_ledger') AS cash_receipts,
  to_regclass('parish_auth."NotificationEvent"') AS notification_events,
  to_regclass('parish_auth."NotificationPreference"') AS notification_preferences,
  to_regclass('parish_auth."PhoneVerification"') AS phone_verifications;
SELECT pg_get_constraintdef(oid) AS actor_role_constraint
FROM pg_constraint
WHERE conrelid = to_regclass('parish_private.cash_receipt_ledger')
  AND conname = 'cash_receipt_ledger_actor_role_check';
```

If the cash table is absent, apply `deploy/migrations/20261122_cash_receipts.sql` **only after backup and approval**. Then apply `deploy/migrations/20261128_staff_cash_ledger_roles.sql` to admit current Staff while retaining historical Admin audit rows. Neither migration creates payments. For notification tables, review `20261122_status_notifications.sql` and `20261123_notice_media_and_consent.sql`, check which have already been applied, back up, and apply missing migrations in order. Never wipe the existing auth or archive schemas.

## 2. Real office cash collection (Flask service)

Set `PARISH_CASH_RECEIPTS=enabled` in **smart-parish-api** only after the two cash migrations and authorization checks pass.

In Church Staff → Certificate requests → click the requester → Step 4 **Office release**, staff can record real cash after approval, with a unique official receipt number and a 5–500 character explanation. The server reads the existing approved fee, restricts the request to Church Staff, prevents duplicate Paid entries, and writes an append-only ledger row. A correction creates a *separate* reversal ledger row; the original receipt remains intact. After uploading the approved final document and genuinely recording the required payment, Staff may release the certificate.

**No authorized church collection/receipt = do not enable** real cash recording. This is real office cash handling, **not** an automated online payment gateway. Without an authorized receiving account/activated merchant, the site cannot accept real online QR Ph into the church's account.

## 3. textbee SMS via Android phone (Next.js service)

In **ifimarag** → Environment, enter secret values privately (never share them here):

```dotenv
PHONE_OTP_PROVIDER=textbee
PHONE_OTP_PEPPER=<generate-a-unique-long-random-secret>
TEXTBEE_OTP_ENABLED=true
TEXTBEE_API_KEY=<your-key>
TEXTBEE_DEVICE_ID=<your-phone-device-id>
TEXTBEE_SIM_SLOT_INDEX=0
PARISH_STATUS_NOTIFICATIONS=enabled
PARISH_NOTIFICATION_SMS=enabled
PARISH_NOTIFICATION_EMAIL=enabled
PARISH_STATUS_AUTO_SEND=enabled
```

`TEXTBEE_SIM_SLOT_INDEX=0` selects SIM slot 1 on supported devices; confirm the actual textbee slot before enabling. SMS and email dispatch can be enabled independently: keep `PARISH_NOTIFICATION_EMAIL` disabled until Resend is working with an approved sender, and keep `PARISH_STATUS_AUTO_SEND` disabled until one end-to-end notification has arrived. `TEXTBEE_OTP_ENABLED=true` applies to verified phone OTP, not request-email OTP (which is no longer required).

Phone setup: install/login to textbee on the Android gateway phone; grant SMS permissions, select the SIM with available SMS balance, allow background operation, maintain internet service, and confirm actual delivery to a permitted test phone. Carrier SMS charges/limits and textbee plan limits still apply. A textbee API success is **accepted/queued**, not a handset delivery receipt.

A verified, approved Parishioner must explicitly opt in to SMS updates and verify their saved `+639xxxxxxxxx` number; email verification remains mandatory at account registration. No SMS is sent to an unverified or opted-out phone. After a successful request submission, Staff approval, document-ready transition, *verified real* cash receipt/live payment, rejection, cancellation or release, the API records a deduplicated notification event. When auto-send is enabled it attempts dispatch immediately; if the phone/provider is down, the event state is preserved, and the payment or certificate action is **not rolled back**. The Staff Notification management panel shows queue status and supports explicit draining of pending events, without resending uncertain outcomes automatically. Do not run blind retries.

## 4. Essential test sequence

Use fictional or church-approved test documents and separate test accounts.

1. **Registration and validation:** Unicode/Filipino names with apostrophes work; digits in names fail; dates use calendar and reject future/impossible dates; OTP/page/line fields accept digits only; reference numbers may contain their legitimate letters/dashes.
2. **Account isolation:** normal window Admin; Incognito Staff; separate Parishioner session. No cross-account overwrite, cached protected-page access or wrong-role direct API permissions.
3. **Requests:** create a verified Parishioner request → Staff expands requester name → review Account information and Requested information → use the four clickable workflow steps → verify matched archive record → approve → generate/review/upload final document.
4. **Cash payment:** with approved church cashier and a real collection only, enter a unique official receipt in Step 4; check request shows `Paid / CASH`, an actual ledger row and a correct message. An intentional, authorized correction records a separate reversal. A duplicate receipt must fail. Test-Paid stays blocked from production release.
5. **Notifications:** with one verified opted-in mobile, confirm actual receipt of an approval and a genuine payment update. An opted-out user gets no SMS. Disable Wi-Fi/mobile data on gateway, ensure a pending/uncertain state is shown and **payment processing still succeeds**; restore the phone and inspect status without blindly replaying.
6. **OCR and certificate draft:** upload a permitted scanned record; review extracted fields; match it to the request; generate the draft; complete authorized legal/signature details; upload reviewed final file; verify durable storage after a service restart.
7. **AI transcription:** test local Faster-Whisper on a Tagalog-English recording, review original-language transcript and summary, import/publish; do not claim in-browser Render transcription is active while the API deliberately blocks CPU-heavy jobs.
8. **Reports and thesis objectives:** cross-check one cash collection (and reversal, if relevant) against finance reports, request status history, member and archive reports. Preserve screenshots, test results, and official approvals for final defense.

## 5. Definition of done / limitations

Offline CI passing is **not** evidence that SMS reached a device or real money was collected. Treat any feature as live only after the manual steps above pass. This deployment can safely record actual cash, but cannot claim **automated online QR Ph real-money acceptance** without an authorized bank/e-wallet/merchant account. A church-authorized collector and valid receipt process are required for real cash. Heavy server-side transcription remains a hosting-resource limitation.

Do not merge/deploy unrelated changes; compare the tested commit with the Render deployed commit before promoting. Never apply database resets, mutate old PayMongo test payments, or bypass Flask release safeguards.
