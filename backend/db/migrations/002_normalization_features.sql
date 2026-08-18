ALTER TABLE receipt_items
  ADD COLUMN normalization_version TEXT NOT NULL DEFAULT 'catalog-v1',
  ADD COLUMN normalization_confidence NUMERIC(5,4) NOT NULL DEFAULT 0
    CHECK (normalization_confidence BETWEEN 0 AND 1);
