# Smart Parish — server session & browser history hardening (PR #30)

## Architecture confirmed
- Next.js 16.2.6 on Render `ifimarag`, Flask on `smart-parish-api`.
- `parish_auth."User"` and `parish_auth."Session"` in existing Supabase PostgreSQL. 
- `Session.tokenHash` stores SHA-256 of a cryptographically random 32-byte session token; user role, account-enabled, email-verified, member status and expiry are read from the database.
- No JWT, localStorage authorization, cookie-only role claim, new database, Redis, auth provider or migration required.
- Flask APIs remain reachable through authenticated `/api/backend/...` and their own per-operation authorization/ownership checks; keep `FLASK_INTERNAL_KEY` configuration unchanged.

## Changes
- Node.js 16 Proxy checks **active DB session + permitted role on every private HTML, RSC and API request**, not just cookie presence. On database errors, return 503 (fail closed).
- Super Admin `/admin/:path*` and `/api/admin/:path*` require ADMIN. Exception: `/api/admin/notifications/dispatch` is limited to document STAFF/BURIAL_ADMIN; announcement studio remains ADMIN.
- `/dashboard` and `/complete-profile` require USER; `/staff` requires STAFF/BURIAL_ADMIN; report pages and other private routes require their allowed roles.
- Role-specific server layout/API checks remain a second authorization boundary. Flask still checks document ownership and resource access.
- Issue HTTP-only Secure (in HTTPS production) SameSite=Strict cookies; require email verification and accountEnabled on every session request.
- Logout POST revokes database session and MFA challenge, clears session/pending/legacy cookies, replies HTTP 303 to `/login`, and sends cache clearing hints.
- Private responses get `Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0`, and `X-Content-Type-Options: nosniff`.
- Client history only requests fresh server checks on BFCache restore/back navigation; its result never grants authorization.
- PayMongo webhook's HMAC and GitHub notice-cleanup's signed Bearer endpoint remain separate, never treated as user login.

## Deployment
1. Keep existing `ARCHIVE_POSTGRES_URL`, `FLASK_INTERNAL_KEY`, `FLASK_API_URL`, `APP_BASE_URL` and `PARISH_SUPER_ADMIN_ID` environment values unchanged.
2. No Supabase SQL changes needed. Confirm the `parish_auth."Session"` table exists and you can already login as Staff/Parishioner.
3. Review new security test and existing CI results. Merge PR #30 into staging **only when latest head build and role tests are all green**.
4. Deploy `ifimarag` latest staging revision in Render. No Flask deployment or DB migration is required by this patch.
5. Use incognito and a regular browser test session. Test both with and without authentication. Do not share cookie/session tokens or MFA codes.

## Acceptance checklist
- With no cookie, direct visit to `/admin`, `/staff`, `/dashboard` redirects to `/login` (which may present the login widget on the homepage).
- With parishioner session, `/admin` and `/api/admin/staff` are forbidden HTTP 403; `/dashboard` works.
- With Staff session + authenticator, `/staff` works and `/admin`, Mass edits and Admin settings return HTTP 403.
- With Super Admin session + authenticator, `/admin` and intended Admin APIs work, but Staff document write permissions remain denied.
- Confirm same verified request/status/payment and announcement flows still work. Run one authorized Google login and a new staff MFA flow.
- Sign out using the UI, then inspect DevTools Network. `POST /api/auth/logout` revokes the session and redirects 303, and `Set-Cookie` expires `parish_session`; GET `/api/auth/me` becomes 401.
- Try Back then Forward and another tab that had a private screen open. Private HTML and APIs must not be accessible; BFCache restoration triggers a fresh server check.
- Confirm the private HTML response includes `Cache-Control`, `Pragma` and `Expires`. An expired/revoked session receives 401 on private API calls.
- Verify PayMongo signed webhook and `/api/admin/notices/cleanup` scheduled Bearer action still pass their independent secret verification. Random/invalid secrets must fail.
- If Supabase is offline, protected requests must fail closed with 503; do not accept any cached admin data as live authorization.
- Monitor Render web logs, Supabase DB connections and latency. Database-backed per-request proxy checks are safer but more expensive than cookie-only optimistic gating on the Free plans.

## Rollback
- Use Render `ifimarag → Deploys → Rollback` to revert only the web service to the previously good release if severe login/routing problems occur.
- No table migration or destructive data change exists in this PR. Existing server sessions survive rollback unless explicitly invalidated by login/logout.
- Do not reset Supabase users, sessions, archive data, announcements or payments.
