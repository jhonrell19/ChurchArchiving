# Phase 9: real txtBee request + payment notifications

## Status as of PR (not live until merged, migrated and explicitly enabled)

- Existing Supabase private bucket and PostgreSQL remain the cloud. **Oracle Cloud is not required.**
- PR #21 real request/payment tracking is already merged to staging. It works independently of SMS.
- Existing phone OTP uses txtBee only after the Render **ifimarag** environment is saved and deployed and an approved account completes OTP verification. A successful manual text from txtBee does NOT prove OTP passed.
- This new patch: private consent preferences, event outbox, in-app status inbox, SMS/email queue, Main/Burial scoped staff manual dispatch; events originate only from post-commit Flask request/status changes, verified PayMongo internal callback, and approved cash receipt/reversal. No direct client event creation, no public phone lookup. Failed provider delivery cannot roll back request approval or financial ledger.

## Preflight

1. Back up PostgreSQL, verify the existing `parish_auth` schema and private Supabase Storage.
2. Apply `deploy/migrations/20261122_status_notifications.sql` **ONCE** using the Supabase SQL Editor after review. It is additive and contains no deletions of users, payments or documents.
3. Run read-only SQL:

```sql
SELECT to_regclass('parish_auth."NotificationEvent"') AS outbox,
       to_regclass('parish_auth."NotificationPreference"') AS preferences;
SELECT COUNT(*) AS existing_notices FROM parish_auth."NotificationEvent";
```

4. Confirm existing TXTbee settings in **Render → ifimarag → Environment** (no secrets shared to chat):

```text
PHONE_OTP_PROVIDER=textbee
TEXTBEE_OTP_ENABLED=true
TEXTBEE_API_KEY=<private real key>
TEXTBEE_DEVICE_ID=<registered enabled device>
PHONE_OTP_PEPPER=<unchanged high-entropy server secret>
```

5. In the same Next.js service, set:

```text
PARISH_STATUS_NOTIFICATIONS=enabled
PARISH_STATUS_AUTO_SEND=disabled
PARISH_NOTIFICATION_EMAIL=enabled
PARISH_NOTIFICATION_SMS=enabled
```

Leave **AUTO_SEND disabled** for tomorrow: staff deliberately clicks `Send queued updates` from Requests, so SMS outages cannot delay their critical approval/payment workflows. Use opt-in and the verified fictitious test account. Change to `PARISH_STATUS_AUTO_SEND=enabled` only after a verified delivery test and cost/latency review. **These flags are server-only; no NEXT_PUBLIC secrets.**

6. Save environment and deploy **ifimarag**. Deploy **smart-parish-api** too because it now returns trusted request identification with its already-verified cash/PayMongo payment responses. Both should show the same merged staging commit.

## Defence test — fictional data only

1. Use **one existing approved parishioner account**. No new Google account required. Login through existing email/password as appropriate; if approval was rejected, use a legitimate existing approved test account or get staff to review evidence. Do not mark an unverified account approved merely for demo.
2. In Profile, verify the user's +639 mobile via OTP. Then explicitly choose `Text me request and payment updates` and save. Email updates are independent.
3. On the parishioner dashboard, open **My Requests** and demonstrate the existing real payment timeline even if txtBee isn't delivering.
4. Staff opens a matching fictional archive and approves a pending request. In the **Requests** screen, the office-specific SMS & Email notification queue should show a pending event.
5. Staff clicks **Send queued updates**. With the phone ONLINE, SMS permission, an active SIM and sufficient SMS balance/allowance, verify a text actually arrives at the opted-in number. **Gateway accepted ≠ handset delivered.** In-app inbox and staff queue record only provider acceptance, not final delivery.
6. Verify a cash payment receipt ONLY after the appropriate cash ledger migration and operator authorization, or use a genuine verified **PayMongo test** webhook. Demo payments are explicitly labeled TEST, not real money. A second replay must not send duplicate messages.
7. Attach final document; send the Ready notice; the site remains **non-official online preview** and release is staff-controlled. Mark Released only when backend rules permit.
8. Test account without SMS consent, unverified phone, and cross-office admin role. No SMS must be sent. SMS sender must never expose full certificate content or ID proof.

## Delivery failures

- Manual phone message previously showed **Not sent • TM**. That is a carrier/SIM issue, not evidence the Render code failed. On the Android txtBee app, select a SIM that can actually send standard SMS (SMART vs TM), allow unrestricted background activity, and send a txtBee dashboard test before OTP/status.
- The SMS outbox state `accepted` means txtBee queued the SMS; only handset receipt or provider signed delivery report proves delivery. A carrier can fail after API acceptance.
- Network timeouts are recorded as `uncertain` **not automatically retried**, preventing costly or duplicated texts.
- A user can opt out at any time. SMS is never sent unless a number is saved, verified by OTP, and opted in.
- No SMS campaign/broadcast is enabled by this patch. Announcements are still managed through the existing calendar/news UI.
- Each event has a unique key. Existing tracked requests/payment history is untouched. The event outbox is new: older events are not retroactively sent.

## Readiness and limits

- Ready to demonstrate: real archive/OCR/private Supabase storage, request/payment status display, saved event timeline, explicit manual SMS queue after migration and real successful test.
- Not yet proven: carrier delivered status SMS in live production, announcement video upload, verified relationship claims and complete in-person physical pickup audits.
- The app and phone must be online; a free txtBee plan has message quotas and mobile carrier restrictions.
- No Oracle account, new Google registration, or Twilio purchase is needed for this phase.
