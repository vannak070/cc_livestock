-- 030: buyers CC Livestock sells its stock on to, and the payments they make (src/lib/camcow-buyers.ts).
-- A buyer's balance = what was sold to them (camcow_holdings.sale_total) less their payments. Which sale a payment settles is worked
-- out oldest first, so there is no per-animal "paid" flag to keep in step.
CREATE TABLE IF NOT EXISTS camcow_buyers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    kind VARCHAR(20) NOT NULL DEFAULT 'trader' CHECK (kind IN ('slaughterhouse', 'trader', 'farm', 'other')),
    phone VARCHAR(50) NOT NULL DEFAULT '',
    location VARCHAR(150) NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_camcow_buyers_name ON camcow_buyers (lower(name));

CREATE TABLE IF NOT EXISTS camcow_payments (
    id VARCHAR(50) PRIMARY KEY,
    buyer_id VARCHAR(50) NOT NULL REFERENCES camcow_buyers(id) ON DELETE CASCADE,
    paid_on DATE NOT NULL,
    amount NUMERIC(16,0) NOT NULL CHECK (amount > 0),
    note TEXT NOT NULL DEFAULT '',
    recorded_by VARCHAR(255) NOT NULL DEFAULT '',
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_camcow_payments_buyer ON camcow_payments (buyer_id, paid_on);

ALTER TABLE camcow_holdings ADD COLUMN IF NOT EXISTS buyer_id VARCHAR(50) REFERENCES camcow_buyers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_camcow_holdings_buyer ON camcow_holdings (buyer_id);

-- Sales recorded before this list existed: one buyer per distinct name (case-insensitive), linked to its sales.
INSERT INTO camcow_buyers (id, name, created_by)
SELECT 'BUY-' || substr(md5(lower(btrim(buyer))), 1, 10), min(btrim(buyer)), 'migration 030'
  FROM camcow_holdings WHERE buyer IS NOT NULL AND btrim(buyer) <> ''
 GROUP BY lower(btrim(buyer))
ON CONFLICT DO NOTHING;
UPDATE camcow_holdings h SET buyer_id = b.id FROM camcow_buyers b WHERE h.buyer_id IS NULL AND h.buyer IS NOT NULL AND lower(btrim(h.buyer)) = lower(b.name);
