# Smart Parish on Render

Use your official Windows folder C:\Users\biga\Desktop\jscode\backup-church and the ChurchArchiving GitHub repository. Your Supabase migration has already committed. These services use parish_auth and parish_private. The hosted and local apps will see the same records whenever both use this staging project. Use designated test accounts and authorized documents. Creating services, granting GitHub access, and entering credentials happen in your own accounts.

## 1. Apply the patch

Save SmartParish-Render-Staging.patch in Downloads. Use PowerShell in the official folder.

~~~powershell
Set-Location 'C:\Users\biga\Desktop\jscode\backup-church'
$patch = "$env:USERPROFILE\Downloads\SmartParish-Render-Staging.patch"
git apply --check --verbose "$patch"
if ($LASTEXITCODE -eq 0) { git apply --verbose "$patch" }
~~~

If a file fails the check, keep the whole patch unapplied and share the named failing file or hunk. This patch expects the Supabase cutover and the repaired PostgreSQL seed. Keep prod-ca-2021.crt, the public root certificate downloaded from Supabase, at the project root. Complete one local sign-in after starting Next.js with that certificate.

## 2. Publish the staging branch

Create staging from the current working branch so your already applied changes travel with it. If staging is already your current branch, skip the switch. If Git reports a different existing staging branch, inspect its history before switching. Keep the same project folder.

~~~powershell
git branch --show-current
git switch -c staging
git status --short
~~~

In VS Code Source Control, stage the application changes you intend to deploy, including the committed-database cutover source, corrected prisma/seed.ts, and any tested membership changes. Include the changed Docker, deploy and Next.js files plus render.yaml, RENDER-STAGING.md, scripts/check_render_index.py and the public prod-ca-2021.crt. Stage existing assets and new application files needed by the build. Leave .env, databases, uploads, archived source ZIPs, and downloaded patches outside Git. Check for private files already tracked by earlier commits too. With your intended files staged:

~~~powershell
python .\scripts\check_render_index.py
git diff --cached --stat
~~~

If the checker lists a missing runtime file, stage it and rerun. For a private file already tracked, keep its local copy and remove it from the Git index before sharing. Review repository history separately if a secret was ever committed. The checker inspects filenames in the index; it cannot detect secrets hardcoded inside ordinary source.

~~~powershell
git commit -m "Deploy Smart Parish staging with Supabase and persistent uploads"
git push -u origin staging
~~~

## 3. Create the two services

Open the Render dashboard, select **New → Blueprint**, connect GitHub, select **ChurchArchiving**, and choose branch **staging** and the root **render.yaml** file. Review the service names, region and estimated charges before applying.

| Service | Configuration | Why |
|---|---|---|
| smart-parish-web | Free Node web service, Singapore | Public website, registration, staff sessions and protected API proxy. Free instances can sleep. |
| smart-parish-api | Paid Standard Docker private service, Singapore, one 5 GB persistent disk | Holds uploads and the Whisper cache, runs PostgreSQL-backed Flask, FFmpeg, OCR, and CPU transcription. Only services on the private network can reach it. |
| Supabase | Existing project and Session pooler | Reuses accounts, MFA, archive and payment rows. Render does not create a new database. |

This profile incurs backend and disk charges. Confirm the current estimate in your dashboard. Disk space and CPU/RAM needs depend on actual Mass videos. A long recording is a separate capacity test. The disk is used until Oracle Object Storage is integrated. The production parish project should have separate release approval and reviewed data access.

## 4. Fill in the Blueprint inputs

Use the private values you already use locally. Paste values without surrounding .env quotes. Generate no new staff key. Render generates the shared internal API key and the Flask secret, links the web service to Flask's private address, and shares the DB URL with the web service.

| Render service and key | Value to enter |
|---|---|
| API · ARCHIVE_POSTGRES_URL | Exact working postgresql+psycopg:// Session pooler URL from backup-church/.env. |
| API · APP_BASE_URL | Public web origin, e.g. https://smart-parish-web.onrender.com. After creation compare it with the actual web URL, including any unique suffix. Correct the API setting and redeploy if they differ. This controls payment return links. |
| API · PAYMONGO_SECRET_KEY | PayMongo test secret for the account used by staging. QR Ph is selected. |
| Web · STAFF_MFA_ENCRYPTION_KEY | Exact same value used for the migrated staff MFA enrollments. |
| Web · GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_CLIENT_ID | Put the same Google web OAuth client ID in both. The public variable is needed at build time. |
| Web · RESEND_API_KEY and EMAIL_FROM | Resend API key and a sender verified with Resend. This free frontend uses HTTPS email. Free Render services block Gmail SMTP ports. An existing Gmail-only deployment needs a verified Resend sender or a paid web instance with its Gmail SMTP settings. |
| Web · PAYMONGO_WEBHOOK_SECRET | Signing secret for the test webhook endpoint described below. If the endpoint requires the assigned web hostname, complete the endpoint and update this setting after the first deploy. |

When a feature credential is pending, leave it unset where the dashboard permits and mark the feature untested. Avoid putting placeholder credentials into a real payment or email flow. For an enabled phone integration copy its existing Next.js environment settings as well. TextBee uses TEXTBEE_OTP_ENABLED, TEXTBEE_DEVICE_ID, TEXTBEE_API_KEY and PHONE_OTP_PEPPER. Twilio lookup uses PHONE_LOOKUP_MODE, TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN. Only enable providers your project actually uses.

The Node startup script loads your public certificate and derives APP_BASE_URL from Render's public URL. Flask validates the pooler using the same CA. For a later custom domain set the same HTTPS APP_BASE_URL on both services, update providers, and redeploy.

## 5. Connect external providers

- In Google Cloud Console, open the web OAuth client used above. Add the exact Render web origin under Authorized JavaScript origins. The current Google Identity Services integration posts an ID token to /api/auth/google. Keep localhost as a separate development origin.
- In PayMongo test mode, register the web service URL ending in /api/paymongo/webhook for checkout_session.payment.paid. Save its endpoint signing secret on the web service. Confirm the API has the matching account's test secret. Check checkout returns to the Render frontend and only one ledger entry appears for one verified test payment. Existing production-mode release controls may restrict test-paid releases.
- Open a verification email and a password reset email from staging. Both links should open the public HTTPS site. For phone OTP, test with your own authorized number if the provider is enabled.

## 6. Bring across the existing uploads

PostgreSQL contains references to the files. Keep the real PDFs, videos and scanned records out of Git. The backend stores uploads under /var/data/uploads and downloads the Whisper model into /var/data/model-cache. Check the size of your source uploads first and make sure the disk has room for the files and the model.

For the first transfer only, before staff start uploading on Render, copy the **contents** of the official church_backend/uploads tree with the same subdirectories. Limit the transfer to records authorized for this environment. If local SMART_PARISH_UPLOAD_ROOT points elsewhere, use that folder instead. Render supports SCP to a disk-backed service after SSH setup. Add your SSH public key to your Render account and open **smart-parish-api → Connect → SSH**. Copy the destination beginning with the service ID, excluding the word ssh. In the official PowerShell terminal:

~~~powershell
$sshTarget = Read-Host 'Paste the API service SSH destination'
scp -r ".\church_backend\uploads\." "${sshTarget}:/var/data/uploads/"
~~~

Use this first-copy command on an empty upload tree. An already populated staging disk requires checking for same-name conflicts first. Open a known older document from the website and play a previously uploaded Mass. Then upload a small test PDF, redeploy the API, and verify it can still be downloaded. A database backup and a file backup cover different data.

## 7. Check the deployed version

| Check | Expected result |
|---|---|
| Build and health | Web logs show Prisma generation and a successful Next build. API logs show PostgreSQL archive verified. The public /api/ready URL returns ready only when Next.js reads parish_auth and the private Flask health check reaches the archive database. |
| Registration and requests | Register a fresh test email, verify it, approve with a reason, sign in and submit one request. Confirm the matching account ID and request in Supabase, as in SUPABASE-CUTOVER.md. |
| Staff and departments | Both existing staff accounts can complete their own MFA challenge. Each opens its authorized area and cannot read the other department's restricted records. |
| Archive and certificates | Upload a fictional scan, check OCR fields and template preview, generate or upload the appropriate certificate, release and download. Ownership/land agreement may require a staff-uploaded final file in the existing app. |
| Masses | Upload a short recording, play and seek, run transcription, open its transcript and summary. Try a representative longer file independently. First transcription downloads the model and takes longer. |
| Payments and other modules | Test QR Ph, webhook reconciliation, reservations, announcements, pricing, reports already present, and responsive navigation with test data. |
| Persistence | Confirm the same file and database record survive a redeploy. Imported database rows alone do not prove the file is present. |

If /api/ready returns 503, check the API logs first, then the web logs. Check both services are in Singapore and the backend disk is mounted at /var/data. For TLS errors, verify the public CA is tracked. For staff MFA errors, verify that the exact original encryption key was supplied. A browser-origin error usually means a public URL mismatch. Do not rerun the SQLite import to fix a web configuration error.

## 8. Push subsequent fixes

Work on staging, select the intended changes in VS Code, review them, commit and push. Each push to staging rebuilds the linked services. Render Events should show the same commit as git rev-parse --short HEAD. A persistent-disk backend restarts during a deploy; finish active uploads and transcription jobs before pushing. Schema changes need an explicit reviewed migration. Neither the build nor startup scripts migrate, reset, seed or bootstrap accounts.

~~~powershell
git status --short
git diff --cached --stat
git commit -m "Describe the staging fix"
git push origin staging
~~~

## Validation before handoff

The Blueprint passed the published Render schema check. A clean Node install, Prisma generation and production Next.js build passed. Using synthetic data, verified TLS and an isolated PostgreSQL server, the health check reached both database schemas, login succeeded, and a certificate request was saved under the signed-in account. With Flask stopped, the health route returned HTTP 503. The OCR parser tests passed. The Flask archive endpoint accepted a fictional scan, recognized text, generated a filled baptismal PDF, and served the original scan byte-for-byte after an API process restart with the same storage directory. These checks ran locally. Building the Docker image on Render, the mounted disk after a hosted redeploy, external provider credentials, and the first hosted transcription still require the hosted checks above.

References: https://render.com/docs/blueprint-spec · https://render.com/docs/deploys · https://render.com/docs/disks · https://render.com/docs/ssh · https://render.com/docs/free
