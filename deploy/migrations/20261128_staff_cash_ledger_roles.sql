-- Smart Parish: reconcile active Church Staff with the legacy cash receipt ledger.
-- Apply only after a verified backup and only if 20261122_cash_receipts.sql
-- has already been applied. This keeps all historical receipt/reversal rows.
-- No payments are created, reversed, or marked Paid by this migration.
BEGIN;
DO $$
BEGIN
  IF to_regclass('parish_private.cash_receipt_ledger') IS NULL THEN
    RAISE EXCEPTION 'Missing cash_receipt_ledger. Apply the original cash receipts migration first.';
  END IF;
END $$;
ALTER TABLE parish_private.cash_receipt_ledger
  DROP CONSTRAINT IF EXISTS cash_receipt_ledger_actor_role_check;
-- Retain ADMIN solely for old audit rows: the Flask endpoint rejects ADMIN
-- for new operations. STAFF is the current authorized account role.
ALTER TABLE parish_private.cash_receipt_ledger
  ADD CONSTRAINT cash_receipt_ledger_actor_role_check
  CHECK (actor_role IN ('ADMIN', 'BURIAL_ADMIN', 'STAFF'));
COMMIT;

-- Read-only verification:
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'parish_private.cash_receipt_ledger'::regclass
-- AND conname = 'cash_receipt_ledger_actor_role_check';
