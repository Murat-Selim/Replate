ALTER TABLE x402_payments
  ADD COLUMN IF NOT EXISTS source_commitment TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB;

CREATE INDEX IF NOT EXISTS x402_payments_source_commitment
  ON x402_payments (source_commitment)
  WHERE source_commitment IS NOT NULL;
