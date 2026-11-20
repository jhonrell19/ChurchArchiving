BEGIN;
CREATE TABLE IF NOT EXISTS parish_private.certificate_fee_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL,
  amount_php integer NOT NULL CHECK (amount_php >= 0),
  effective_at timestamptz NOT NULL DEFAULT now(),
  changed_by text
);
CREATE INDEX IF NOT EXISTS parish_fee_history_lookup ON parish_private.certificate_fee_history(code,effective_at DESC);
ALTER TABLE parish_private.certificate_fee_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parish_private.certificate_fee_history FROM PUBLIC;
LOCK TABLE parish_private.certificate_fee_settings IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO parish_private.certificate_fee_history(code,amount_php,changed_by)
SELECT s.code,s.amount_php,s.updated_by FROM parish_private.certificate_fee_settings s
WHERE NOT EXISTS (SELECT 1 FROM parish_private.certificate_fee_history h WHERE h.code=s.code);
CREATE OR REPLACE FUNCTION parish_private.capture_fee_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.amount_php IS DISTINCT FROM OLD.amount_php THEN
    INSERT INTO parish_private.certificate_fee_history(code,amount_php,changed_by)
    VALUES(NEW.code,NEW.amount_php,NEW.updated_by);
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER capture_fee_revision AFTER INSERT OR UPDATE OF amount_php
ON parish_private.certificate_fee_settings FOR EACH ROW EXECUTE FUNCTION parish_private.capture_fee_revision();
COMMIT;
