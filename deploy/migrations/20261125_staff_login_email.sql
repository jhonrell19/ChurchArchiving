-- Run in the parish database after confirming the parish controls the new mailbox.
-- Changes the existing login in place, retaining record ownership and MFA enrollment.
BEGIN;
DO $$
DECLARE account_id integer;
BEGIN
  SELECT id INTO STRICT account_id FROM parish_auth."User"
    WHERE lower(email)='burial@ifimaragondon.com' AND role::text IN ('STAFF','BURIAL_ADMIN')
    FOR UPDATE;
  IF EXISTS (SELECT 1 FROM parish_auth."User" WHERE lower(email)='staff@ifimaragondon.com') THEN
    RAISE EXCEPTION 'Staff mailbox already belongs to an account. No changes applied.';
  END IF;
  UPDATE parish_auth."User" SET email='staff@ifimaragondon.com', "emailVerified"=false,
    "updatedAt"=now() WHERE id=account_id;
  DELETE FROM parish_auth."Session" WHERE "userId"=account_id;
  DELETE FROM parish_auth."StaffMfaChallenge" WHERE "userId"=account_id;
  DELETE FROM parish_auth."EmailVerificationToken" WHERE "userId"=account_id;
  DELETE FROM parish_auth."PasswordResetToken" WHERE "userId"=account_id;
  INSERT INTO parish_private.audit_log ("user",action,created_at)
    VALUES (current_user,'Changed legacy staff login email for account #' || account_id,now());
END $$;
COMMIT;
