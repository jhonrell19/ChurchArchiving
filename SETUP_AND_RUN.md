# Setup and Run — Windows Development

## 1. Restore your private local files

A source-only update package intentionally does not contain `.env`, databases, real uploads, or `venv`.

Keep your existing:

```text
.env
dev.db
church_backend/instance/archive.db
uploads/
church_backend/uploads/
venv/
```

## 2. Frontend/auth setup

From the project root:

```powershell
npm install
npx prisma generate
npx prisma db push
```

If this is a brand-new empty local database and you want staff development accounts:

```powershell
npx tsx scripts/create-staff-accounts.ts
```

## 3. Python setup

```powershell
.\venv\Scripts\Activate.ps1
python -m pip install -r church_backend\requirements.txt
python church_backend\migrate_panel_phase1.py
python -m py_compile church_backend\server.py church_backend\models.py church_backend\wsgi.py
```

## 4. Start the backend

Terminal 1:

```powershell
.\venv\Scripts\Activate.ps1
python church_backend\server.py
```

Expected local address: `http://127.0.0.1:5000`.

## 5. Start Next.js

Terminal 2:

```powershell
npm run dev
```

Open `http://localhost:3000`.

## 6. If the browser still shows an old Turbopack chunk

Stop Next.js, then:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

## 7. Final local checks

```powershell
npm run lint
npm run build
```

Then follow `TESTING_GUIDE.md`.
