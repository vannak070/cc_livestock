-- 017: which cattle-limit warnings (80%, 90%, 100%) have been sent to Telegram,
-- so a restart or a second server never sends the same warning twice. One row
-- per farm, limit size and step: raising a farm's limit starts its warnings over.
-- A row is first a claim (confirmed = false) taken before sending, confirmed
-- once Telegram accepts the message, released if sending fails (same pattern as
-- sale_alert_log, 011).
CREATE TABLE IF NOT EXISTS capacity_alert_log (
    id SERIAL PRIMARY KEY,
    farm_location VARCHAR(100) NOT NULL,
    limit_value INTEGER NOT NULL,        -- the farm's cattle limit when the warning was sent
    step INTEGER NOT NULL,               -- 80 | 90 | 100
    confirmed BOOLEAN NOT NULL DEFAULT false,
    claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (farm_location, limit_value, step)
);
