-- POST-DEPLOY migration. Use only after /staff and both APIs pass smoke tests.
-- Existing users retain IDs, MFA enrollment, recovery codes and audit history.
-- Not part of the predeploy migration.
BEGIN;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM parish_auth."User" WHERE role::text='ADMIN' AND "accountEnabled") THEN
  RAISE EXCEPTION 'No active Super Admin: abort.';
 END IF;
END $$;
UPDATE parish_auth."User"
 SET role='STAFF', "updatedAt"=now()
 WHERE role::text='BURIAL_ADMIN';
-- Immediately invalidate old sessions / challenge tokens for their new role.
DELETE FROM parish_auth."Session" s USING parish_auth."User" u
 WHERE s."userId"=u.id AND u.role::text='STAFF';
DELETE FROM parish_auth."StaffMfaChallenge" c USING parish_auth."User" u
 WHERE c."userId"=u.id AND u.role::text='STAFF';
COMMIT;
-- Verify no BURIAL_ADMIN remains; do NOT drop the old enum label in this release.
-- SELECT role, count(*) FROM parish_auth."User" GROUP BY role;
