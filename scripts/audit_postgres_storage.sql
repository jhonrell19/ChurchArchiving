-- Read-only staging inventory. Returns counts and schema metadata only.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema IN ('parish_auth', 'parish_private', 'parish_v2')
ORDER BY table_schema, table_name, ordinal_position;

SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls,
       count(p.polname) AS policy_count
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname IN ('parish_auth','parish_private','parish_v2') AND c.relkind IN ('r','p')
GROUP BY n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
ORDER BY 1,2;

-- Counts of direct file references, including legacy backslash paths.
-- A reference cannot prove the underlying file still exists. Original scan
-- metadata and generated sidecars require a separate filesystem reconciliation.
WITH refs(category, path) AS (
  SELECT 'document', filepath FROM parish_private.document UNION ALL
  SELECT 'draft', draft_file FROM parish_private.certificate_request UNION ALL
  SELECT 'released', generated_file FROM parish_private.certificate_request UNION ALL
  SELECT 'mass', filepath FROM parish_private.mass_record UNION ALL
  SELECT 'transcript', transcript_filepath FROM parish_private.mass_record UNION ALL
  SELECT 'contract', contract_file FROM parish_private.cemetery_reservation UNION ALL
  SELECT 'death_certificate', death_certificate_file FROM parish_private.burial_record UNION ALL
  SELECT 'burial_permit', burial_permit_file FROM parish_private.burial_record UNION ALL
  SELECT 'authorization', authorization_file FROM parish_private.burial_record
)
SELECT category, count(*) AS nonempty_refs,
       count(*) FILTER (WHERE replace(path,chr(92),'/') LIKE 'uploads/%') AS uploads_refs,
       count(*) FILTER (WHERE path ~* '^https?://') AS url_refs
FROM refs WHERE nullif(btrim(path),'') IS NOT NULL GROUP BY category ORDER BY category;
ROLLBACK;
