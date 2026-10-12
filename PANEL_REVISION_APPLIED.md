# Panel Revision Pass - Applied

This source package applies the current revision pass without adding Google/Facebook OAuth, real PayMongo/QR Ph, email verification, or OCR/template extraction yet.

## Completed in this pass

- Removed prototype mock-data files and fake record arrays.
- Replaced mock-data imports with static UI constants and navigation configuration.
- User requests are loaded from the real backend API only.
- Request ownership uses the authenticated User ID on the Flask side.
- Registered name, email, phone, and address are supplied to Flask by the authenticated Next.js backend proxy.
- Added Regular and Urgent request workflow.
- Demo fees: base fee PHP 100; urgent add-on PHP 50.
- Demo payment is available after approval.
- Release is blocked until the request is Ready, has an attached document, and payment is Paid.
- Main Admin has separate Requests and Urgent Requests pages.
- Burial Admin has separate Requests and Urgent Requests pages.
- Main Admin remains limited to Baptismal, Confirmation, and Marriage requests.
- Burial Admin remains limited to Burial and Land Agreement requests.
- Removed the dead BurialRequestsPage duplicate; both staff roles reuse the secured real-data RequestsPage.
- Removed the unused prototype MassCard component.
- Removed direct browser-to-Flask URLs from frontend source.
- Brightened Login, Register, Forgot Password, Reset Password, User Dashboard, Main Admin, and Burial Admin presentation.
- Preserved the current database-backed parish_session authentication architecture.

## Intentionally postponed

- Google sign-in
- Facebook sign-in
- Email verification / deliverability API
- Real PayMongo / QR Ph payment
- OCR scanned-document extraction
- Official document template population
- PostgreSQL migration
- Semantic AI summarization upgrade

## Database migration

Do not reset either database.

From the project root with the Python virtual environment activated:

```powershell
python church_backend\migrate_panel_phase1.py
```

The migration is designed to add missing request ownership / urgent / payment columns without deleting existing records.

## Start locally

Terminal 1:

```powershell
.\venv\Scripts\Activate.ps1
python church_backend\server.py
```

Terminal 2:

```powershell
npm run dev
```

## Required test matrix

1. Create User A and User B.
2. User A creates a regular request.
3. User B must not see User A's request.
4. User B creates an urgent request.
5. Main Admin must only see Baptismal / Confirmation / Marriage for its office.
6. Burial Admin must only see Burial / Land Agreement for its office.
7. Regular requests appear under Requests, not Urgent Requests.
8. Urgent requests appear under Urgent Requests, not Requests.
9. Staff approves a request.
10. User performs Demo Pay.
11. Staff attaches the matching archive document; request becomes Ready.
12. Release must fail while unpaid.
13. Release must succeed only after Paid + Ready + attached document.
14. User can download only after Released + Paid.
15. Old test requests with requester_user_id NULL must not appear to newly created users.

## Files removed by this pass

- `src/app/admin/data/mockData.ts`
- `src/app/dashboard/data/mockData.ts`
- `src/app/admin/components/BurialRequestsPage.tsx`
- `src/app/dashboard/components/MassCard.tsx`

Do not recreate these files. Their required static UI constants/navigation are now in `data/ui.ts` and `data/navigation.ts`.
