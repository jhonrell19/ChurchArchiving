# Nov 27 — Login isolation, Staff archival ownership, PayMongo diagnosis

## Scope
This PR fixes confirmed server-side session and archive-permission defects.
It does **not** alter PayMongo payment state, API versions, credentials,
cash receipts, prices, Supabase schema, backups, or user records.
Do not describe its PayMongo diagnostic logging as a payment fix.

## Code changes
- Multiple devices/sessions for one account can coexist; createSession adds a
  new token without deleting every session belonging to that user.
- Logout revokes only that presented token. Password reset/account disabling
  preserve their existing all-session invalidation rules.
- After a successful Staff/Admin password, the current browser's old
  authenticated session is revoked and cookie cleared **before** requiring
  authenticator verification. Password-only access remains prohibited.
- USER login replaces only the current browser's previous session and clears
  a stale MFA cookie.
- Admin retains parish-level archive counts, audit logs and Mass media, but
  cannot search/list/read raw archive documents, scans, filled templates,
  release documents, or deleted-document recovery routes.
- Staff retains existing archive CRUD and certificate processing.
- Flask independently enforces Admin document denials, redacts archive file
  paths from Admin request review, and restricts Admin file serving to Mass
  media and transcription assets.
- PayMongo webhooks log only the upstream verification HTTP status or
  connection failure, never provider secrets or customer details.

## Required tests before deployment
1. GitHub Actions: TypeScript/Next build; Python and JS regressions pass.
2. Confirm both Render services are configured to deploy compatible
   `staging` commits; deploy `smart-parish-api` first and verify Live,
   then `ifimarag`. Do not reset PostgreSQL.
3. In Chrome normal window login Admin; in a **separate Incognito session**
   login Staff (with correct MFA); in another Chrome Profile login USER.
   All three should remain in their correct roles.
   **Incognito tabs share one private cookie jar**: multiple different
   accounts cannot remain signed-in independently across Incognito tabs.
   Use distinct profiles or browsers for simultaneous accounts.
4. Log the *same* test account into two independent browser contexts.
   Both should work; logout in one context must not log out the other.
   Confirm password reset still revokes all old sessions.
5. In a single browser context, sign in as Admin then enter Staff credentials:
   after password step but before MFA, `/api/auth/me` must respond 401,
   and `/admin` must reject. After MFA, `/api/auth/me` must say STAFF.
   No ADMIN session or cached Admin API may remain usable.
6. Admin role: GET `/api/backend/api/archive/documents` and category
   queries → 403, scans and release paths → 403. GET
   `/api/backend/api/archive/stats` and audit logs → 200.
   Mass recordings/transcriptions, Reports, staff management, read-only
   certificate-request review must continue working.
7. Staff role: browse/upload/verify archival documents and process fictional
   requests, release approved documents only under existing payment rules.
   USER role: cannot browse archives. Verify role denied for direct URLs.

## PayMongo incident — MUST check actual evidence
The portal uses `/v1/checkout_sessions`, hosted
`https://checkout.paymongo.com/...`, and expects a PayMongo signed
`checkout_session.payment.paid` webhook at:
`https://ifimarag.onrender.com/api/paymongo/webhook`.
Flask then independently queries PayMongo for the exact session, payment,
amount, mode, and reference before changing any payment status.

1. On PayMongo **test** checkout, if **Authorize payment** does not respond,
   first check whether the browser click generates a PayMongo network request
   or a visible provider error. Screenshot the state *without* secrets.
2. PayMongo Dashboard → Developers → Webhooks (test mode): verify that
   the HTTPS URL above is enabled and subscribed to
   `checkout_session.payment.paid`. Look at **Event Deliveries** for the
   actual checkout session, not just a synthetic webhook test.
3. No event after clicking Authorize → the payment simulation itself
   probably did not finish. It is not proof that Flask failed.
   Event delivery with HTTP 401 → test webhook secret/signature/mode issue.
   Delivery HTTP 503 → inspect `ifimarag` and `smart-parish-api` logs;
   Flask may still be sleeping, unreachable, or have declined verification.
4. If PayMongo shows a successful test payment but Smart Parish is pending,
   inspect transaction IDs and verification logs **without copying keys,
   cookie headers, or personal financial details**. Never mark a real payment
   paid based only on redirect, screenshot, or staff manual database update.
5. PayMongo Checkout **v1** remains documented, though **v2** is recommended
   for new integrations. Do not change versions to guess at the cause of an
   unresponsive hosted-page button; capture a real failure first.

## Explicit exclusions
- Do not expand the Admin's direct archive permissions as a workaround.
- Do not create a Burial Admin role.
- Do not bypass Staff MFA, CSRF or server role authorization.
- Do not turn on `PAYMONGO_LIVE_ENABLED`, substitute a demo payment, or
  release certificates as paid from sandbox-only evidence.
- No schema migrations and no destructive data operations.
