-- 019: which low-feed alerts have been sent to Telegram, so a restart or a
-- second server never sends the same alert twice. One row per farm and feed
-- while it stays low: the row is deleted once the farm restocks above the
-- minimum, so the next drop sends a new alert. A row is first a claim
-- (confirmed = false) taken before sending, confirmed once Telegram accepts the
-- message, released if sending fails (same pattern as 011 and 017).
CREATE TABLE IF NOT EXISTS low_feed_alert_log (
    id SERIAL PRIMARY KEY,
    farm_location VARCHAR(100) NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    confirmed BOOLEAN NOT NULL DEFAULT false,
    claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (farm_location, product_id)
);
