# Smart Parish – Email, optional TextBee SMS OTP and staff MFA

**Candidate update**. It does not turn on live PayMongo or replace either SQLite database.

## What exists already

The original project already has email-verification and password-reset tokens, a Resend integration and a Google sign-in flow for parishioners. This update adds optional Gmail SMTP sending for development without an owned domain, TextBee SMS OTP after parishioner sign-in, and authenticator-app MFA for ADMIN and BURIAL_ADMIN. SMS verification proves temporary possession of the receiving phone, not legal SIM ownership or perpetual line activity.

### Safety before installation

1. Stop **Next.js** and **Flask**.
2. Run `python backup_smart_parish_databases.py`. Keep the resulting backup **outside the Git repository**. Also back up uploads.
3. Extract this ZIP **outside the project**, e.g. `Desktop/SmartParish_Auth_Integration_20261111`.
4. From `backup-church` run (PowerShell):

```powershell
$installer = Get-ChildItem "$HOME\Desktop\SmartParish_Auth_Integration_20261111" -Recurse -Filter install_auth_update.py -File | Select-Object -First 1
python "$($installer.FullName)" --project .
```

Only if **all** results are READY, NEW_FILE or ALREADY_DONE (no CONFLICT):

```powershell
python "$($installer.FullName)" --project . --apply
```

The installer only changes source and copies new utility files. It NEVER edits databases, `.env`, uploads, or credentials; backups of overwritten source go to a timestamped folder alongside the project.

### Database migration (required, backup-first)

`dev.db` is the existing **root** Prisma SQLite database. Older historical Prisma migrations are **still NOT baselined**. Do **not** run `prisma migrate dev`, `prisma migrate deploy`, `prisma migrate reset` or `prisma db push` on this populated database.

```powershell
python scripts/migrate_account_security.py
# Verify dry run is correct, stop Node/Next.js and ensure backup exists
python scripts/migrate_account_security.py --apply
python scripts/migrate_account_security.py
npx prisma generate
```

The additive migration creates `StaffMfa`, `StaffMfaChallenge`, `PhoneVerification`; existing accounts/password hashes are preserved. **Existing staff sessions are revoked** to require MFA on next login. It creates its own SQLite backup outside the project.

To compare the resulting schema without writing:

```powershell
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

Should show an empty diff. The historical migration baseline still requires a separate carefully reviewed resolution before production deployment.

### Configure staff MFA FIRST (required for every staff sign-in)

Use a privately generated, stable 32-byte key, e.g. in a PowerShell terminal:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Copy the output into **your private `.env` file**, never into Git or chat:

```dotenv
STAFF_MFA_ENCRYPTION_KEY=YOUR_PRIVATE_RANDOM_32_BYTE_BASE64_KEY
```

Restart Next.js. Password-login as either staff account. You will be routed to `/staff-mfa` without a normal staff session. On first sign-in, open Google/Microsoft Authenticator, add a time-based account using the displayed setup key, enter the six-digit code, and **save the eight one-time recovery codes somewhere private**. Do the same for the other staff account. On later logins, a new authenticator code is required. Staff Google Sign-in remains disabled.

**Do not lose** `STAFF_MFA_ENCRYPTION_KEY`: losing it means the stored authenticator secrets cannot be decrypted. If a staff member loses their authenticator and recovery codes, recovery requires a verified, manual admin reset procedure that is deliberately NOT exposed through the public website. Strong passwords and MFA do not replace access-control tests.

### Configure actual email verification

**Existing option: Resend** with `RESEND_API_KEY` and `EMAIL_FROM`. The `onboarding@resend.dev` test sender can send to the account's own approved test inbox, not arbitrary parishioners. A verified sending domain is required for general Resend delivery. See <https://resend.com/domains>.

**Optional low-volume Gmail SMTP TEST setup without a domain** (not recommended as a long-term production mail transport):

1. Prefer a **dedicated parish-owned Gmail account**, not your personal mailbox. Enable Google 2-Step Verification and generate an App Password if that option is available.
2. Install the maintained SMTP transport library in your project: `npm install nodemailer`.
3. Set the following in the local `.env` (do NOT share real values):

```dotenv
EMAIL_TRANSPORT=gmail-smtp
GMAIL_SMTP_USER=YOUR_DEDICATED_ACCOUNT@gmail.com
GMAIL_SMTP_APP_PASSWORD=YOUR_PRIVATE_16_CHARACTER_APP_PASSWORD
APP_BASE_URL=https://YOUR_CURRENT_NGROK_DOMAIN.ngrok-free.dev
```

If you choose Resend instead, omit `EMAIL_TRANSPORT=gmail-smtp` and use the verified Resend sender configuration. Restart Next.js after updating `.env`. Test actual registration and password reset using an inbox you control. **Never use the regular Gmail login password as `GMAIL_SMTP_APP_PASSWORD`**. Gmail sending quotas and delivery/abuse restrictions apply; verified-domain Resend is preferred for production. Account creation may succeed even if mail delivery later fails; users can request a resend from the login/registration UI.

### Configure optional TextBee SMS OTP

1. Set up <https://textbee.dev/docs/getting-started/setting-up-textbee>, verify the TextBee account, register your spare Android phone, and grant SMS permissions. The phone needs an active texting SIM, electricity and internet access. On some phones disable aggressive battery suspension for TextBee.
2. In the TextBee dashboard create a dedicated API key for Smart Parish, copy it privately. Optionally read the Device ID if you have more than one phone.
3. Use a **separate** securely generated random 32-byte secret for the phone OTP HMAC key.
4. Add to private `.env`:

```dotenv
TEXTBEE_OTP_ENABLED=true
TEXTBEE_API_KEY=YOUR_PRIVATE_TEXTBEE_API_KEY
# TEXTBEE_DEVICE_ID=YOUR_PAIRED_ANDROID_DEVICE_ID   # Optional if one default device
PHONE_OTP_PEPPER=YOUR_OTHER_PRIVATE_RANDOM_SECRET_32_PLUS_CHARACTERS
```

Restart Next.js. A verified-email USER signs in, saves an optional PH mobile number, opens **My Profile**, clicks **Send SMS code**, then enters the received code. SMS OTP expires in five minutes; send attempts and wrong guesses are limited. **The number remains unverified unless the correct code is received and submitted.** TextBee accepting the message only means it was queued; actual SMS carrier delivery may fail. TextBee's free-tier quota does not cover your SIM's costs or carrier restrictions.

### Tests (run after installation, migration, environment setup)

```powershell
python -m unittest discover -s tests -p "test_account_security_integration.py" -v
node tests/test_totp_reference.cjs
npx tsc --noEmit
npm run build
```

Then complete manual tests:

- Password registration sends a real email; verification link works once; sign-in is rejected before verification.
- Main Admin password requires authenticator setup and one-time recovery-code save; without a second factor, `/admin` stays inaccessible.
- Burial Admin separately enrolls; old session cannot access `/burial-admin` after migration.
- Wrong and replayed TOTP codes are rejected; recovery codes are single-use.
- User sends SMS only from a verified-email logged-in session. Wrong/expired OTP stays unverified; changing phone invalidates the *status* while preserving SMS quota tracking.
- Logout then Browser Back cannot access private records; verify on ngrok phone and localhost.
- In Resend or Gmail SMTP test mode, register with a real inbox; verify sender and inbox delivery. Provider credentials are never exposed in client code.
- Keep PayMongo in **test mode** until all payment, webhook and hosting tests pass. This patch does not make real-money payment safe.

### Limitations

- The source was reconstructed from your most recent uploaded project ZIP plus the subsequent official-fees and PH registration patches, not re-read from your local Windows project. The installer **fails closed** on mismatched files. If it reports CONFLICT, don't force or manually overwrite: supply the affected latest files to merge safely.
- Python and syntax-level tests do not replace `npm run build` on your PC, real SMTP delivery, TextBee send/receive, or manual MFA sign-in tests.
- Staff MFA recovery currently requires stored recovery codes or a securely verified manual reset; no self-service MFA reset endpoint is included, to avoid an account-takeover bypass.
- Production still needs Prisma migration-history baselining, permanent hosting/HTTPS, authorization tests and backups.
