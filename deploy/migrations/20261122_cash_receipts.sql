-- Additive cash receipts; apply only after backup and operator approval.
-- Append-only by database trigger. No automatic modification of existing payments.
BEGIN;
CREATE TABLE IF NOT EXISTS parish_private.cash_receipt_ledger (
    id bigserial PRIMARY KEY,
    request_id integer NOT NULL REFERENCES parish_private.certificate_request(id),
    entry_kind text NOT NULL CHECK(entry_kind IN ('receipt','reversal')),
    receipt_number text NOT NULL UNIQUE CHECK(length(receipt_number) BETWEEN 6 AND 64),
    amount_cents bigint NOT NULL,
    original_entry_id bigint REFERENCES parish_private.cash_receipt_ledger(id),
    actor_user_id integer NOT NULL,
    actor_role text NOT NULL CHECK(actor_role IN ('ADMIN','BURIAL_ADMIN','STAFF')),
    reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 500),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
      (entry_kind = 'receipt' AND amount_cents > 0 AND original_entry_id IS NULL)
      OR (entry_kind = 'reversal' AND amount_cents < 0 AND original_entry_id IS NOT NULL)
    )
);
-- Multiple receipts can exist historically after a documented reversal.
-- The request row is locked by the application to allow only ONE active payment.
CREATE INDEX IF NOT EXISTS cash_receipt_by_request
    ON parish_private.cash_receipt_ledger(request_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS cash_receipt_single_reversal
    ON parish_private.cash_receipt_ledger(original_entry_id) WHERE entry_kind='reversal';
CREATE INDEX IF NOT EXISTS cash_receipt_by_date
    ON parish_private.cash_receipt_ledger(created_at DESC);
ALTER TABLE parish_private.cash_receipt_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parish_private.cash_receipt_ledger FROM PUBLIC;
CREATE OR REPLACE FUNCTION parish_private.prevent_cash_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Cash receipt ledger is append-only; create a reversal instead';
END; $$;
DROP TRIGGER IF EXISTS cash_receipt_append_only ON parish_private.cash_receipt_ledger;
CREATE TRIGGER cash_receipt_append_only
BEFORE UPDATE OR DELETE ON parish_private.cash_receipt_ledger
FOR EACH ROW EXECUTE FUNCTION parish_private.prevent_cash_receipt_mutation();
COMMIT;
