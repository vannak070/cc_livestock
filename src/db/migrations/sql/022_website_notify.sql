-- 022: Telegram notice for each new website request (docs/website/README.md).
-- The public website only inserts applications and inquiries; CC Livestock
-- sends one message per new row and stamps notified_at so none repeats.
ALTER TABLE website_applications ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
ALTER TABLE website_inquiries ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS website_applications_unnotified ON website_applications (created_at) WHERE notified_at IS NULL;
CREATE INDEX IF NOT EXISTS website_inquiries_unnotified ON website_inquiries (created_at) WHERE notified_at IS NULL;
