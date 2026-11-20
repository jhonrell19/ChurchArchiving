BEGIN;
CREATE TABLE IF NOT EXISTS parish_private.appointment_slot (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, office text NOT NULL CHECK(office IN ('main','burial')),
 starts_at timestamptz NOT NULL, capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 200),
 created_by integer NOT NULL REFERENCES parish_auth."User"(id), UNIQUE(office,starts_at));
CREATE TABLE IF NOT EXISTS parish_private.appointment_booking (
 slot_id integer NOT NULL REFERENCES parish_private.appointment_slot(id),
 user_id integer NOT NULL REFERENCES parish_auth."User"(id),
 booked_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(slot_id,user_id));
CREATE INDEX IF NOT EXISTS appointment_start_idx ON parish_private.appointment_slot(starts_at);
CREATE INDEX IF NOT EXISTS appointment_user_idx ON parish_private.appointment_booking(user_id);
CREATE OR REPLACE FUNCTION parish_private.guard_booking_capacity() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
DECLARE cap int; slot_time timestamptz;
BEGIN
 SELECT capacity, starts_at INTO STRICT cap,slot_time FROM parish_private.appointment_slot WHERE id=NEW.slot_id FOR UPDATE;
 IF slot_time<=now() OR (SELECT count(*) FROM parish_private.appointment_booking WHERE slot_id=NEW.slot_id)>=cap THEN
   RAISE EXCEPTION 'Appointment unavailable' USING ERRCODE='23514';
 END IF; RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER guard_booking_capacity BEFORE INSERT ON parish_private.appointment_booking
FOR EACH ROW EXECUTE FUNCTION parish_private.guard_booking_capacity();
ALTER TABLE parish_private.appointment_booking ENABLE ROW LEVEL SECURITY;
ALTER TABLE parish_private.appointment_slot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parish_private.appointment_booking,parish_private.appointment_slot FROM PUBLIC;
COMMIT;
