-- 029: cattle CC Livestock holds after it collects them from a farm (src/lib/camcow-stock.ts).
-- A collection is a sale of a farm's cattle to CC Livestock (src/lib/buyback.ts). Once "received", the animal is stock held by
-- CC Livestock (at its stock site) until CC Livestock sells it on to a buyer, or it is lost. The animal's own stock record is NOT
-- moved: it keeps its farm, so the farm's collection evidence and money statement keep working. One row per animal.
CREATE TABLE IF NOT EXISTS camcow_holdings (
    cow_id VARCHAR(50) PRIMARY KEY REFERENCES stock(id) ON DELETE CASCADE,
    source_farm VARCHAR(100) NOT NULL,
    batch_id VARCHAR(50),
    collected_on DATE NOT NULL,
    -- What the farm sold it to CC Livestock for (the collection).
    collection_weight NUMERIC(10,2) NOT NULL DEFAULT 0,
    collection_total NUMERIC(16,0) NOT NULL DEFAULT 0,
    status VARCHAR(10) NOT NULL DEFAULT 'Held' CHECK (status IN ('Held', 'Sold', 'Lost')),
    -- When it is sold on to a buyer.
    sold_on DATE,
    buyer VARCHAR(100),
    sale_weight NUMERIC(10,2),
    sale_price_per_kg NUMERIC(12,2),
    sale_total NUMERIC(16,0),
    -- When it is lost (died, ...).
    lost_on DATE,
    note TEXT NOT NULL DEFAULT '',
    received_by VARCHAR(255) NOT NULL DEFAULT '',
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255) NOT NULL DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_camcow_holdings_status ON camcow_holdings (status, collected_on);
CREATE INDEX IF NOT EXISTS ix_camcow_holdings_farm ON camcow_holdings (lower(source_farm));
