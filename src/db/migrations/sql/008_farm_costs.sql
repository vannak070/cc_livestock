-- 008: farm running costs (wages, power and water, fuel, repairs, interest,
-- rent, other), the costs not already recorded elsewhere. Cattle, medicine
-- and feed keep their own records. This is a new table: the legacy
-- `expenses` table (001) is left untouched and is not read by the app.
CREATE TABLE IF NOT EXISTS farm_costs (
    id VARCHAR(50) PRIMARY KEY,           -- COST-xxxx
    farm_location VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,                   -- the farm's calendar day the cost was paid
    note TEXT,
    recorded_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_farm_costs_farm ON farm_costs(farm_location);
CREATE INDEX IF NOT EXISTS idx_farm_costs_date ON farm_costs(date);

-- New permissions. People store their own access, so the keys are added to
-- the people (and stored role definitions) who should have them:
--   costs_view   - anyone who sees sales, and farm owners and staff
--   costs_record - anyone who records sales, and farm owners and staff
--   costs_delete - anyone who can void sales, and farm owners
-- Admins always have full access and need no change. Management (read-only)
-- has sales_view only, so it gets costs_view only.
UPDATE users
SET permissions = permissions || '["costs_view"]'::jsonb
WHERE jsonb_typeof(permissions) = 'array'
  AND jsonb_array_length(permissions) > 0
  AND NOT permissions ? 'costs_view'
  AND (permissions ? 'sales_view' OR role IN ('Farm Owner', 'Farm Staff'));

UPDATE users
SET permissions = permissions || '["costs_record"]'::jsonb
WHERE jsonb_typeof(permissions) = 'array'
  AND jsonb_array_length(permissions) > 0
  AND NOT permissions ? 'costs_record'
  AND (permissions ? 'sales_record' OR role IN ('Farm Owner', 'Farm Staff'));

UPDATE users
SET permissions = permissions || '["costs_delete"]'::jsonb
WHERE jsonb_typeof(permissions) = 'array'
  AND jsonb_array_length(permissions) > 0
  AND NOT permissions ? 'costs_delete'
  AND (permissions ? 'sales_delete' OR role = 'Farm Owner');

UPDATE master_settings ms
SET data = jsonb_set(ms.data, '{roles}', (
  SELECT jsonb_agg(
    CASE WHEN jsonb_typeof(r->'permissions') = 'array'
         THEN jsonb_set(r, '{permissions}', (r->'permissions')
           || CASE WHEN NOT (r->'permissions') ? 'costs_view'
                     AND ((r->'permissions') ? 'sales_view' OR r->>'name' IN ('Farm Owner', 'Farm Staff'))
                   THEN '["costs_view"]'::jsonb ELSE '[]'::jsonb END
           || CASE WHEN NOT (r->'permissions') ? 'costs_record'
                     AND ((r->'permissions') ? 'sales_record' OR r->>'name' IN ('Farm Owner', 'Farm Staff'))
                   THEN '["costs_record"]'::jsonb ELSE '[]'::jsonb END
           || CASE WHEN NOT (r->'permissions') ? 'costs_delete'
                     AND ((r->'permissions') ? 'sales_delete' OR r->>'name' = 'Farm Owner')
                   THEN '["costs_delete"]'::jsonb ELSE '[]'::jsonb END)
         ELSE r END
    ORDER BY ord)
  FROM jsonb_array_elements(ms.data->'roles') WITH ORDINALITY AS x(r, ord)
))
WHERE ms.key = 'master_setup'
  AND jsonb_typeof(ms.data->'roles') = 'array'
  AND jsonb_array_length(ms.data->'roles') > 0;
