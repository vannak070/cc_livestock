-- 015: the next action recorded for cattle that have stayed on a farm a long
-- time without being sold (see src/lib/long-stay.ts). One row per recorded
-- action; the newest one that is not done is the animal's "next action", older
-- rows are its history.
CREATE TABLE IF NOT EXISTS cattle_follow_ups (
    id VARCHAR(50) PRIMARY KEY,
    cow_id VARCHAR(50) NOT NULL REFERENCES stock(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL, -- sell | keep | treat | weigh | other
    note TEXT NOT NULL DEFAULT '',
    due_date DATE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    done_at TIMESTAMP WITH TIME ZONE,
    done_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_cattle_follow_ups_cow ON cattle_follow_ups(cow_id);
