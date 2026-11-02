-- 027: farm programs and operations tasks (src/lib/ops-program.ts).
-- A farm program links one farm to one Planning plan (Plan 1..10) and a start date.
-- From the plan's numbers the system makes TASKS for operations: sell cattle to the
-- farm, buy them back (the replacement is sold the same day), and DSR-16 feed
-- deliveries. Operations work the tasks, Management watches their status.
-- Super Admin/Admin write; Management reads. There is no approval step.
CREATE TABLE IF NOT EXISTS farm_programs (
    id VARCHAR(50) PRIMARY KEY,
    farm_location VARCHAR(100) NOT NULL,
    plan_slot SMALLINT NOT NULL,
    plan_name VARCHAR(60) NOT NULL DEFAULT '',
    -- The plan's numbers as they were when the program was made or last refreshed, so
    -- editing the Planning screen never changes running tasks by itself.
    plan_params JSONB NOT NULL,
    start_date DATE NOT NULL,
    -- Cattle sold to the farm in each monthly cycle (the plan's batch, scaled to this farm).
    head_per_cycle INTEGER NOT NULL CHECK (head_per_cycle BETWEEN 1 AND 10000),
    -- Optional price overrides in riel per kg; NULL = the plan's price.
    purchase_price_per_kg NUMERIC(12,2) CHECK (purchase_price_per_kg IS NULL OR purchase_price_per_kg > 0),
    buyback_price_per_kg NUMERIC(12,2) CHECK (buyback_price_per_kg IS NULL OR buyback_price_per_kg > 0),
    status VARCHAR(10) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Paused', 'Closed')),
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255) NOT NULL DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One open (not closed) program per farm.
CREATE UNIQUE INDEX IF NOT EXISTS ux_farm_programs_open_farm ON farm_programs (lower(farm_location)) WHERE status <> 'Closed';

CREATE TABLE IF NOT EXISTS ops_tasks (
    id VARCHAR(60) PRIMARY KEY,
    program_id VARCHAR(50) NOT NULL REFERENCES farm_programs(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('sell_to_farm', 'buy_back', 'feed_delivery')),
    -- Which cycle: 'c0', 'c1', ... for planned cycles, 'b:<batch id>' for a batch already on the farm
    -- (its buy-back), 'r:<batch id>' for the replacement sold the same day.
    cycle_key VARCHAR(80) NOT NULL,
    -- The feed product for a feed delivery (e.g. DSR-16); empty otherwise.
    product VARCHAR(60) NOT NULL DEFAULT '',
    batch_id VARCHAR(50),
    due_date DATE NOT NULL,
    original_due_date DATE NOT NULL,
    planned_head INTEGER,
    planned_kg NUMERIC(14,1),
    price_per_kg NUMERIC(12,2),
    planned_value NUMERIC(16,0),
    -- What operations set by hand; the status shown also comes from the dates and the real records.
    manual_state VARCHAR(20) CHECK (manual_state IN ('in_progress', 'postponed', 'cancelled', 'done_by_hand')),
    reason TEXT NOT NULL DEFAULT '',
    owner VARCHAR(100) NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    done_on DATE,
    done_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255) NOT NULL DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A task is made once: the same program, kind, cycle and product never twice.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ops_tasks_key ON ops_tasks (program_id, kind, cycle_key, product);
CREATE INDEX IF NOT EXISTS ix_ops_tasks_due ON ops_tasks (due_date);

CREATE TABLE IF NOT EXISTS ops_task_events (
    id BIGSERIAL PRIMARY KEY,
    task_id VARCHAR(60) NOT NULL REFERENCES ops_tasks(id) ON DELETE CASCADE,
    at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    by VARCHAR(255) NOT NULL DEFAULT '',
    action VARCHAR(30) NOT NULL,
    note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_ops_task_events_task ON ops_task_events (task_id, at);
