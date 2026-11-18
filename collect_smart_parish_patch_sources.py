r"""Collect only selected Smart Parish source files for current-code patch review.

Run from backup-church-eval-staging: python .\collect_smart_parish_patch_sources.py
No environment files, credentials, DBs, uploads, or node_modules are collected.
Inspect source before sharing if you have ever hardcoded secrets in code.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from datetime import datetime

root = Path.cwd()
if not (root / 'package.json').is_file() or not (root / 'prisma' / 'schema.prisma').is_file():
    raise SystemExit('ERROR: Run from the backup-church-eval-staging project root.')

files = [
    'package.json',
    'prisma/schema.prisma',
    'prisma.config.ts',
    'src/middleware.ts',
    'middleware.ts',
    'src/app/admin/AdminPanel.tsx',
    'src/app/admin/member-approvals/page.tsx',
    'src/app/admin/reports/AdminRequestReport.tsx',
    'src/app/admin/reports/page.tsx',
    'src/app/api/admin/membership/route.ts',
    'src/app/api/auth/google/route.ts',
    'src/app/api/auth/google/callback/route.ts',
    'src/app/api/auth/login/route.ts',
    'src/app/api/auth/register/route.ts',
    'src/app/api/auth/verify-email/route.ts',
    'src/app/api/auth/me/route.ts',
    'src/app/api/auth/session/route.ts',
    'src/app/register/page.tsx',
    'src/components/auth/GoogleAuthButton.tsx',
    'src/lib/auth.ts',
    'src/lib/prisma.ts',
]
now = datetime.now().strftime('%Y%m%d-%H%M%S')
archive = root.parent / f'SmartParish_Current_Code_Review_{now}.zip'
count = 0
with ZipFile(archive, 'x', ZIP_DEFLATED) as z:
    for rel in files:
        src = root / rel
        if src.is_file():
            z.write(src, arcname=rel)
            count += 1
            print('INCLUDED:', rel)
        else:
            print('NOT FOUND (OK):', rel)

print('\nSOURCE ARCHIVE CREATED:', archive)
print('Number of source files:', count)
print('NO .env, SQLite DB, uploaded records, node_modules or credentials files collected.')
print('Please review the archive for ANY SECRETS HARDCODED IN SOURCE before uploading it.')
