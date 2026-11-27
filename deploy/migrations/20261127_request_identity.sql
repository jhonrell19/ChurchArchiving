-- Apply before the application rollout. Existing requests keep NULL names.
BEGIN;
ALTER TABLE parish_private.certificate_request
  ADD COLUMN IF NOT EXISTS mother_full_name varchar(150),
  ADD COLUMN IF NOT EXISTS father_full_name varchar(150);
COMMIT;
