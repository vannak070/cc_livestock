-- 018: which daily Telegram check-ups have gone out, so a restart or a second
-- server never sends the same one twice. One row per day and kind
-- (morning = the full check-up, evening = the "today's feed" reminder).
-- A row is first a claim (confirmed = false) taken before sending, confirmed
-- once Telegram accepts the message, released if sending fails (same pattern as
-- sale_alert_log, 011, and capacity_alert_log, 017).
CREATE TABLE IF NOT EXISTS daily_alert_log (
    id SERIAL PRIMARY KEY,
    sent_on DATE NOT NULL,               -- the farm's calendar day
    kind VARCHAR(20) NOT NULL,           -- morning | evening
    confirmed BOOLEAN NOT NULL DEFAULT false,
    claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (sent_on, kind)
);
