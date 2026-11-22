# Defense-ready request and payment tracking

## Included

The parishioner dashboard now has **Track my document request**; the full **My Requests** screen opens in tracking mode and has a manual Refresh button. The staff **Requests** panel displays the same request timeline and payment details on expanded requests, with a Refresh button. Main staff queue now includes historical urgent requests so none are accidentally hidden by the simplified Phase 9 navigation.

Both read the existing authenticated Flask `GET /api/requests` endpoint. It scopes parishioner data to the current user and staff data by office. **No new public lookup endpoint** or unprotected tracking link is added. Request IDs alone never grant access.

The tracking displays:
- Reference `IFI-REQ-0001` and current persisted workflow status;
- Submitted, Staff verified, Document prepared, Office release, derived from persisted status and prepared file presence;
- Independent payment status, PHP amount, method, checkout/payment reference, paid timestamp (Philippine local time);
- Explicit PayMongo test-mode warning; pending checkout is **not** a confirmed payment;
- Staff remarks, record updated time, and next-step instructions;
- Cancelled/rejected states do not pretend that a completed historical stage occurred;
- An online Released state is **not proof of physical pickup**. The parish still needs a separate in-person collection record.

No SMS is sent. This is live **database-backed self-service status tracking** and works without Twilio/Semaphore and without Oracle Cloud.

## Acceptance checks on staging with fictional test records

1. Sign in as an **approved fictional parishioner**. The dashboard should show a recent request, its reference and payment status. Click All requests.
2. From Main Admin, open the same request in Requests and confirm the identical ID/status and remarks.
3. Verify a matching archive record and approve the request. Refresh parishioner tracking and verify Staff verification appears recorded.
4. Start PayMongo **test checkout**. The tracking must say awaiting verification until a **verified test webhook** changes the DB payment status; then show TEST payment and `paidAt`.
5. Prepare the release document; refresh to see Document prepared, then release if server checks pass. Do **not** claim a test-mode payment authorizes production release.
6. Confirm request #X is inaccessible as an unrelated parishioner or Burial Admin outside their scope.
7. If `/api/requests` fails (Render sleeping), the UI must show an error and offer Retry/Refresh rather than displaying invented information.

This patch does not alter payment ledgers, webhooks, certificate files or database schema.

## CLI smoke checks before deploying

```powershell
git fetch origin
git worktree add --detach ..\parish-tracking origin/fix/live-request-payment-tracking-20261122
cd ..\parish-tracking
npm ci
npx prisma generate
npx tsc --noEmit
npm run build
```

Do not merge or deploy if GitHub Actions fails. The Phase 9A PR is independent and remains draft.
