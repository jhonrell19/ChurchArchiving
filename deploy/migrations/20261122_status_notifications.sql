-- Phase 9 notification outbox. ADDITIVE ONLY. Apply ONCE to the existing
-- Supabase database after taking a backup, before enabling
-- PARISH_STATUS_NOTIFICATIONS in the Render Next.js service.
-- Does not modify payment or certificate request tables.
BEGIN;

CREATE TABLE IF NOT EXISTS parish_auth."NotificationPreference" (
  "userId" integer PRIMARY KEY
    REFERENCES parish_auth."User"(id) ON DELETE CASCADE,
  "smsUpdates" boolean NOT NULL DEFAULT FALSE,
  "emailUpdates" boolean NOT NULL DEFAULT TRUE,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parish_auth."NotificationEvent" (
  id serial PRIMARY KEY,
  "userId" integer NOT NULL
    REFERENCES parish_auth."User"(id) ON DELETE CASCADE,
  "requestId" integer NOT NULL,
  office varchar(16) NOT NULL DEFAULT 'main'
    CHECK (office IN ('main','burial')),
  kind varchar(40) NOT NULL,
  "eventKey" varchar(64) NOT NULL UNIQUE,
  message varchar(350) NOT NULL,
  "emailState" varchar(20) NOT NULL DEFAULT 'pending'
    CHECK ("emailState" IN ('pending','processing','accepted','skipped','rejected','uncertain')),
  "smsState" varchar(20) NOT NULL DEFAULT 'pending'
    CHECK ("smsState" IN ('pending','processing','accepted','skipped','rejected','uncertain')),
  "emailAttemptedAt" timestamp(3),
  "smsAttemptedAt" timestamp(3),
  "smsBatchId" varchar(128),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "NotificationEvent_userId_createdAt_idx"
ON parish_auth."NotificationEvent" ("userId","createdAt");

CREATE INDEX IF NOT EXISTS "NotificationEvent_office_smsState_emailState_idx"
ON parish_auth."NotificationEvent" (office,"smsState","emailState");

ALTER TABLE parish_auth."NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE parish_auth."NotificationEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parish_auth."NotificationPreference" FROM PUBLIC;
REVOKE ALL ON parish_auth."NotificationEvent" FROM PUBLIC;
REVOKE ALL ON SEQUENCE parish_auth."NotificationEvent_id_seq" FROM PUBLIC;

COMMIT;

-- Verification (read only):
-- SELECT to_regclass('parish_auth."NotificationEvent"');
-- SELECT COUNT(*) FROM parish_auth."NotificationEvent";
