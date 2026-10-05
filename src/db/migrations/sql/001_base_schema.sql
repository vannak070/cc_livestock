-- 001: core tables. Idempotent (IF NOT EXISTS), so it is safe both on an empty
-- database and on a production database that already has these tables.

CREATE TABLE IF NOT EXISTS master_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'Active',
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS farm_location VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);

CREATE TABLE IF NOT EXISTS stock (
    id VARCHAR(50) PRIMARY KEY, -- Cow_ID
    no VARCHAR(20) NOT NULL,
    breed VARCHAR(50),
    sex VARCHAR(20),
    age VARCHAR(50),
    weight NUMERIC(10, 2) DEFAULT 0,
    owner_name VARCHAR(100),
    location VARCHAR(100),
    phone VARCHAR(50),
    buy_type VARCHAR(50),
    unit_price NUMERIC(12, 2) DEFAULT 0,
    total_price NUMERIC(12, 2) DEFAULT 0,
    health_status VARCHAR(50) DEFAULT 'Good',
    status VARCHAR(50) DEFAULT 'Active',
    purchase_date TIMESTAMP WITH TIME ZONE,
    remark TEXT,
    purchase_type VARCHAR(50),
    payment_method VARCHAR(50),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weight_tracking (
    id SERIAL PRIMARY KEY,
    cow_id VARCHAR(50) NOT NULL REFERENCES stock(id) ON DELETE CASCADE,
    breed VARCHAR(50),
    age VARCHAR(50),
    old_weight NUMERIC(10, 2) DEFAULT 0,
    current_weight NUMERIC(10, 2) DEFAULT 0,
    gain_loss NUMERIC(10, 4) DEFAULT 0,
    health_status VARCHAR(50),
    status VARCHAR(50),
    tracking_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_tracking (
    id SERIAL PRIMARY KEY,
    cow_id VARCHAR(50) NOT NULL REFERENCES stock(id) ON DELETE CASCADE,
    breed VARCHAR(50),
    age VARCHAR(50),
    weight NUMERIC(10, 2) DEFAULT 0,
    unit_price NUMERIC(12, 2) DEFAULT 0,
    total_price NUMERIC(12, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Sold',
    sales_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sale_type VARCHAR(50),
    buyer VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS batches (
    id VARCHAR(50) PRIMARY KEY, -- Batch code (e.g. BATCH-001)
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'Active',
    notes TEXT,
    farm_location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS feeding_program JSONB;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS expected_selling_price NUMERIC;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS selling_target_date DATE;

CREATE TABLE IF NOT EXISTS batch_cows (
    batch_id VARCHAR(50) NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    cow_id VARCHAR(50) NOT NULL REFERENCES stock(id) ON DELETE CASCADE,
    PRIMARY KEY (batch_id, cow_id)
);

CREATE TABLE IF NOT EXISTS health_logs (
    id VARCHAR(50) PRIMARY KEY, -- HL-xxxx
    cow_id VARCHAR(50) NOT NULL REFERENCES stock(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- Vaccination | Treatment | Disease | Deworming
    name VARCHAR(100) NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    administered_by VARCHAR(100),
    cost NUMERIC(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Legacy: the expense feature was removed from the app, the table and its data
-- are kept on purpose so history is not lost.
CREATE TABLE IF NOT EXISTS expenses (
    id VARCHAR(50) PRIMARY KEY, -- EXP-xxxx
    category VARCHAR(50) NOT NULL,
    amount NUMERIC(12, 2) DEFAULT 0,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    farm_location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_status ON stock(status);
CREATE INDEX IF NOT EXISTS idx_stock_health ON stock(health_status);
CREATE INDEX IF NOT EXISTS idx_weight_cow_id ON weight_tracking(cow_id);
CREATE INDEX IF NOT EXISTS idx_weight_tracking_date ON weight_tracking(tracking_date);
CREATE INDEX IF NOT EXISTS idx_sales_cow_id ON sales_tracking(cow_id);
CREATE INDEX IF NOT EXISTS idx_health_cow_id ON health_logs(cow_id);
CREATE INDEX IF NOT EXISTS idx_batch_cows_cow_id ON batch_cows(cow_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
