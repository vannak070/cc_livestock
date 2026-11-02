-- 034: one row per supplier receipt registered through Cattle -> Upload, so the same receipt cannot be registered (and
-- billed) twice, and the original file is kept. User choices 2026-10-28: a receipt NUMBER already registered from the same
-- seller is BLOCKED; a receipt WITHOUT a number that matches an earlier one (seller, date, head, total) needs a tick
-- "This is a different receipt"; the original PDF/photo/Excel (<= 6 MB) is kept here.
-- A receipt counts as registered while any of its cattle still has a live registration (cattle_registrations.removed_at
-- IS NULL): when an admin removes all of them (registered by mistake), the same receipt can be uploaded again.
CREATE TABLE IF NOT EXISTS receipt_imports (
    id VARCHAR(50) PRIMARY KEY,
    invoice_no VARCHAR(100) NOT NULL DEFAULT '',
    -- lower(trimmed number) || '|' || lower(trimmed seller); '' when the receipt has no number (src/lib/receipt-import.ts).
    invoice_key VARCHAR(400) NOT NULL DEFAULT '',
    seller VARCHAR(255) NOT NULL DEFAULT '',
    receipt_date DATE NOT NULL,
    farm_location VARCHAR(100) NOT NULL,
    head INTEGER NOT NULL CHECK (head > 0),
    total_kg NUMERIC(12,1) NOT NULL DEFAULT 0,
    total_amount NUMERIC(16,0) NOT NULL DEFAULT 0,
    cow_ids TEXT[] NOT NULL,
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    file_data BYTEA,
    imported_by VARCHAR(255) NOT NULL DEFAULT '',
    imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_receipt_imports_key ON receipt_imports (invoice_key) WHERE invoice_key <> '';
CREATE INDEX IF NOT EXISTS ix_receipt_imports_seller_date ON receipt_imports (LOWER(seller), receipt_date);
CREATE INDEX IF NOT EXISTS ix_receipt_imports_cows ON receipt_imports USING GIN (cow_ids);
