-- 026: action plans cover a 3-day period instead of a month (user, 2026-10-15:
-- "the plan period should be specific by 3 days"). Periods are fixed blocks of the
-- calendar month: 1-3, 4-6, ... 28-30, and a short last block (31, or 28-29 in a
-- February). One plan per farm per period, enforced by a unique index.
-- A plan saved under the old monthly rule becomes the plan of the month's first period.
ALTER TABLE farm_action_plans ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE farm_action_plans ADD COLUMN IF NOT EXISTS period_end DATE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'farm_action_plans' AND column_name = 'period_month') THEN
        UPDATE farm_action_plans
           SET period_start = (period_month || '-01')::date,
               period_end = (period_month || '-01')::date + 2
         WHERE period_start IS NULL;
    END IF;
END $$;

ALTER TABLE farm_action_plans ALTER COLUMN period_start SET NOT NULL;
ALTER TABLE farm_action_plans ALTER COLUMN period_end SET NOT NULL;

-- The old (farm, month) unique constraint goes with the column.
ALTER TABLE farm_action_plans DROP COLUMN IF EXISTS period_month;

CREATE UNIQUE INDEX IF NOT EXISTS ux_farm_action_plans_farm_period ON farm_action_plans (farm_location, period_start);

ALTER TABLE farm_action_plans DROP CONSTRAINT IF EXISTS chk_farm_action_plans_period;
ALTER TABLE farm_action_plans ADD CONSTRAINT chk_farm_action_plans_period CHECK (period_end >= period_start AND period_end - period_start <= 2);
