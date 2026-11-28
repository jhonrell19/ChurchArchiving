# PayMongo checkout resume — targeted stabilization assessment

**Scope:** Existing certificate requests (e.g. IFI-REQ-0008) with `Ready/Unpaid` and a previously created `PAYMONGO_TEST_PENDING` + `cs_...` checkout. **No new certificate request needed.** Changes are isolated to the existing Parishioner checkout UI/Flask checkout endpoint, regression tests, and this document. This is not a payment gateway rewrite.

## What changed and why

The current Parishioner UI intentionally hides **Simulate Test Payment** when an older `cs_` checkout exists, to avoid creating a second session. But Flask already contains a provider-verified *resume existing active session* path. The missing UI action makes an otherwise resumable request appear impossible to pay in sandbox.

The fix displays **Resume Test Checkout — No real money** only when an approved/ready, unpaid request has a `cs_` session and a mode-matching `PAYMONGO_TEST_PENDING` marker, pricing and checkout configuration are available. A corresponding live-mode resume remains separately labeled. Clicking this calls the existing authenticated `paymongo-checkout` endpoint with `expectedMode`; PayMongo's current status is fetched on the server.

- `active`, matching reference and test/live mode, no paid/processing attempt, valid PayMongo URL: **return the old checkout URL**; do not create a second session or change the request/database.
- `expired` verified by PayMongo: return HTTP 409 + `expired: true`, **no DB write**. Only after a separate confirmation may Flask create a replacement in the same mode, keep the same certificate request and store the previous+new checkout IDs in the audit log (single DB transaction).
- Prior paid or processing payment, reference mismatch, unexpected mode, untrusted URL, unknown status or PayMongo error: **fail closed**, without creating a new checkout. Use normal provider reconciliation or contact Staff.
- `PAYMONGO_TEST_RECONCILED` remains prohibited from new sandbox checkout even on a direct API call.
- Official certificate release is unchanged: `Paid/CASH` or `Paid/PAYMONGO_LIVE` only. Test payments stay clearly labeled and cannot authorize official release.

## Provider-specific caution

PayMongo's Hosted Checkout documentation distinguishes expiration of a QR Ph code (which may expire while the session remains active) from the **session** being explicitly expired. The active checkout can be resumed without creating another Checkout Session. The customer may generate a new QR Ph code within that same active session. Never pay a generated QR code using a real wallet during a sandbox demonstration. Use the provider's documented test simulator.

## Pre-merge verification

- [ ] Next.js TypeScript compile and build passes.
- [ ] All Python checkout and webhook regressions pass.
- [ ] Node role/field/payment safeguards pass.
- [ ] Active same-session return makes **GET only** to PayMongo and no DB commit.
- [ ] Failed attempt on active session does not force a new checkout.
- [ ] Provider reported paid/pending/processing = blocked until independently verified.
- [ ] Expired provider session does not replace without explicit confirmation, preserving old reference in audit.
- [ ] Existing test-paid, real-paid and reconciled records never get new checkout.
- [ ] No auth, SMS, archival, cash-receipt, certificate release, or schema changes.

## Controlled manual test (after approval, on a disposable fictional request)

1. Verify `ifimarag` and `smart-parish-api` deploy the same reviewed commit. Verify Flask environment `PAYMONGO_MODE=test`, correct test secret, `APP_BASE_URL` and `PAYMONGO_METHODS=qrph`. Never post credentials or original church records.
2. In an approved/ready **test** request with `PAYMONGO_TEST_PENDING` and an existing `cs_` reference, confirm the button reads **Resume Test Checkout — No real money**.
3. Click once, confirm. Verify the POST sends `expectedMode=test` and `replaceExpired=false`, and the returned URL belongs to the original session. Do not start a second checkout when it is active.
4. If PayMongo reports `expired`, confirm no new ID is created until the extra replacement confirmation. If replaced, inspect audit history for old/new reference and ensure status is still Unpaid.
5. Do not simulate a paid result unless PayMongo actually verifies the sandbox transaction. The view must show **Test payment — no real funds** and block official release.
6. Repeat with test-only unpaid, already-paid and reconciled requests to confirm no duplicate checkout actions.
7. If the old session is `active` but PayMongo's test authorization control still does not work, stop and capture the provider error; the resume feature cannot repair a provider-side simulation issue.

**Do not merge or deploy solely because CI passes.** Check the diff and conduct a controlled provider test before declaring simulation restored. Existing live payments must never be changed or faked. There are **no database migrations** in this PR.
