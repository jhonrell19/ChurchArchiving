# Smart Parish: verified email + approved parish fees — 2026-11-09

This is an incremental release on top of the **2026-11-08 production-hardening candidate and Windows fix**. It is not a complete production rollout. No database file, key, parishioner record, or upload is included.

## Changes

- Removes all exposed development verification and password-reset links from registration, login and recovery. Even in Next.js development mode, email tokens are not returned to the browser.
- Requires configured Resend delivery before new password-based registration. Failed delivery leaves an *unverified* account, with resend available rather than a verification bypass.
- Adds a 60-second **database-backed** cooldown on resending email-verification links and password-reset links. This is not a substitute for IP-level rate limiting in production.
- Maintains normal email verification: secure random token, hashed in Prisma SQLite, expires after 24 hours, used once; Google verifies a Google account email separately.
- Installs a single `config/parish_fees.json` for the parish's seven approved fees. The Flask backend and published services page read the same file.
- Sets certificate copy fees at PHP 200 for Baptismal and Confirmation. Unpriced Marriage/Ownership/Land Agreement certificate copies remain unavailable for online checkout. Baptism PHP 2,000, Burial PHP 2,000, Matrimony PHP 5,000 are **service** prices, not the fees to copy their sacramental records.
- Removes unapproved default urgent fee (PHP 100). New urgent requests are disabled until separately approved. Existing record amounts are NOT rewritten; mismatched old amounts must be reconciled by staff.
- The Burial Admin's *manual* ledger enforces Opening Permit PHP 1,000 and Perpetual Dues PHP 300 x integer years. This is NOT online PayMongo payment processing; a human still confirms receipts. Covered-year tracking and duplicate-period prevention require a follow-up ledger improvement.
- The logged-in user request page and public Services page display the approved rates. Do not describe a page displaying a rate as payment checkout.

## Install safely

1. Stop Next.js and Flask. Confirm **both SQLite database backups** and `uploads` backup exist. Run `python backup_smart_parish_databases.py` if in doubt.
2. Extract the ZIP to a **separate folder outside** your `backup-church` repository, e.g. Desktop/SmartParish_Fees_Verification_Update. Do not scatter the ZIP contents into project root.
3. From PowerShell in `backup-church`, run:

```powershell
$patch = Get-ChildItem "$HOME\Desktop\SmartParish_Fees_Verification_Update" -Recurse -File -Filter install_parish_update.py | Select-Object -First 1
python "$($patch.FullName)" --project .
```

4. If all lines show `MATCH_BASE`, `ALREADY_PATCHED`, or `NEW_FILE`, run:

```powershell
python "$($patch.FullName)" --project . --apply
```

If any `CONFLICT` or `MISSING_BASE` appears, **STOP**. Your local code differs from the snapshot used for this patch; merge with care. Do not force overwrite. It never modifies databases.

5. In private `.env` configure:

```dotenv
APP_BASE_URL=https://YOUR_CURRENT_NGROK_HOSTNAME.ngrok-free.dev
RESEND_API_KEY=re_YOUR_REAL_API_KEY
EMAIL_FROM="Smart Parish <verify@YOUR_VERIFIED_SENDING_DOMAIN>"
PAYMONGO_MODE=test
PAYMONGO_LIVE_ENABLED=NO
CERT_FEE_BAPTISMAL=200
CERT_FEE_CONFIRMATION=200
CERT_FEE_MARRIAGE=0
CERT_FEE_OWNERSHIP=0
CERT_FEE_LAND_AGREEMENT=0
CERT_FEE_URGENT=0
```

Resend requires verifying the sender's domain DNS first. A real API key alone does not prove email will be delivered. Do **not** share `.env` or credentials in chat/GitHub. In production set `APP_BASE_URL` to your permanent HTTPS domain, not ngrok.

6. Restart both services. Run the offline checks:

```powershell
python -m unittest discover -s tests -p "test_parish_fees_registration.py" -v
npx tsc --noEmit
npm run build
python scripts/deployment_preflight.py --mode defense
```

7. Register using an **unused real inbox** (not a fake address) through the ngrok link; verify that the Resend email arrives, click it, sign in, and test expired/used tokens. Verify the email is not bypassable even if the Next.js dev server is running.
8. With a STAFF TEST ACCOUNT, create a fictional cemetery reservation, record one Opening Permit PHP 1,000 and one 2-year Dues PHP 600 entry; confirm staff ledger amount cannot be modified using browser devtools (backend rejects wrong prices). Run existing PayMongo **sandbox** test only for eligible certificate requests.

## Still pending: Do not treat as production-ready

- Full browser role/access and certificate/request test cycle; Google OAuth and Resend delivery on final domain.
- Prisma v7 baseline: audit showed schema parity but historic migration folders are not yet reconciled. Follow the approved backup-first baseline procedure; **do not run migrate dev/reset/deploy with old migrations**.
- Administrator MFA, shared durable rate limiting, payments tied to actual Baptism/Matrimony/Burial service orders, automatic cemetery payment flows, annual dues covered-year tracking/duplicate prevention, real PayMongo settlement/refunds, payment webhook replay testing.
- Deployment to a permanent HTTPS domain, persistent private databases/uploads, automated tested restoration, production logs and monitoring, parish privacy policy and authorization sign-off.
- Burial Admin–User communications/inquiries workflow.

## Phone verification — important truth

`libphonenumber-js/max` verifies numbering-plan plausibility, **not** actual carrier reachability or who owns the number. Provider carrier status can cost money and may be unavailable. **There is no free, reliable, fully automatic way to prove that arbitrary mobile numbers are currently active and owned by a user without receiving a response from that number or a provider.** Keep phone optional and mark it unverified. If the parish can staff a manual procedure, an employee can ask a user to send a one-time code by calling or messaging the parish's existing number. That verifies control at that moment, not ongoing activeness, and may still cost the user.

## Notes on financial security

- No live PayMongo credentials or API calls are included in this patch.
- PayMongo checkout currently supports *approved certificate copies only* and requires previously verified request ownership, amount and webhook evidence. We did NOT wire Baptism, Burial, Matrimony or cemetery service fee collection to the existing certificate request checkout; doing so would charge people for the wrong workflow.
- A cemetery `CASH` / `GCASH` record created by staff is not evidence that PayMongo or a bank actually confirmed receipt.
