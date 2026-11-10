#!/bin/sh
# Disposable Render Free STAGING web startup. Never use for actual parish data/payments.
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${APP_BASE_URL:?APP_BASE_URL is required}"
: "${FLASK_API_URL:?FLASK_API_URL is required}"
: "${FLASK_INTERNAL_KEY:?FLASK_INTERNAL_KEY is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
[ "${STAGING_BOOTSTRAP:-NO}" = YES ] || { echo 'STOP: set STAGING_BOOTSTRAP=YES for disposable testing only' >&2; exit 3; }
[ "${PAYMONGO_MODE:-test}" = test ] && [ "${PAYMONGO_LIVE_ENABLED:-NO}" != YES ] || { echo 'STOP: real payments are forbidden on disposable staging' >&2; exit 3; }
case "$DATABASE_URL" in
  file:/tmp/*) ;;
  *) echo 'STOP: This free demo script only supports a temporary SQLite DB under /tmp' >&2; exit 3 ;;
esac
# Schema sync is only for an explicitly disposable database. Prisma refuses destructive drift by default.
echo 'FREE STAGING: Ensuring disposable Prisma tables exist (NOT production migrations).'
npx prisma db push
if [ "${STAGING_STAFF_BOOTSTRAP:-NO}" = YES ]; then
  : "${MAIN_ADMIN_EMAIL:?Required for staging staff provisioning}"
  : "${MAIN_ADMIN_PASSWORD:?Required for staging staff provisioning}"
  : "${BURIAL_ADMIN_EMAIL:?Required for staging staff provisioning}"
  : "${BURIAL_ADMIN_PASSWORD:?Required for staging staff provisioning}"
  : "${STAFF_MFA_ENCRYPTION_KEY:?Required to enroll staff MFA}"
  # Avoid rotating accounts while the same temporary filesystem survives a process restart.
  if [ ! -f /tmp/smartparish-staff-bootstrapped ]; then
    echo 'FREE STAGING: Creating two TEST staff accounts (do not reuse your real passwords).'
    npx tsx scripts/create-staff-accounts.ts
    touch /tmp/smartparish-staff-bootstrapped
  fi
fi
exec npm run start -- -H 0.0.0.0 -p "${PORT:-10000}"
