#!/bin/sh
set -eu
: "${ARCHIVE_POSTGRES_URL:?Set the imported Supabase Session pooler URL}"
: "${FLASK_INTERNAL_KEY:?Set the shared server key}"
: "${FLASK_SECRET_KEY:?Set the Flask secret}"
: "${SMART_PARISH_UPLOAD_ROOT:?Set the upload directory on the persistent disk}"
: "${PGSSLROOTCERT:?Set the trusted Supabase CA file}"
test -r "$PGSSLROOTCERT"
export SMART_PARISH_ENV=production
umask 077
sudo -n /usr/local/sbin/init-parish-disk
mkdir -p "$SMART_PARISH_UPLOAD_ROOT" "${HF_HOME:-/var/data/model-cache}"
test -w "$SMART_PARISH_UPLOAD_ROOT"
exec gunicorn --chdir /app/church_backend --workers 1 --threads 4 \
  --timeout 300 --bind "0.0.0.0:${PORT:-10000}" wsgi:app
