-- 020: the daily Telegram messages are now one per farm and kind (for example
-- 'daily:SNR Farm', 'sale:SokcheaCC4'), so the kind column must hold a farm
-- name as well. Existing rows ('morning', 'evening') are kept.
ALTER TABLE daily_alert_log ALTER COLUMN kind TYPE VARCHAR(150);
