BEGIN;
CREATE TABLE IF NOT EXISTS parish_private.policy_version(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, body text NOT NULL CHECK(length(body) BETWEEN 20 AND 20000),
 changed_by integer REFERENCES parish_auth."User"(id), published_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS parish_auth.policy_consent(
 user_id integer NOT NULL REFERENCES parish_auth."User"(id), version bigint NOT NULL REFERENCES parish_private.policy_version(id),
 accepted_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,version)
);
CREATE TABLE IF NOT EXISTS parish_private.purpose_catalog(
 category text PRIMARY KEY, choices jsonb NOT NULL CHECK(jsonb_typeof(choices)='array'),
 changed_by integer REFERENCES parish_auth."User"(id), changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE parish_private.policy_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE parish_auth.policy_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE parish_private.purpose_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parish_private.policy_version,parish_auth.policy_consent,parish_private.purpose_catalog FROM PUBLIC;
INSERT INTO parish_private.purpose_catalog(category,choices) VALUES ('baptismal','["School Requirements", "Employment Requirements", "Church Requirements", "Personal Record", "Government or Legal Requirements", "Other (Specify in Notes)"]'::jsonb) ON CONFLICT(category) DO NOTHING;
INSERT INTO parish_private.purpose_catalog(category,choices) VALUES ('confirmation','["Church Marriage Requirements", "School Requirements", "Employment Requirements", "Personal Record", "Government or Legal Requirements", "Other (Specify in Notes)"]'::jsonb) ON CONFLICT(category) DO NOTHING;
INSERT INTO parish_private.purpose_catalog(category,choices) VALUES ('marriage','["Civil Registration Requirements", "Government or Legal Requirements", "Visa or Immigration Requirements", "Personal Record", "Other (Specify in Notes)"]'::jsonb) ON CONFLICT(category) DO NOTHING;
INSERT INTO parish_private.purpose_catalog(category,choices) VALUES ('ownership','["Proof of Cemetery Lot Ownership", "Request Copy of Ownership Certificate", "Replacement of Lost or Damaged Certificate", "Cemetery Lot Ownership Verification", "Correction of Ownership Details", "Other (Specify in Notes)"]'::jsonb) ON CONFLICT(category) DO NOTHING;
INSERT INTO parish_private.purpose_catalog(category,choices) VALUES ('land_agreement','["Apply for Cemetery Lot Agreement", "Request Copy of Existing Land Agreement", "Review or Update Agreement Information", "Clarification of Cemetery Lot Terms", "Other (Specify in Notes)"]'::jsonb) ON CONFLICT(category) DO NOTHING;
INSERT INTO parish_private.policy_version(body) SELECT $notice$This system supports the parish's account management, church-record requests, archival services, and cemetery-related services.

Information you provide

Account registration collects your first name, surname, and email address. Middle name and phone number are optional. You may add contact and address information to your profile. Requests for certificates or cemetery services may require additional details and documents relevant to that service.

How information is used

Information is used for account authentication, email verification, parish-service requests, record matching, service communication, and payment processing where applicable. Staff access is restricted according to their assigned role.

Service providers

Depending on enabled features, the system may use Google for account sign-in, Resend for email delivery, and PayMongo for online payments. These providers process the information required for their respective services.

Questions and corrections

For questions about information held by the parish, or requests for corrections, contact the parish office directly. Official church records and financial transaction histories may require retention for parish operations.$notice$ WHERE NOT EXISTS(SELECT 1 FROM parish_private.policy_version);
COMMIT;
