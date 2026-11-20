BEGIN;
CREATE TABLE IF NOT EXISTS parish_private.relationship_claim (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 applicant_id integer NOT NULL REFERENCES parish_auth."User"(id),
 owner_name varchar(160) NOT NULL, category varchar(40) NOT NULL,
 relationship varchar(80) NOT NULL, proof bytea NOT NULL CHECK(octet_length(proof) BETWEEN 1 AND 1048576),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','disputed','approved','rejected')),
 document_id integer REFERENCES parish_private.document(id),
 reviewer_id integer REFERENCES parish_auth."User"(id), reason varchar(500),
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS claim_queue ON parish_private.relationship_claim(category,status,id);
CREATE INDEX IF NOT EXISTS claim_applicant ON parish_private.relationship_claim(applicant_id,id);
CREATE TABLE IF NOT EXISTS parish_private.request_claim (
 request_id integer PRIMARY KEY REFERENCES parish_private.certificate_request(id),
 claim_id integer NOT NULL REFERENCES parish_private.relationship_claim(id)
);
ALTER TABLE parish_private.relationship_claim ENABLE ROW LEVEL SECURITY;
ALTER TABLE parish_private.request_claim ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parish_private.relationship_claim,parish_private.request_claim FROM PUBLIC;
COMMIT;
