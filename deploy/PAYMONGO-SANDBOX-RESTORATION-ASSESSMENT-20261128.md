# PayMongo sandbox restoration — pre-deployment assessment

## Scope and decision
**Draft only. Do not merge or deploy until review and tests pass.**
Restore the existing provider-hosted sandbox checkout button without reintroducing a green real-money `Pay Online` call to action in test mode. We are not migrating to PayMongo v2, changing cash receipts, creating mock ledger rows, changing official certificate releases, modifying role access, or changing real payment provider credentials.

Repository base at branch creation: `bb290a84e454f685b584a931d7d4bc966957e44f` (staging).

## Root cause
PR #57 hid the checkout button whenever `paymentMode !== 'live'`. It did **not** remove the Flask PayMongo test checkout code or reconciliation code. Test payments can still be verified against PayMongo under `PAYMONGO_TEST` and must remain clearly separated from `CASH` and `PAYMONGO_LIVE`.

## Risk / controls

| Risk | Preventive measure | Expected result |
| --- | --- | --- |
| Sandbox CTA mistaken for actual collection | Amber **Simulate Test Payment — No real money**, confirmation before redirect, warnings in tracking | No genuine funds represented as received |
| Existing checkout is still active | Hide new checkout action for `cs_...` reference or `PAYMONGO_*_PENDING`; backend independently checks the prior session | No accidental second checkout or ledger write |
| Previously reconciled test-paid request | Do not enable a new test checkout on `PAYMONGO_TEST_RECONCILED`; use a new approved test request | Historical audit remains unchanged |
| A sandbox page goes stale when deployment changes to live | Frontend sends `expectedMode`; Flask rejects a changed or missing expected mode | No real checkout launched from a test button |
| Backend test key/configuration missing | Read-only `onlineCheckoutConfigured`; hide checkout actions unless valid-looking matching key, HTTPS URL, QR Ph method | Fail closed; explain setup rather than showing broken controls |
| Test payment marked eligible for release | Existing server and UI allowlist `Paid + CASH` or `Paid + PAYMONGO_LIVE`; sandbox explicitly rejected | Official release and download remain blocked |
| New test QR Ph exposes a real payable QR code | **Do not scan or pay a QR Ph test QR code.** Follow PayMongo's supplied test/simulation URL and provider instructions only | No unintended real transfer |
| Provider's external Authorize button does nothing | Inspect test checkout session and PayMongo's simulator/test logs; do **not** fake a paid event in the DB | Report external/provider issue honestly |
| Old cached frontend calls checkout without mode | Server returns 409 with refresh guidance | Safe failure rather than an unintended mode |

## New behavior

- **Configured test mode** (a real `sk_test_...` key, HTTPS `APP_BASE_URL`, `PAYMONGO_METHODS=qrph`): after Staff approval and with an appropriate fee, Parishioner sees **Simulate Test Payment** and a no-money confirmation. The browser opens PayMongo's hosted test checkout, never an inline or fake simulator.
- **Configured live mode**: existing **Pay Online** button remains, only when eligible and with no unresolved checkout.
- **Missing/invalid provider config**: neither payment action is visible.
- **Unresolved or reconciled prior test payment**: no new test checkout button for the old request. Do not edit old PayMongo rows or fabricate a replacement receipt.

The read-only readiness field confirms **local configuration only**. A green automated build and a matching key prefix cannot prove that PayMongo's external test simulator actually authorizes a payment.

## Manual acceptance procedure (never on a real person's certificate)

1. Do not touch actual church payment records. Select a disposable fictional Parishioner test account and approved dummy certificate request with a correct stored test fee. Take baseline screenshots and record its request ID (not personal data).
2. Review **smart-parish-api** private Render environment without copying keys to chats or issues: `PAYMONGO_MODE=test`, `PAYMONGO_SECRET_KEY=sk_test_...`, `PAYMONGO_METHODS=qrph`, `APP_BASE_URL=https://ifimarag.onrender.com`. Verify credentials in Render, not GitHub.
3. Load the approved fictional request. Confirm test checkout is amber and says **NO real money**; verify Pay Online is absent. Confirm there is no prior `cs_...` or `PAYMONGO_TEST_PENDING` on the request.
4. Click simulation button and explicitly confirm. Check the network POST includes `{"expectedMode":"test"}` and returns a PayMongo checkout URL.
5. On PayMongo's test flow, use **only the documented test simulator mechanism**. **Do not scan a QR code and pay it with a real bank/e-wallet.** Confirm whether PayMongo really records the test payment; if Authorize fails, capture PayMongo test-session status and Render logs, then stop, no blind retries.
6. After returning to the site or receiving a genuine provider test event, verify the backend reconciles the payment as `Paid / PAYMONGO_TEST`, preserves its sandbox ledger evidence, and tracking says **Test payment — No real funds**. Check the demo cannot click official Release or obtain an official download.
7. Verify requests with an unresolved or previously reconciled checkout have **no new simulation button**. Verify a request already Paid (cash or live) cannot start checkout.
8. Mock test the stale-page case: test-button intent + backend live mode = HTTP 409 before calling PayMongo.
9. After sandbox demo, verify no unrelated cash ledger, SMS, authentication, archiving, or role-permission behavior changed.

## Release criteria and rollback

Do **not** merge until GitHub's full Phase 8 CI passes on the PR HEAD and a reviewer checks the small diff. Do not deploy without a separate manual sandbox test plan and owner consent. If a future deployment breaks the payment page, revert the single PR or roll back both Render services to the prior matching commit. Never roll back Supabase or erase confirmed payment/audit rows to revert UI code. No new migration or secret is required by this change.

**Known limitation:** PayMongo's Hosted Checkout can change provider-side test UX. The original use of `/v1/checkout_sessions` remains supported for backward compatibility, but the provider currently recommends `/v2` for new work. Changing API generations is a separate, higher-risk upgrade and is deliberately outside this restoration.
