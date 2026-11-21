BEGIN;
CREATE TABLE IF NOT EXISTS parish_private.site_edition (
  revision integer PRIMARY KEY CHECK (revision > 0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  published_by integer NOT NULL REFERENCES parish_auth."User"(id),
  published_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE parish_private.site_edition ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parish_private.site_edition FROM PUBLIC;
COMMIT;
