-- After both updated services have been verified and the DB backup is complete.
-- Drops personal mailing addresses permanently. Parish office contact stays intact.
BEGIN;
ALTER TABLE parish_private.certificate_request DROP COLUMN IF EXISTS requester_address;
ALTER TABLE parish_auth."User" DROP COLUMN IF EXISTS address;
COMMIT;
