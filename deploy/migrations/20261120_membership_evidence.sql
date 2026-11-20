-- Apply with a deployment owner on a disposable clone before release.
BEGIN;
CREATE TABLE IF NOT EXISTS parish_auth.membership_evidence (
  user_id integer PRIMARY KEY REFERENCES parish_auth."User"(id),
  image bytea NOT NULL CHECK (octet_length(image) BETWEEN 1 AND 1048576),
  record_hint varchar(160) NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  matched_document_id integer REFERENCES parish_private.document(id),
  reviewed_by integer REFERENCES parish_auth."User"(id),
  reviewed_at timestamptz,
  review_reason varchar(500),
  decision text CHECK (decision IN ('approved','rejected'))
);
ALTER TABLE parish_auth.membership_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parish_auth.membership_evidence FROM PUBLIC;
-- Application reads/writes are server-only, using the existing private database
-- owner. No browser, anonymous or Supabase Auth access policies are created.
COMMIT;
