CREATE TABLE receipt_hunt_submissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL CHECK (wallet_address ~ '^0x[0-9a-f]{40}$'),
  x_username TEXT NOT NULL CHECK (x_username ~ '^[a-z0-9_]{1,15}$'),
  follow_proof TEXT NOT NULL CHECK (length(follow_proof) <= 1500000),
  engagement_proof TEXT NOT NULL CHECK (length(engagement_proof) <= 1500000),
  repost_url TEXT NOT NULL,
  follow_status TEXT NOT NULL DEFAULT 'pending' CHECK (follow_status IN ('pending', 'approved', 'rejected')),
  engagement_status TEXT NOT NULL DEFAULT 'pending' CHECK (engagement_status IN ('pending', 'approved', 'rejected')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  reviewer_wallet TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, wallet_address)
);

CREATE UNIQUE INDEX receipt_hunt_approved_x_account
  ON receipt_hunt_submissions (campaign_id, x_username)
  WHERE follow_status = 'approved' AND engagement_status = 'approved';
