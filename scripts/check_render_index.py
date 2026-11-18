"""Check the staged Git snapshot that Render will build. Prints paths only."""
from pathlib import PurePosixPath
import subprocess
import sys

tracked = subprocess.check_output(['git', 'ls-files', '-z']).decode().split('\0')
paths = {PurePosixPath(p) for p in tracked if p}
required = set(map(PurePosixPath, '''
render.yaml prod-ca-2021.crt package.json package-lock.json prisma/schema.prisma
prisma/seed.ts prisma.config.ts src/lib/prisma.ts src/lib/postgres-url.ts src/app/api/ready/route.ts
Dockerfile.smartparish-flask deploy/init-render-disk.sh deploy/render-build-web.sh
deploy/render-start-web.sh deploy/render-start-flask.sh church_backend/wsgi.py church_backend/server.py
church_backend/requirements.txt church_backend/models.py church_backend/document_templates.py
church_backend/ocr_fields.py church_backend/tesseract_runtime.py church_backend/parish_fees.py
config/parish_fees.json church_backend/templates/certificates/baptism_form.png
church_backend/templates/certificates/confirmation_form.png church_backend/templates/certificates/marriage_front.png
church_backend/templates/certificates/marriage_back.png
'''.split()))
missing = sorted(required - paths)
sensitive = sorted(p for p in paths if (
    (p.name.startswith('.env') and not p.name.endswith('.example'))
    or p.name.endswith(('.db', '.db-wal', '.db-shm', '.db-journal', '.sqlite', '.sqlite3', '.key', '.pfx'))
    or any(part.lower() in {'uploads', 'smartparish_database_backups'} for part in p.parts)
    or p.parts[:2] == ('church_backend', 'generated')
))
for p in missing:
    print('Missing from Git index:', p)
for p in sensitive:
    print('Private file in Git index:', p)
if missing or sensitive:
    sys.exit('Review the listed paths before pushing.')
print('Render input paths present. No database, private upload or .env filenames found in the Git index.')
