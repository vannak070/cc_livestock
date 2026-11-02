-- 033: indexes for loading the cattle list as the herd grows.
-- Measured 2026-10-27 on a scratch copy ~40x today's size (38k cattle, 240k weigh-ins, 52k health records):
--   cattle of one farm (every farm-bound user's page load)  11.6 ms -> 1.4 ms
--   health of one farm (filters through the cattle table)   19.9 ms -> 10.4 ms
--   all cattle in order (office users)                       7.9 ms -> 3.7 ms
-- Indexes on weights/health by (cow_id, date) were tried too and gave no gain (the existing cow_id indexes already
-- serve one animal), so they are left out: every extra index slows down each save.

-- The farm filter of src/lib/farm-scope.ts (farmMatchSql) compares LOWER(BTRIM(location, E' \t\r\n')); the index must
-- use exactly the same expression to be used. Keep the two in step.
CREATE INDEX IF NOT EXISTS ix_stock_location_norm ON stock (LOWER(BTRIM(location, E' \t\r\n')));

-- stockRepository.findAll orders by created_at.
CREATE INDEX IF NOT EXISTS ix_stock_created_at ON stock (created_at);
