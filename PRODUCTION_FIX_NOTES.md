# Smart Parish System — Production Security Baseline

This package contains a coordinated security baseline for the current project. It focuses on fixing the repeated login bypass, stale role/session behavior, profile authentication failures, direct browser calls to Flask, and role/data separation.

## What changed

- Removed legacy `src/middleware.ts`; Next.js 16 uses `src/proxy.ts`.
- Replaced long-lived role-bearing JWT login sessions with database-backed sessions.
- Added Prisma `Session` table.
- Added `src/lib/auth.ts` as the single authentication source of truth.
- Added server-side role checks to `/dashboard`, `/admin`, and `/burial-admin` using layouts.
- Login deletes the old `token` cookie so old ADMIN JWTs cannot affect new tests.
- Logout deletes the server-side session and both old/new cookies.
- `/api/auth/me` now uses the same database-backed session as route authorization.
- Added a same-origin Next.js backend relay at `/api/backend/...`.
- Frontend no longer calls `127.0.0.1:5000` directly.
- Flask API/file routes require `FLASK_INTERNAL_KEY` and trusted user headers from Next.js.
- Flask enforces USER / ADMIN / BURIAL_ADMIN access and department scoping.
- User request history is filtered by the logged-in account email.
- Main Admin archive access is limited to baptismal, confirmation, marriage.
- Burial Admin archive access is limited to burial and land agreement.
- Main Admin dashboard no longer shows Burial/Death statistics.
- Fixed duplicate archive-success logic and the Burial Archive form resetting to `baptismal`.
- Fixed the broken Forgot Password page by disabling token-return-to-browser recovery until email delivery is configured.
- Updated the obsolete Prisma seed to current fields/roles.

## 1. Back up your current project and databases

Make a copy of the project folder before applying the changes. Also copy both SQLite databases if they contain data.

## 2. Environment variables

Copy `.env.example` to `.env` if necessary. Preserve your existing `DATABASE_URL`.

Generate THREE different random secrets in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run it three times and set:

```env
JWT_SECRET="first-random-value"
FLASK_INTERNAL_KEY="second-random-value"
FLASK_SECRET_KEY="third-random-value"
```

Local Flask connection:

```env
FLASK_API_URL="http://127.0.0.1:5000"
```

Do not commit `.env`.

## 3. Apply the Prisma Session table

From the project root:

```powershell
npx.cmd prisma format
npx.cmd prisma generate
npx.cmd prisma db push
```

This adds a new `Session` table. Do not use `--force-reset`.

## 4. Start Flask

Install Python dependencies if needed:

```powershell
pip install -r church_backend\requirements.txt
```

Then:

```powershell
python church_backend\server.py
```

For local development only, Flask listens on `127.0.0.1:5000`.

## 5. Start Next.js

In another terminal:

```powershell
npm run dev
```

## 6. Important: clear old browser authentication

The new system uses `parish_session`, not the old `token` JWT cookie. Login also deletes the old cookie, but for a clean first test use InPrivate/Incognito or clear site cookies for `localhost`.

## 7. Test matrix

### Logged out

- `/dashboard` -> `/login`
- `/admin` -> `/login`
- `/burial-admin` -> `/login`

### USER

- `/dashboard` -> allowed
- `/admin` -> `/dashboard`
- `/burial-admin` -> `/dashboard`

### ADMIN

- `/admin` -> allowed
- `/dashboard` -> `/admin`
- `/burial-admin` -> `/admin`

### BURIAL_ADMIN

- `/burial-admin` -> allowed
- `/admin` -> `/burial-admin`
- `/dashboard` -> `/burial-admin`

### Logout

After logout, manually typing any protected route must return to `/login`.

### Profile

USER -> Profile must load `/api/auth/me` successfully and show name/email/phone/address.

### API/data isolation

- USER should only see their own document requests.
- ADMIN must not see burial/land-agreement archive records or requests.
- BURIAL_ADMIN must not see baptismal/confirmation/marriage archive records or requests.

## 8. Production deployment notes

Do not expose the Flask service directly to the public internet if your hosting platform supports private/internal networking. The browser should talk only to Next.js; Next.js talks to Flask using `FLASK_INTERNAL_KEY`.

Do not use Flask's development server for public production traffic. Deploy Flask with a production WSGI server (for example Gunicorn on Linux) behind HTTPS/reverse proxy/private networking.

Before public deployment, update Next.js from 16.2.6 to a currently patched 16.x release and regenerate `package-lock.json` using npm.

## Still pending before calling the whole system production-complete

- Google sign-in / Facebook sign-in
- Email verification
- Real password-reset email delivery
- Login rate limiting / brute-force protection
- PostgreSQL migration
- Production file/object storage instead of local files
- Backup/restore automation
- True semantic AI summarization (current longest-sentence highlight is not full summarization)
- Remaining missing `/images/Land*.jpg/png` assets
