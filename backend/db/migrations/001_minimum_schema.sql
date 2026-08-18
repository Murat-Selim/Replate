CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_wallet_address_format CHECK (wallet_address ~* '^0x[0-9a-f]{40}$')
);

CREATE UNIQUE INDEX users_wallet_address_unique ON users (LOWER(wallet_address));

CREATE TABLE receipts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  receipt_hash TEXT NOT NULL UNIQUE,
  tx_hash TEXT NOT NULL UNIQUE,
  block_number BIGINT NOT NULL,
  receipt_date DATE NOT NULL,
  health_score SMALLINT NOT NULL,
  nutrition_score SMALLINT NOT NULL,
  total_items SMALLINT NOT NULL,
  detected_items SMALLINT NOT NULL,
  excluded_items SMALLINT NOT NULL,
  healthy_items SMALLINT NOT NULL,
  unhealthy_items SMALLINT NOT NULL,
  fruit_veg_grams INTEGER NOT NULL,
  household_size SMALLINT NOT NULL,
  days_covered SMALLINT NOT NULL,
  points_earned INTEGER NOT NULL,
  ocr_confidence NUMERIC(5,4) NOT NULL,
  receipt_verification_confidence NUMERIC(5,4) NOT NULL DEFAULT 1,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT receipts_hash_format CHECK (receipt_hash ~* '^0x[0-9a-f]{64}$'),
  CONSTRAINT receipts_tx_hash_format CHECK (tx_hash ~* '^0x[0-9a-f]{64}$'),
  CONSTRAINT receipts_scores_range CHECK (health_score BETWEEN 0 AND 100 AND nutrition_score BETWEEN 0 AND 100),
  CONSTRAINT receipts_confidence_range CHECK (
    ocr_confidence BETWEEN 0 AND 1 AND receipt_verification_confidence BETWEEN 0 AND 1
  ),
  CONSTRAINT receipts_counts_non_negative CHECK (
    total_items >= 0 AND detected_items >= 0 AND excluded_items >= 0 AND
    healthy_items >= 0 AND unhealthy_items >= 0 AND fruit_veg_grams >= 0 AND points_earned >= 0
  ),
  CONSTRAINT receipts_household_range CHECK (household_size BETWEEN 1 AND 10),
  CONSTRAINT receipts_days_range CHECK (days_covered BETWEEN 1 AND 30),
  CONSTRAINT receipts_id_hash_unique UNIQUE (id, receipt_hash)
);

CREATE INDEX receipts_user_verified_at ON receipts (user_id, verified_at DESC);

CREATE TABLE canonical_products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  canonical_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('healthy', 'unhealthy', 'neutral')),
  default_fruit_veg_grams INTEGER NOT NULL DEFAULT 0 CHECK (default_fruit_veg_grams >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE receipt_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_id BIGINT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  canonical_product_id BIGINT REFERENCES canonical_products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  weight_grams INTEGER NOT NULL DEFAULT 0 CHECK (weight_grams >= 0),
  fruit_veg_grams INTEGER NOT NULL DEFAULT 0 CHECK (fruit_veg_grams >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX receipt_items_receipt_id ON receipt_items (receipt_id);

CREATE TABLE model_versions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model_type TEXT NOT NULL,
  version TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (model_type, version)
);

CREATE TABLE classifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_item_id BIGINT NOT NULL REFERENCES receipt_items(id) ON DELETE CASCADE,
  model_version_id BIGINT NOT NULL REFERENCES model_versions(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN ('healthy', 'unhealthy', 'neutral', 'excluded')),
  confidence NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  nutriscore TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (receipt_item_id, model_version_id)
);

CREATE TABLE derived_features (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_id BIGINT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  feature_value NUMERIC NOT NULL,
  calculation_version TEXT NOT NULL,
  confidence NUMERIC(5,4) CHECK (confidence BETWEEN 0 AND 1),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (receipt_id, feature_name, calculation_version)
);

CREATE TABLE x402_payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_id BIGINT NOT NULL REFERENCES receipts(id) ON DELETE RESTRICT,
  receipt_hash TEXT NOT NULL REFERENCES receipts(receipt_hash) ON DELETE RESTRICT,
  user_wallet TEXT NOT NULL,
  payer_wallet TEXT NOT NULL,
  amount NUMERIC(78,0) NOT NULL CHECK (amount > 0),
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('required', 'submitted', 'settled', 'failed')),
  transaction_hash TEXT UNIQUE,
  payment_identifier TEXT NOT NULL UNIQUE,
  builder_code_attributed BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  CONSTRAINT x402_user_wallet_format CHECK (user_wallet ~* '^0x[0-9a-f]{40}$'),
  CONSTRAINT x402_payer_wallet_format CHECK (payer_wallet ~* '^0x[0-9a-f]{40}$'),
  CONSTRAINT x402_receipt_hash_format CHECK (receipt_hash ~* '^0x[0-9a-f]{64}$'),
  CONSTRAINT x402_tx_hash_format CHECK (transaction_hash IS NULL OR transaction_hash ~* '^0x[0-9a-f]{64}$'),
  CONSTRAINT x402_receipt_match FOREIGN KEY (receipt_id, receipt_hash)
    REFERENCES receipts(id, receipt_hash) ON DELETE RESTRICT,
  CONSTRAINT x402_id_receipt_unique UNIQUE (id, receipt_id)
);

CREATE INDEX x402_payments_receipt_id ON x402_payments (receipt_id);

CREATE TABLE intelligence_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_id BIGINT NOT NULL REFERENCES receipts(id) ON DELETE RESTRICT,
  payment_id BIGINT NOT NULL,
  user_wallet TEXT NOT NULL,
  report_type TEXT NOT NULL,
  report_status TEXT NOT NULL CHECK (report_status IN ('pending', 'processing', 'completed', 'failed')),
  report_payload JSONB,
  rule_version TEXT NOT NULL,
  insight_confidence NUMERIC(5,4) CHECK (insight_confidence BETWEEN 0 AND 1),
  error_code TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT intelligence_user_wallet_format CHECK (user_wallet ~* '^0x[0-9a-f]{40}$'),
  CONSTRAINT intelligence_payment_unique UNIQUE (payment_id),
  CONSTRAINT intelligence_payment_receipt_match FOREIGN KEY (payment_id, receipt_id)
    REFERENCES x402_payments(id, receipt_id) ON DELETE RESTRICT
);

CREATE INDEX intelligence_reports_user_created_at ON intelligence_reports (LOWER(user_wallet), created_at DESC);
