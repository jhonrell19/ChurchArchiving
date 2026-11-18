#!/bin/sh
set -eu
: "${ARCHIVE_POSTGRES_URL:?Set the Supabase Session pooler URL}"
: "${STAFF_MFA_ENCRYPTION_KEY:?Use the existing staff MFA encryption key}"
: "${FLASK_INTERNAL_KEY:?Set the shared server key}"
if [ -z "${FLASK_API_URL:-}" ]; then
  : "${FLASK_HOSTPORT:?Missing Render private service address}"
  export FLASK_API_URL="http://$FLASK_HOSTPORT"
fi
export APP_BASE_URL="${APP_BASE_URL:-${RENDER_EXTERNAL_URL:?Set the public website URL}}"
case "$APP_BASE_URL" in https://*) ;; *) echo 'APP_BASE_URL requires https' >&2; exit 1 ;; esac
export NODE_EXTRA_CA_CERTS="$PWD/prod-ca-2021.crt"
test -r "$NODE_EXTRA_CA_CERTS"
exec npm run start -- -H 0.0.0.0 -p "${PORT:-10000}"
