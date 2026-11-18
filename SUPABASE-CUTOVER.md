# Smart Parish PostgreSQL cutover

Use the official backup-church folder. Both services will use the Supabase Session pooler. Accounts, sessions and MFA stay in parish_auth; archive data and payments stay in parish_private. The app retains existing account IDs and authentication. parish_v2 is a separate design and is outside this cutover. Uploaded media and certificates remain in their current storage locations.

## Prepare during a maintenance window

1. Stop Next.js, Flask and any other writers to the official SQLite files and both destination schemas. Keep an offline backup of dev.db, church_backend/instance/archive.db, related uploads and your existing Supabase data. Keep the current branch and uncommitted work.
2. Confirm these two paths are the files the official apps previously used. If the old DATABASE_URL or ARCHIVE_DATABASE_URL selected different SQLite files, supply their actual absolute paths with --auth and --archive on both migration commands below. Use the same paths each time.
3. In the official project's local .env, set ARCHIVE_POSTGRES_URL to the existing private postgresql+psycopg:// Session pooler URL with a percent-encoded password. Keep this value server-side. Both processes must use the same destination in their launch environments. Preserve the current staff encryption keys and other settings. The patched runtime ignores the former SQLite URL variables.
4. From the official project root in PowerShell, with the normal project Python environment active, run each command separately. Continue after each success.

~~~powershell
npm install --no-audit --no-fund
python -m pip install "psycopg[binary]>=3.2,<4"
npx --no-install prisma generate
npm run build
python .\scripts\cutover_postgres.py
~~~

The final command checks all 18 tables and rehearses synchronization in a transaction that rolls back. It requires access to the already imported schemas. It adds absent membership columns from the official User schema, fills newly added columns from the official records, and copies missing rows. A conflicting existing value, a destination-only record, or a different schema stops the operation. Review discrepancies before switching. A failed TLS verification requires the correct trusted CA for your pooler; keep certificate verification enabled.

## Commit once and run

After REHEARSAL PASSED, with writers still stopped, execute the same migration with --apply. It commits both schemas atomically. Keep the PostgreSQL services offline until it prints COMMITTED. Keep the original SQLite files as backups.

~~~powershell
python .\scripts\cutover_postgres.py --apply
~~~

Open your usual two terminals in the official project. In the first run npm run dev. In the second activate the project Python environment and run python .\church_backend\server.py. Flask should print “PostgreSQL archive verified: parish_private”. With the patched code, either service will fail on a missing PostgreSQL configuration instead of opening a SQLite file.

## Verify the live application

Register a fresh test email, verify it, approve it from the church office account, sign in as that parishioner, and submit a test certificate request. In the Supabase SQL Editor, substitute the fresh test email below. Confirm the approved status, matching request owner, and new request ID and timestamp.

~~~sql
SELECT u.id AS user_id, u."membershipStatus", r.id AS request_id, r.created_at
FROM parish_auth."User" u
JOIN parish_private.certificate_request r ON r.requester_user_id = u.id
WHERE u.email = 'replace-with-the-new-test-email'
ORDER BY r.id DESC LIMIT 1;
~~~

After live PostgreSQL writes begin, retire the SQLite migration and backup jobs and use PostgreSQL-aware backups. Never run the cutover importer from an old SQLite snapshot against an active system. If a runtime issue occurs after new writes, pause writes and retain PostgreSQL as the current data source while diagnosing. Reopening old SQLite for writes would split the two histories.
