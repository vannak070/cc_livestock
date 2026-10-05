-- 012: each farm's bank loan for buying cattle (the three-party agreement:
-- the bank lends to the farm, CC Livestock buys the cattle back in month 12
-- and pays the bank first). One loan per farm; it renews each year. The terms
-- and the plan's assumptions are kept as JSON and checked by the app
-- (src/lib/farm-loan.ts) before they are saved.
CREATE TABLE IF NOT EXISTS farm_loans (
    farm_location VARCHAR(100) PRIMARY KEY,
    terms JSONB NOT NULL,
    assumptions JSONB NOT NULL,
    notes TEXT,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
