BEGIN;
CREATE TABLE IF NOT EXISTS parish_private.member_activity (
 user_id integer PRIMARY KEY REFERENCES parish_auth."User"(id), status text NOT NULL CHECK(status IN ('active','inactive')),
 reason varchar(500) NOT NULL, changed_by integer REFERENCES parish_auth."User"(id), changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_activity_status ON parish_private.member_activity(status,changed_at);
CREATE TABLE IF NOT EXISTS parish_private.report_schedule (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 frequency text NOT NULL CHECK(frequency IN('weekly','monthly')), format text NOT NULL CHECK(format IN('pdf','xlsx')),
 office text NOT NULL CHECK(office IN('main','burial')), category text, request_status text, payment_method text,
 created_by integer NOT NULL REFERENCES parish_auth."User"(id), enabled boolean NOT NULL DEFAULT true,
 next_run date NOT NULL, last_run timestamptz
);
CREATE TABLE IF NOT EXISTS parish_private.report_run(
 schedule_id integer NOT NULL REFERENCES parish_private.report_schedule(id), due date NOT NULL,
 generated_at timestamptz NOT NULL DEFAULT now(), report bytea NOT NULL, PRIMARY KEY(schedule_id,due)
);
ALTER TABLE parish_private.member_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE parish_private.report_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE parish_private.report_run ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parish_private.member_activity,parish_private.report_schedule,parish_private.report_run FROM PUBLIC;
COMMIT;
