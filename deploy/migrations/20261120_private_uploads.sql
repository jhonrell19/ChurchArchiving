BEGIN;
CREATE TABLE IF NOT EXISTS parish_private.upload_object (
  logical_path text PRIMARY KEY,
  sha256 char(64) NOT NULL,
  size_bytes bigint NOT NULL CHECK(size_bytes >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE parish_private.upload_object ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parish_private.upload_object FROM PUBLIC;
COMMIT;
