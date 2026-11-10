#!/bin/sh
# Disposable Render Free STAGING Flask startup. Public web service; X-Internal-Key required.
set -eu
: "${ARCHIVE_DATABASE_URL:?ARCHIVE_DATABASE_URL is required}"
: "${SMART_PARISH_UPLOAD_ROOT:?SMART_PARISH_UPLOAD_ROOT is required}"
: "${FLASK_INTERNAL_KEY:?FLASK_INTERNAL_KEY is required}"
: "${FLASK_SECRET_KEY:?FLASK_SECRET_KEY is required}"
: "${APP_BASE_URL:?APP_BASE_URL is required}"
[ "${STAGING_BOOTSTRAP:-NO}" = YES ] || { echo 'STOP: set STAGING_BOOTSTRAP=YES for disposable testing only' >&2; exit 3; }
[ "${PAYMONGO_MODE:-test}" = test ] && [ "${PAYMONGO_LIVE_ENABLED:-NO}" != YES ] || { echo 'STOP: real payments are forbidden on disposable staging' >&2; exit 3; }
[ "$ARCHIVE_DATABASE_URL" = 'sqlite:////tmp/smartparish-archive.db' ] || { echo 'STOP: unexpected archive database path' >&2; exit 3; }
[ "$SMART_PARISH_UPLOAD_ROOT" = '/tmp/smartparish-uploads' ] || { echo 'STOP: unexpected uploads path' >&2; exit 3; }
mkdir -p "$SMART_PARISH_UPLOAD_ROOT" /tmp/smartparish-ledger-backups
if [ ! -f /tmp/smartparish-archive.db ]; then
  echo 'FREE STAGING: Creating an EMPTY, TEMPORARY archive database.'
  SMART_PARISH_ENV=development python -c "import sys;sys.path.insert(0,'/app/church_backend');import server"
fi
python /app/scripts/migrate_payment_ledger.py \
  --database /tmp/smartparish-archive.db \
  --apply --backup-dir /tmp/smartparish-ledger-backups
export SMART_PARISH_ENV=production
exec gunicorn --chdir /app/church_backend --workers 1 --threads 2 \
  --timeout 120 --bind "0.0.0.0:${PORT:-10000}" server:app
