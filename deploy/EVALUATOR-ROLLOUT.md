# Smart Parish evaluator branch

## Preview on Windows

From the existing project in PowerShell, fetch the branch and create a separate checkout. Use synthetic records on a disposable PostgreSQL clone with the existing parish_auth and parish_private schemas. Use a private test environment file for that clone.

~~~powershell
git fetch origin integration/evaluator-workflows
git worktree add --detach ..\parish-evaluator-test origin/integration/evaluator-workflows
cd ..\parish-evaluator-test
npm ci
npx prisma generate
npx tsc --noEmit
npm run build
python -m pip install -r church_backend/requirements.txt
python -m unittest discover -s tests
~~~

Use PostgreSQL 14 or later. In PowerShell set PGHOST, PGDATABASE, PGUSER, PGSSLMODE and the credential mechanism for the **disposable clone**. Confirm the destination first. Run the additive SQL on that clone only.

~~~powershell
psql -X -c "select current_database(), current_user"
Get-ChildItem deploy/migrations/*.sql | Sort-Object Name | ForEach-Object {
  psql -X -v ON_ERROR_STOP=1 -f $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($_.Name)" }
}
~~~

Start the existing web and Flask dev commands in separate terminals. The certificate report and staff request pagination are directly available. New schema-dependent workflows use the settings below. Provide public Next variables before the web build. Set server-side variables on the named services and restart the test instances.

| Service | Settings | Visible outcome |
|---|---|---|
| Next | PARISH_MEMBERSHIP_EVIDENCE=enabled | After email verification, sign in as a pending parishioner. Submit a sample ID and a record hint. Main Admin → Parish Membership Approvals shows the private ID. Approval requires a matching baptismal certificate number and staff confirmation. |
| Both | PARISH_SUPER_ADMIN_ID set to the numeric ID of the designated existing ADMIN | Supervisor-only policy and reporting actions. Existing roles, passwords and MFA are retained. |
| Both | PARISH_PORTAL_SETTINGS=enabled | Admin → Policies and request purposes. Publishing versions the privacy notice. New registrations record the accepted version. |
| Flask and Next respectively | PARISH_RELATIVE_CLAIMS=enabled and NEXT_PUBLIC_PARISH_RELATIVE_CLAIMS=enabled | Relationship claims → submit a sample proof → staff match the owner and certificate → use the approved claim number on the request. Disputed decisions require the designated supervisor. |
| Flask and Next respectively | PARISH_APPOINTMENTS=enabled and NEXT_PUBLIC_PARISH_APPOINTMENTS=enabled | Office appointments → staff add a future slot. Test two parishioners competing for the last place, then cancel and rebook. |
| Flask and Next respectively | PARISH_ANNOUNCEMENT_SLIDES=enabled and NEXT_PUBLIC_PARISH_ANNOUNCEMENT_SLIDES=enabled | Main Admin → Announcements → choose an image, priority and publication window. Check the parishioner feed inside and outside the window. |
| Both | PARISH_EXTENDED_REPORTS=enabled | Certificate reports → supervisor metrics, member activity reviews and report schedules. Staff reports are office-scoped. |
| Flask | PARISH_PRIVATE_UPLOADS=enabled plus PARISH_S3_ENDPOINT, PARISH_S3_REGION, PARISH_S3_BUCKET, PARISH_S3_ACCESS_KEY and PARISH_S3_SECRET_KEY | Private file writes to the configured Supabase project and its bucket. The private database connection must be able to check storage.buckets and access the application tables. Keep credentials on the server. Inventory and copy legacy uploads separately. |

## Local transcription and scheduled reports

A staff PC can transcribe a saved recording independently of Render. Use Python 3.11 and a separate virtual environment. The first run downloads the base model. Review transcription quality with a representative Tagalog/English recording.

~~~powershell
py -3.11 -m venv ..\parish-ai-env
..\parish-ai-env\Scripts\python -m pip install -r worker/requirements.txt
..\parish-ai-env\Scripts\python worker/transcribe.py test-mass.mp4 mass-draft.json --language auto
~~~

In Main Admin → Mass Recordings, open a test Mass with the eye button, import the JSON draft, review both fields, and save. The summary is the opening three sentences. The command does not enqueue a cloud job.

For reports, run the following on the authorized scheduler host with the Flask database environment and dependencies. Each invocation processes up to 20 due schedules. Point an existing scheduler at the command for recurring execution.

~~~powershell
python church_backend/run_scheduled_reports.py
~~~

## Rollout and rollback

Compare the merge base and latest staging changes before merging. Verify confidential files can be restored from a private copy before restarting the live backend. Prove access denials, backup restoration, quota behavior and scheduler execution against the actual provider in staging. The new tables enable RLS and revoke PUBLIC grants. The application continues to enforce session ownership and office scope server-side. Review existing grants, owner bypass and role policies separately with the actual database roles.

Once authorized, apply reviewed migrations first, release the tested code, then enable the matching flags. A merge to staging may deploy both Render services. Verify each live commit and smoke-test reports, approval and requests with designated test accounts. For a rollback, disable the flags, restore the previous app revision and retain the additive tables, stored evidence, and private objects. Record any submissions made during the rollout. Reconcile those before enabling features again.

## PostgreSQL and object recovery drill

Run this on a private operator workstation with PostgreSQL client tools matching the server version, Python 3.11+, and the backend requirements installed. Set libpq connection settings for the source, use TLS verification, and supply the private bucket credentials if the object index contains files. The destination contains confidential data. Use a restricted encrypted volume and keep it outside Git.

~~~powershell
python scripts/backup_private_postgres.py create D:\ParishBackups
python scripts/backup_private_postgres.py verify D:\ParishBackups\parish-REPLACE_WITH_TIMESTAMP
~~~

The archive uses one PostgreSQL snapshot for the database dump and the list of immutable objects. The same create command can run from Windows Task Scheduler on an authorized machine. Existing uploads that still exist only on the old web server need an independent copy before redeploying.

For a restore drill, configure libpq for a **new empty test database**. Restore the dump with the owning test role. For indexed files, restore each file from the snapshot's objects directory to a private test bucket at the key parish/<digest>, retaining its filename. Configure the restored application to use that test bucket, then test record ownership, a document download, the report export and a booking. Keep the private bucket and database binding together. Restore shared secrets, including the MFA encryption key, through the existing secure configuration process.

~~~powershell
pg_restore --single-transaction --exit-on-error --no-owner --no-privileges -d $env:PGDATABASE D:\ParishBackups\parish-REPLACE_WITH_TIMESTAMP\parish.dump
~~~
