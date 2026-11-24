# Live incident hotfix: logout, public notices, profile and browser history

## Incident shown Nov 24, 2026
- Super Admin/Parishioner clicks Sign out, receives "Unable to sign out" while still in private workspace.
- Public homepage and parishioner Mass notices show "announcements could not be loaded".
- Public header's Dashboard shortcut disappears on first load.
- Parishioner Profile forms/cards occupy a narrow left column with a large empty area.
- Back/Forward can revisit a restored UI while a failed logout has left the database session active.

## Fixed in this hotfix
1. Sign-out buttons in all three active workspaces are native **POST forms** to
   `/api/auth/logout`. The route revokes the database session, clears cookies
   and issues a **303 browser navigation** to `/login` (then homepage).
   No JavaScript fetch/redirect race or client-only security flags.
2. The CSRF origin boundary keeps the exact, known Render origin
   `https://ifimarag.onrender.com` trusted even if `APP_BASE_URL` was left
   pointed to a temporary ngrok/staging hostname. Custom domains still require
   an explicitly configured `APP_BASE_URL`. Cross-site origins are rejected.
3. Public announcements no longer depend on optional **unmigrated** slide/media
   tables: active legacy text notices and the calendar still load when those
   tables have not yet been applied. If slide metadata exists, publication
   start/end filtering remains mandatory; media links are still private and
   checked by the file endpoint.
4. Parishioner Mass schedules render independent of network availability of the
   announcement feed, rather than being removed along with the error message.
5. Dashboard shortcut is always present; anonymous click goes to login, while
   authenticated viewers receive their server-validated role destination.
6. Parishioner Profile widgets use a centered, wider responsive column and
   clearer text sizing. No account fields changed.
7. Existing no-store headers, DB-backed Proxy role enforcement and BFCache
   history revalidation from PR #30 are preserved.

## Deployment order
1. Check PR CI green. Merge this hotfix into `staging`.
2. On Render `ifimarag`, verify `APP_BASE_URL=https://ifimarag.onrender.com`
   if using the normal Render domain; no need to change Supabase secrets.
3. Before attempting image or MP4 announcements, finish the **previously
   required** schema migrations. Check read-only in Supabase SQL Editor:
```sql
SELECT
  to_regclass('parish_private.announcement') AS announcements,
  to_regclass('parish_private.announcement_slide') AS slides,
  to_regclass('parish_private.announcement_media') AS media;
```
   If `slides` is NULL, review/apply
   `deploy/migrations/20261120_announcement_slides.sql`.
   If `media` is NULL, review/apply
   `deploy/migrations/20261123_notice_media_and_consent.sql` **only after**
   `deploy/migrations/20261122_status_notifications.sql` is verified, and
   only after backing up PostgreSQL. Do not reset any tables.
4. On Render `ifimarag → Deploys`, deploy the latest `staging` commit.
   This is a Next.js-only change. Keep the currently working Flask API.
5. Test in a clean Incognito window:
   - Open homepage: Dashboard link visible, anonymous click returns login.
   - Log in Admin + Staff MFA; click Sign out, verify browser navigates away.
   - After sign-out, GET `/api/auth/me` is HTTP 401, direct `/admin` redirects
     to login, and Back/Forward never restores useful API access.
   - Log in Parishioner, open Mass schedules & notices: calendar displays even
     if the announcement endpoint is offline.
   - On homepage, network `/api/public-notices` should be 200 with list or
     empty list; if 503 remains, inspect Render runtime Logs for the failing
     PostgreSQL query/table and recheck the above migrations.
   - Visit My Account on mobile + desktop: widgets centered.
   - Confirm Staff, Parishioner cannot fetch Admin APIs.
   - Check existing certificate requests and PayMongo mock flows were unaffected.

## If logout still fails
Open Chrome DevTools → Network → Preserve log, click Sign out once and note
`/api/auth/logout` status, without sharing cookie values:
- **403** = Origin/CSRF policy rejected the request; verify request URL and
  canonical hostname plus `APP_BASE_URL`.
- **503** = DB session revocation failed; inspect Render service logs and
  Supabase connectivity. Do not pretend the session was revoked.
- **303** = logout accepted; if Back looks old, open `/api/auth/me` to confirm 401
  and test history revalidation.
- **429** = hosting/security rate limit; identify edge response and retry later.
Never paste passwords, API secrets, or full Cookie/Authorization headers.

No destructive migration, database reset, or account deletion is part of this PR.
