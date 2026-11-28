BEGIN;
SET LOCAL search_path TO parish_private;
CREATE TABLE IF NOT EXISTS certificate_otp (
  user_id integer PRIMARY KEY, email text NOT NULL, digest text NOT NULL,
  attempts integer NOT NULL DEFAULT 0, issued_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS certificate_identity (
  request_id integer PRIMARY KEY REFERENCES certificate_request(id),
  fields jsonb NOT NULL, proof bytea, proof_type text, verified_email text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS certificate_status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, request_id integer NOT NULL REFERENCES certificate_request(id),
  status text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now(), actor text
);
CREATE INDEX IF NOT EXISTS certificate_history_request ON certificate_status_history(request_id,id);
CREATE OR REPLACE FUNCTION parish_private.log_certificate_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO parish_private.certificate_status_history(request_id,status,actor)
      VALUES(NEW.id,NEW.status,current_setting('parish.actor', true));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS certificate_status_change ON certificate_request;
CREATE TRIGGER certificate_status_change AFTER INSERT OR UPDATE OF status ON certificate_request
FOR EACH ROW EXECUTE FUNCTION parish_private.log_certificate_status();
REVOKE ALL ON certificate_otp,certificate_identity,certificate_status_history FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS archive_batch_usage (
  user_id integer NOT NULL, scope text NOT NULL, bucket text NOT NULL, used integer NOT NULL,
  PRIMARY KEY(user_id,scope,bucket)
);
REVOKE ALL ON archive_batch_usage FROM PUBLIC, anon, authenticated;
COMMIT;
