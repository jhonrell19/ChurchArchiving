# Certificate request identity and form rollout

The **Requester Information** section contains only the authenticated account name,
email and phone number. In **Request / Record Information**, Baptismal,
Confirmation and Marriage forms request the **mother's full name (including
maiden name)** and **father's full name of the person named on the church record**.
These are NOT necessarily the logged-in requester's parents, particularly when
requesting a certificate for someone else.

Existing request rows with no parent names display "Not recorded". The two
nullable columns are not collected for Cemetery Ownership or Land Agreement
requests; the backend ignores forged client parent-name fields for those categories.

## Certificate-only fixes

- Requester accounts are read-only; parents appear with the requested church record.
- Existing Land Agreement copies/reviews/clarifications are **not blocked by
  available-lot API errors**. They accept an optional agreement/lot reference.
- Only the existing `Apply for Cemetery Lot Agreement` purpose requests a
  currently available cemetery lot. It is an inquiry, **not a booking or sale**.
  If the API is unavailable, do not invent available slots or silently reserve.
- Staff is the responsible role; no Burial Admin login or cemetery role is created.
- Ownership and Land Agreement lack approved automatic official templates.
  Staff must use an existing verified record and upload the authorized final document.
- Approximate record date accepts a year or date; missing/unpriced fees are
  labelled **Parish confirmation required**, not free ₱0 certificates.

## Safe release checklist

1. Confirm a backup of the Supabase database exists.
2. If PR #45's schema migration was not applied, **before deployment** run
   `deploy/migrations/20261127_request_identity.sql` in Supabase. It adds
   nullable `mother_full_name` and `father_full_name` to
   `parish_private.certificate_request` without overwriting old records.
   This hotfix does **not** introduce any additional database migration.
3. Merge the reviewed request-only PR into `staging` after CI passes. If
   auto-deploy is enabled, ensure the migration is in place **before merging**.
4. Deploy compatible `staging` revisions to `smart-parish-api` and `ifimarag`.
5. Using fictional records: submit a Baptismal request for a person other than
   the signed-in user; confirm the requester info remains the account and both
   parent names appear under Request Information. Verify Staff/Admin display
   and Staff parent-name search. Check Confirmation and Marriage too.
6. Submit an **existing Land Agreement copy** request without selecting a lot,
   and an Ownership copy request without parent names. Staff should see their
   reference fields and be able to find the archival record. New-lot inquiries
   must still require a real available lot (no automatic reservation).
7. Open a historical request lacking parent fields; it must display "Not recorded"
   for sacramental parents without blocking view. Test second parishioner access
   remains restricted. Confirm document uploads, exports and status changes.
8. After both updated services pass those checks, address cleanup may be considered
   as a **separate irreversible operation**:
   `deploy/migrations/20261127_retire_personal_addresses.sql` permanently
   drops personal address columns. Do not execute as part of this request fix.

## Deferred outside the request-form hotfix

- Do not redesign the whole cemetery module, change fee amounts or claim actual
  ownership, add a Burial Admin account, or rewrite the capstone document.
- Do not modify any payment production credentials, notifications, or Supabase
  storage without a separate reviewed plan.
- Future decision: whether the parish supports *new* land agreements online
  or only copies/verification. New inquiries are not proof of ownership.
