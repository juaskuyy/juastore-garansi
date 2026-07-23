CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  product TEXT NOT NULL,
  account TEXT DEFAULT '',
  order_id TEXT DEFAULT '',
  order_date TEXT DEFAULT '',
  duration TEXT DEFAULT '',
  claim_type TEXT NOT NULL DEFAULT 'Garansi',
  problem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Menunggu',
  admin_note TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_whatsapp ON claims(whatsapp);
CREATE INDEX IF NOT EXISTS idx_claims_created_at ON claims(created_at);
