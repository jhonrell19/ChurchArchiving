BEGIN;
CREATE TABLE IF NOT EXISTS parish_private.storage_quota(
 category text PRIMARY KEY, byte_limit bigint NOT NULL CHECK(byte_limit>0), max_file_bytes bigint NOT NULL CHECK(max_file_bytes>0));
ALTER TABLE parish_private.storage_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parish_private.storage_quota FROM PUBLIC;
-- Operational defaults for documents (32 MiB each) and recordings (80 MiB each).
INSERT INTO parish_private.storage_quota(category,byte_limit,max_file_bytes)
SELECT name, CASE WHEN name='masses' THEN 314572800 ELSE 52428800 END,
 CASE WHEN name='masses' THEN 83886080 ELSE 33554432 END
FROM unnest(ARRAY['baptismal','confirmation','marriage','burial','land_agreement','ownership','masses','archive_filled','releases','drafts','cemetery']) AS name
ON CONFLICT(category) DO NOTHING;
COMMIT;
