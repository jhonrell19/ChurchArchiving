#!/bin/sh
set -eu
: "${ARCHIVE_DATABASE_URL:?Set the persistent SQLite URL}"
: "${SMART_PARISH_UPLOAD_ROOT:?Set the persistent upload root}"
: "${FLASK_INTERNAL_KEY:?Configure the shared internal service key}"
: "${FLASK_SECRET_KEY:?Configure the Flask secret key}"
: "${APP_BASE_URL:?Set the public website URL}"

# Intentionally staging-only. Never initializes/overwrites an existing database.
if [ ! -f /var/data/archive.db ]; then
  if [ "${STAGING_BOOTSTRAP:-NO}" != YES ]; then
    echo 'STOP: archive.db absent. Explicitly enable STAGING_BOOTSTRAP=YES only for a fresh staging disk.' >&2
    exit 3
  fi
  echo 'INITIALIZING EMPTY STAGING FLASK DB. NO PRODUCTION RECORDS COPIED.'
  # Development-mode schema creation occurs before the API server accepts connections.
  SMART_PARISH_ENV=development python -c "import sys;sys.path.insert(0,'/app/church_backend');import server"
  python /app/scripts/migrate_payment_ledger.py --database /var/data/archive.db \
    --apply --backup-dir /var/data/backups
fi
exec gunicorn --chdir /app/church_backend --workers 1 --threads 4 \
  --timeout 180 --bind "0.0.0.0:${PORT:-10000}" server:app
