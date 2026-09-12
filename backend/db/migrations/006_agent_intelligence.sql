ALTER TABLE receipt_items
  ADD COLUMN IF NOT EXISTS paid_price NUMERIC(12,2)
    CHECK (paid_price IS NULL OR paid_price >= 0);

ALTER TABLE x402_payments
  ADD COLUMN IF NOT EXISTS payer_address TEXT,
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_id TEXT,
  ADD COLUMN IF NOT EXISTS endpoint TEXT;

UPDATE x402_payments
SET payer_address = COALESCE(payer_address, payer_wallet),
    resource_type = COALESCE(resource_type, 'advanced_receipt'),
    resource_id = COALESCE(resource_id, receipt_id::TEXT),
    endpoint = COALESCE(endpoint, 'POST /api/intelligence/advanced');

ALTER TABLE x402_payments
  ALTER COLUMN payer_address SET NOT NULL,
  ALTER COLUMN resource_type SET NOT NULL,
  ALTER COLUMN resource_id SET NOT NULL,
  ALTER COLUMN endpoint SET NOT NULL,
  ALTER COLUMN receipt_id DROP NOT NULL,
  ALTER COLUMN receipt_hash DROP NOT NULL;

CREATE INDEX IF NOT EXISTS x402_payments_resource
  ON x402_payments (resource_type, resource_id, created_at DESC);

CREATE TABLE IF NOT EXISTS signals (
  id BIGSERIAL PRIMARY KEY,
  signal_type TEXT NOT NULL,
  canonical_product_id BIGINT NULL REFERENCES canonical_products(id) ON DELETE CASCADE,
  category TEXT NULL,
  merchant_id BIGINT NULL,
  score NUMERIC NULL,
  value NUMERIC NULL,
  confidence NUMERIC NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  sample_size INTEGER NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
  period_start TIMESTAMPTZ NULL,
  period_end TIMESTAMPTZ NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS signal_version TEXT NOT NULL DEFAULT 'signals-v1',
  ADD COLUMN IF NOT EXISTS calculation_version TEXT NOT NULL DEFAULT 'signals-v1';

CREATE INDEX IF NOT EXISTS signals_product_type_time
  ON signals (canonical_product_id, signal_type, generated_at DESC);

CREATE INDEX IF NOT EXISTS signals_category_type_time
  ON signals (LOWER(category), signal_type, generated_at DESC);

CREATE TABLE IF NOT EXISTS signal_access_logs (
  id BIGSERIAL PRIMARY KEY,
  signal_id BIGINT NULL REFERENCES signals(id) ON DELETE SET NULL,
  x402_payment_id BIGINT NULL REFERENCES x402_payments(id) ON DELETE SET NULL,
  agent_address TEXT NOT NULL CHECK (agent_address ~* '^0x[0-9a-f]{40}$'),
  resource_type TEXT NOT NULL,
  resource_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS signal_access_logs_created_at
  ON signal_access_logs (created_at DESC);
