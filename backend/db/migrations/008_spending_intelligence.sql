ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS store_name TEXT,
  ADD COLUMN IF NOT EXISTS currency_code TEXT
    CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$'),
  ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12,2)
    CHECK (total_spent IS NULL OR total_spent >= 0),
  ADD COLUMN IF NOT EXISTS total_spent_source TEXT
    CHECK (total_spent_source IS NULL OR total_spent_source IN ('receipt_total', 'line_items'));

ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS spending_category TEXT NOT NULL DEFAULT 'other'
    CHECK (spending_category IN ('meat', 'snacks', 'dairy', 'drinks', 'produce', 'bakery', 'frozen', 'pantry', 'household', 'other'));

ALTER TABLE receipt_items
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,4) CHECK (unit_price IS NULL OR unit_price >= 0),
  ADD COLUMN IF NOT EXISTS price_unit TEXT CHECK (price_unit IS NULL OR price_unit IN ('each', 'kg', 'liter')),
  ADD COLUMN IF NOT EXISTS spending_category TEXT NOT NULL DEFAULT 'other'
    CHECK (spending_category IN ('meat', 'snacks', 'dairy', 'drinks', 'produce', 'bakery', 'frozen', 'pantry', 'household', 'other'));

UPDATE receipt_items
SET price_unit = CASE WHEN weight_grams > 0 THEN 'kg' ELSE 'each' END,
    unit_price = CASE
      WHEN weight_grams > 0 THEN ROUND(paid_price * 1000 / weight_grams, 4)
      ELSE ROUND(paid_price / GREATEST(quantity, 1), 4)
    END
WHERE paid_price IS NOT NULL AND unit_price IS NULL;

UPDATE receipt_items
SET spending_category = CASE
  WHEN item_name ~* '(deterg|deterjan|cleaner|soap|sabon|shampoo|sampuan|toilet paper|paper towel|shopping bag|poset|pe[cç]ete|hijyen|diaper|ampul|battery)' THEN 'household'
  WHEN item_name ~* '(frozen|donuk|dondurulmus|dondurulmuş)' THEN 'frozen'
  WHEN item_name ~* '(chicken|tavuk|beef|dana|meat|kuzu|lamb|fish|balik|balık|salmon|sucuk|salam|sosis|pastirma)' THEN 'meat'
  WHEN item_name ~* '(milk|s[uü]t|yogurt|yo[gğ]urt|cheese|peynir|butter|tereya[gğ]|cream|kaymak|egg|yumurta)' THEN 'dairy'
  WHEN item_name ~* '(snack|cips|chips|bisk[uü]vi|gofret|[cç]ikolata|chocolate|cookie|candy|cracker|[sş]ekerleme)' THEN 'snacks'
  WHEN item_name ~* '(drink|beverage|i[cç]ecek|water|(^|[^a-z])su([^a-z]|$)|cola|soda|juice|meyve suyu|tea|[cç]ay|coffee|kahve|limonata)' THEN 'drinks'
  WHEN item_name ~* '(fruit|vegetable|meyve|sebze|elma|apple|muz|banana|domates|tomato|patates|potato|salatal[iı]k|carrot|broccoli)' THEN 'produce'
  WHEN item_name ~* '(bread|ekmek|bakery|croissant|po[gğ]a[cç]a|simit|b[oö]rek)' THEN 'bakery'
  WHEN item_name ~* '(rice|pirin[cç]|pasta|makarna|flour|un|oil|ya[gğ]|beans|fasulye|lentil|mercimek|canned|konserve)' THEN 'pantry'
  WHEN EXISTS (SELECT 1 FROM classifications c WHERE c.receipt_item_id = receipt_items.id AND c.category = 'excluded') THEN 'household'
  ELSE 'other'
END
WHERE spending_category = 'other';

UPDATE canonical_products cp
SET spending_category = ranked.spending_category
FROM (
  SELECT canonical_product_id, mode() WITHIN GROUP (ORDER BY spending_category) AS spending_category
  FROM receipt_items
  WHERE canonical_product_id IS NOT NULL
  GROUP BY canonical_product_id
) ranked
WHERE cp.id = ranked.canonical_product_id;

UPDATE receipts r
SET total_spent = totals.total_spent, total_spent_source = 'line_items'
FROM (
  SELECT receipt_id, SUM(paid_price) AS total_spent
  FROM receipt_items
  WHERE paid_price IS NOT NULL
  GROUP BY receipt_id
) totals
WHERE r.id = totals.receipt_id AND r.total_spent IS NULL;

CREATE INDEX IF NOT EXISTS receipt_items_product_price
  ON receipt_items (canonical_product_id, paid_price) WHERE paid_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS receipt_items_product_unit_price
  ON receipt_items (canonical_product_id, price_unit) WHERE unit_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS receipts_currency_store_date
  ON receipts (currency_code, store_name, receipt_date DESC);

CREATE TABLE IF NOT EXISTS receipt_analysis_staging (
  receipt_hash TEXT NOT NULL CHECK (receipt_hash ~* '^0x[0-9a-f]{64}$'),
  user_wallet TEXT NOT NULL CHECK (user_wallet ~* '^0x[0-9a-f]{40}$'),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  PRIMARY KEY (receipt_hash, user_wallet)
);

CREATE INDEX IF NOT EXISTS receipt_analysis_staging_expiry ON receipt_analysis_staging (expires_at);
