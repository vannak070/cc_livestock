-- 024: contracts and farm action plans (src/lib/action-plans.ts).
-- A contract is one per batch (default chosen 2026-10-14 until Management decides):
-- CamCow's buy-back terms for the batch's cattle. The buy-back due date stays the
-- batch's selling_target_date, so the sale review's "extend" keeps working.
CREATE TABLE IF NOT EXISTS batch_contracts (
    batch_id VARCHAR(50) PRIMARY KEY REFERENCES batches(id) ON DELETE CASCADE,
    contract_no VARCHAR(50) NOT NULL DEFAULT '',
    -- What CamCow pays the farm for each kg at buy-back, in riel.
    buyback_price_per_kg NUMERIC(12,2),
    delivered_on DATE,
    notes TEXT NOT NULL DEFAULT '',
    updated_by VARCHAR(255) NOT NULL DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One plan per farm per month: cattle to deliver, buy-backs due, and actions.
-- Super Admin/Admin write it and send it; Management approves it or sends it back.
CREATE TABLE IF NOT EXISTS farm_action_plans (
    id VARCHAR(50) PRIMARY KEY,
    farm_location VARCHAR(100) NOT NULL,
    period_month CHAR(7) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Returned')),
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255) NOT NULL DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_by VARCHAR(255),
    decided_at TIMESTAMP WITH TIME ZONE,
    decision_note TEXT,
    UNIQUE (farm_location, period_month)
);

-- Who did what to a plan, and when (never edited).
CREATE TABLE IF NOT EXISTS farm_action_plan_events (
    id SERIAL PRIMARY KEY,
    plan_id VARCHAR(50) NOT NULL REFERENCES farm_action_plans(id) ON DELETE CASCADE,
    at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    by_name VARCHAR(255) NOT NULL DEFAULT '',
    action VARCHAR(20) NOT NULL,
    note TEXT
);

CREATE INDEX IF NOT EXISTS idx_farm_action_plan_events_plan ON farm_action_plan_events(plan_id, at);
