-- Additive PRE-DEPLOY migration; execute before the new Prisma/Next.js release.
-- This does NOT change any existing user role or delete any data.
ALTER TYPE parish_auth."Role" ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TABLE parish_auth."User"
  ADD COLUMN IF NOT EXISTS "accountEnabled" boolean NOT NULL DEFAULT true;

-- Verify before release:
-- SELECT role, count(*) FROM parish_auth."User" GROUP BY role;
-- SELECT count(*) FROM parish_auth."User" WHERE NOT "accountEnabled";
