-- 011: what the Telegram sale alerts have already sent, so a restart or a
-- second server never sends the same alert twice. One row per batch, selling
-- date, stage and day. A row is first a claim (confirmed = false) taken before
-- sending; it is confirmed after Telegram accepts the message and released if
-- sending fails. Old unconfirmed claims (a crash mid-send) are cleaned up.
CREATE TABLE IF NOT EXISTS sale_alert_log (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(50) NOT NULL,
    target_date DATE NOT NULL,            -- the batch's selling date when the alert was sent
    stage VARCHAR(20) NOT NULL,           -- window | week | overdue
    sent_on DATE NOT NULL,                -- the farm's calendar day
    confirmed BOOLEAN NOT NULL DEFAULT false,
    claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (batch_id, target_date, stage, sent_on)
);
CREATE INDEX IF NOT EXISTS idx_sale_alert_log_batch ON sale_alert_log (batch_id);
