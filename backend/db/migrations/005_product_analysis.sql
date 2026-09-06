CREATE TABLE IF NOT EXISTS product_analysis (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL UNIQUE REFERENCES canonical_products(id) ON DELETE CASCADE,
  health_score SMALLINT NOT NULL CHECK (health_score BETWEEN 0 AND 100),
  sugar_level TEXT NOT NULL,
  salt_level TEXT NOT NULL,
  fiber_level TEXT NOT NULL,
  processing_level TEXT NOT NULL,
  positive_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  warning_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  rule_version TEXT NOT NULL,
  analysis_confidence NUMERIC(5,4) NOT NULL CHECK (analysis_confidence BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
