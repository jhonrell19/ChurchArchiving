# Smart Parish System — Full Testing Guide

Stop when a numbered test fails. Record the browser error, Next.js terminal output, and Flask terminal output before changing code.

## 1. Preserve local data first

Before replacing/updating source, keep copies of:

```text
.env
dev.db
church_backend/instance/archive.db
uploads/
church_backend/uploads/
venv/
```

Never overwrite those with a downloaded source-only package.

## 2. Install/update dependencies

From the project root:

```powershell
npm install
npx prisma generate
npx prisma db push
```

Activate Python and install requirements:

```powershell
.\venv\Scripts\Activate.ps1
python -m pip install -r church_backend\requirements.txt
```

For OCR, also install the Tesseract application and make sure `tesseract.exe` is on PATH.

## 3. Run backend migration and compile checks

```powershell
python church_backend\migrate_panel_phase1.py
python -m py_compile church_backend\server.py church_backend\models.py church_backend\migrate_panel_phase1.py church_backend\wsgi.py
```

Expected: migration completes without deleting existing archive records. `py_compile` prints nothing.

## 4. Start both services

Terminal 1:

```powershell
.\venv\Scripts\Activate.ps1
python church_backend\server.py
```

Terminal 2:

```powershell
npm run dev
```

Open `http://localhost:3000`.

## 5. Logged-out route protection

In Incognito/InPrivate, manually open:

```text
/dashboard
/admin
/burial-admin
```

All must redirect to `/login`.

## 6. Main Admin role

Login using the staff account you created/seeded.

Expected:
- `/admin` allowed.
- `/dashboard` redirects to `/admin`.
- `/burial-admin` redirects to `/admin`.
- Dashboard archive/request/mass calls return 200.
- Main Admin only sees Baptismal, Confirmation, Marriage archives/requests.

## 7. Burial Admin role

Expected:
- `/burial-admin` allowed.
- `/admin` and `/dashboard` redirect to `/burial-admin`.
- Burial Admin only sees Burial Certificate and Land Agreement archives/requests.

## 8. Registration validation + email verification

Create User A with a real-looking unique email.

Verify:
- Missing/invalid name/email/phone/password is rejected.
- Public registration cannot choose ADMIN/BURIAL_ADMIN.
- New USER cannot log in until verified.

Without `RESEND_API_KEY`, development registration returns/displays a development verification link. Open it and confirm login succeeds afterward.

With Resend configured, confirm the real email contains a working verification link.

## 9. Password recovery

Use Forgot Password.
- Unknown addresses should not disclose whether an account exists.
- Development mode shows a reset link if email delivery is not configured.
- Reset with a strong new password.
- Old password must fail.
- Existing sessions should be invalidated.

## 10. User ownership/privacy

Create User A and User B.

User A creates a Regular Baptismal request.

Login User B:
- User B must not see User A's request.
- Old historical requests with `requester_user_id = NULL` must not appear to either new user.

## 11. Regular + urgent fees

Regular request expected demo total:

```text
Base fee   PHP 100
Urgent     PHP 0
Total      PHP 100
```

Urgent request expected:

```text
Base fee   PHP 100
Urgent     PHP 50
Total      PHP 150
```

## 12. Improved identifying information

Submit a request containing:
- Name on record.
- Approximate record date/year.
- Identifying details such as parent/spouse/book/page if known.

The correct admin should see those clues inside the request workspace.

## 13. Archive OCR

As the correct Admin, upload/preview a scanned test record.

Verify:
- OCR preview works for supported image/PDF input when Tesseract is installed.
- Extracted text is displayed as unverified OCR.
- "Use Safe Suggestions" does not silently save the entire OCR result as trusted metadata.
- Admin can correct fields before upload.
- Archive remains usable if OCR fails; OCR is assistance, not a hard dependency.

## 14. New request fulfillment flow

For a request whose archive record exists:

1. Open the request.
2. Search the archive from inside the request.
3. Verify the results are restricted to the request's certificate category.
4. Preview a candidate source scan.
5. Select the correct source record.
6. Confirm the UI records it as the verified source.
7. Approve the request.

The selected archive source must not automatically become the user's downloadable release file.

## 15. Payment gate

A Pending request cannot be paid.

After Approved:
- User can perform Demo Pay.
- `paymentStatus` becomes Paid.
- method is DEMO.
- reference is generated.

Do not interpret this as real PayMongo money movement.

## 16. Final release document

After a source is verified and request approved:

Option A: upload a final PDF/DOCX/image prepared by staff.

Option B: click Generate Draft PDF and review the generated draft.

Expected:
- Final file is stored as `generated_file`.
- Request becomes Ready.
- Original archive source remains internal.

## 17. Release protection

Try to release Ready + Unpaid: must fail.

For Paid + Ready + final release file: Release must succeed.

User owner then gets a Download Document action.

## 18. Secure download

Verify:
- Owner cannot download before Released/Paid.
- Owner can download after Released/Paid.
- User B cannot download User A's released certificate even if User B guesses the request ID.
- Normal users cannot browse sacramental source scans through `/files/...`.

## 19. Mass archive + AI

As Main Admin:
- Add/upload a short Mass recording first.
- Run AI Transcribe.
- First AI request may take longer while Whisper loads.
- Transcript and extractive summary save correctly.
- Transcript PDF is generated.

As USER:
- Active Mass media can be opened.
- Transcription page can display transcript/summary.
- Transcript PDF can be downloaded.

## 20. Announcements/scheduling

Admin creates an announcement.
USER can see the published announcement.
Deleted/deactivated announcement no longer appears to USER.

## 21. Archive recycle bin

Soft-delete a disposable test archive row.
Verify it disappears from active archive and appears in Recycle Bin.
Restore it and verify it returns.

## 22. UI and missing assets

Browse Home/Login/Register/User/Admin/Burial Admin at desktop and narrow/mobile widths.

There should be no `/images/Land1.png` etc. 404s. Empty databases should show empty states, not fake records.

## 23. Logout/session security

For USER, ADMIN, BURIAL_ADMIN:
- Logout.
- Manually type the protected dashboard URL.
- Refresh.
- Access must remain blocked.

## 24. Source audit

```powershell
Get-ChildItem .\src -Recurse -File | Select-String -Pattern "mockData|MOCK_|http://127\.0\.0\.1:5000"
```

Expected: no active frontend mock-data imports/direct browser-Flask URLs.

## 25. Final code checks

```powershell
npm run lint
npm run build
```

Both should pass before calling the revision stable.

## 26. Critical defense flow

The most important demonstration is:

```text
Register/verify USER
-> Submit request
-> User isolation
-> Correct staff office
-> Search/preview/select internal archive source
-> Approve
-> Pay
-> Upload/generate final release certificate
-> Ready
-> Release blocked if unpaid
-> Release when paid
-> Owner-only download
```
