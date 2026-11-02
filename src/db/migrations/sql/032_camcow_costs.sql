-- 032: what it costs to keep cattle at CamCow's stock site (feed, medicine, labour, transport, other).
-- Each cost is shared evenly between the animals in stock on its date (src/lib/camcow-costs.ts), so every animal's margin can be
-- shown after costs. Costs are never tied to one animal, so nothing here depends on the stock table.
CREATE TABLE IF NOT EXISTS camcow_costs (
    id VARCHAR(50) PRIMARY KEY,
    cost_date DATE NOT NULL,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('feed', 'medicine', 'labour', 'transport', 'other')),
    amount NUMERIC(16,0) NOT NULL CHECK (amount > 0),
    note TEXT NOT NULL DEFAULT '',
    recorded_by VARCHAR(255) NOT NULL DEFAULT '',
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_camcow_costs_date ON camcow_costs (cost_date);
