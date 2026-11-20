BEGIN;
CREATE TABLE IF NOT EXISTS parish_private.announcement_slide(
 announcement_id integer PRIMARY KEY REFERENCES parish_private.announcement(id), priority integer NOT NULL DEFAULT 0,
 image_path text, starts_at date, ends_at date, CHECK(ends_at IS NULL OR starts_at IS NULL OR starts_at<=ends_at)
);
ALTER TABLE parish_private.announcement_slide ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parish_private.announcement_slide FROM PUBLIC;
COMMIT;
