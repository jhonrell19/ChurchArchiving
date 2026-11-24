-- Smart Parish announcement studio / independent announcement consent.
-- Apply on backed-up Supabase before deploying the matching web build.
-- Additive; preserves document, payment and existing announcement histories.
BEGIN;

CREATE TABLE IF NOT EXISTS parish_private.announcement_media (
  id bigserial PRIMARY KEY,
  announcement_id integer NOT NULL REFERENCES parish_private.announcement(id) ON DELETE CASCADE,
  object_path text NOT NULL UNIQUE,
  original_name varchar(160) NOT NULL,
  media_type varchar(8) NOT NULL CHECK (media_type IN ('image','video')),
  mime_type varchar(40) NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','video/mp4')),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 18874368),
  duration_seconds numeric(6,2),
  display_seconds integer NOT NULL DEFAULT 8 CHECK (display_seconds BETWEEN 5 AND 30),
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  CHECK (media_type = 'image' OR (duration_seconds > 0 AND duration_seconds <= 30))
);
CREATE INDEX IF NOT EXISTS announcement_media_notice_order_idx
  ON parish_private.announcement_media(announcement_id,sort_order,id);
ALTER TABLE parish_private.announcement_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parish_private.announcement_media FROM PUBLIC;
REVOKE ALL ON SEQUENCE parish_private.announcement_media_id_seq FROM PUBLIC;

ALTER TABLE parish_auth."NotificationPreference"
  ADD COLUMN IF NOT EXISTS "announcementEmail" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "announcementSms" boolean NOT NULL DEFAULT false;

-- Announcement events carry requestId=0 (never a real request). Existing
-- record-specific notification events and their unique keys remain unchanged.
ALTER TABLE parish_auth."NotificationEvent"
  DROP CONSTRAINT IF EXISTS "NotificationEvent_office_check";
ALTER TABLE parish_auth."NotificationEvent"
  ADD CONSTRAINT "NotificationEvent_office_check"
  CHECK (office IN ('main','burial','public'));

COMMIT;

-- Verification:
-- SELECT to_regclass('parish_private.announcement_media') AS media_table;
-- SELECT "announcementEmail","announcementSms" FROM parish_auth."NotificationPreference" LIMIT 1;
