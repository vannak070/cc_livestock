-- 002: feed inventory and the shared proposal plan. These tables used to be
-- created lazily by the repositories; they now live here.

CREATE TABLE IF NOT EXISTS feed_products (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(50) DEFAULT 'bag',
    weight_per_unit NUMERIC(10, 2) DEFAULT 30,
    unit_cost NUMERIC(15, 4) DEFAULT 0,
    cost_type VARCHAR(20) DEFAULT 'per_bag',
    cost_per_bag NUMERIC(15, 2) DEFAULT 0,
    min_threshold_bags NUMERIC(10, 2) DEFAULT 50,
    min_threshold_kg NUMERIC(10, 2) DEFAULT 1500,
    description TEXT,
    supplier VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE feed_products ADD COLUMN IF NOT EXISTS cost_type VARCHAR(20) DEFAULT 'per_bag';
ALTER TABLE feed_products ADD COLUMN IF NOT EXISTS cost_per_bag NUMERIC(15, 2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS feed_transactions (
    id VARCHAR(100) PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- STOCK_IN | STOCK_OUT | TRANSFER
    quantity_bags NUMERIC(12, 2) DEFAULT 0,
    quantity_kg NUMERIC(12, 2) DEFAULT 0,
    unit_cost NUMERIC(15, 4) DEFAULT 0,
    total_cost NUMERIC(15, 2) DEFAULT 0,
    source_farm VARCHAR(255),
    target_farm VARCHAR(255),
    reference_no VARCHAR(100),
    recorded_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Single shared "current plan" row (id = 'current').
CREATE TABLE IF NOT EXISTS proposal_plan (
    id VARCHAR(20) PRIMARY KEY,
    params JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
