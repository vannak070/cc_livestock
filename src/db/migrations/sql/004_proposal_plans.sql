-- 004: up to ten named planning scenarios (Plan 1 .. Plan 10). Replaces the
-- single shared "current plan" row; the old table is left in place untouched.
CREATE TABLE IF NOT EXISTS proposal_plans (
    slot SMALLINT PRIMARY KEY CHECK (slot BETWEEN 1 AND 10),
    name VARCHAR(60) NOT NULL,
    params JSONB NOT NULL,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- The plan that was saved before becomes Plan 1.
INSERT INTO proposal_plans (slot, name, params, updated_at)
SELECT 1, 'Plan 1', params, updated_at FROM proposal_plan WHERE id = 'current'
ON CONFLICT (slot) DO NOTHING;
