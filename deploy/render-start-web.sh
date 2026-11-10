#!/bin/sh
set -eu
: "${DATABASE_URL:?Set the persistent Prisma SQLite URL}"
: "${APP_BASE_URL:?Set the public website URL}"
: "${FLASK_API_URL:?Set the private Flask URL}"
: "${FLASK_INTERNAL_KEY:?Set the shared internal service key}"

# Creates a new empty STAGING database only; not a substitute for proper migration baselining.
if [ ! -f /var/data/dev.db ]; then
  if [ "${STAGING_BOOTSTRAP:-NO}" != YES ]; then
    echo 'STOP: dev.db absent. Explicitly enable STAGING_BOOTSTRAP=YES only for a fresh staging disk.' >&2
    exit 3
  fi
  echo 'INITIALIZING EMPTY STAGING PRISMA DB. NO EXISTING ACCOUNTS COPIED.'
  npx prisma db push
fi
exec npm run start -- -H 0.0.0.0 -p "${PORT:-10000}"
