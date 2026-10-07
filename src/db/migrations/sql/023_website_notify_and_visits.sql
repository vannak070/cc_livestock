-- Public website, round 2 (docs/website/README.md):
-- 1. "Tell me when cattle are available": a buyer's request is an inquiry of
--    kind 'notify' (a price question stays kind 'price').
-- 2. Visitor counts without cookies or addresses: one row per page view or
--    button press (which page, phone or computer, the site it came from).
--    Kept 13 months, then deleted by the website upkeep job.

ALTER TABLE website_inquiries ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'price';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'website_inquiries_kind_check') THEN
    ALTER TABLE website_inquiries ADD CONSTRAINT website_inquiries_kind_check CHECK (kind IN ('price', 'notify'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS website_events (
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind TEXT NOT NULL CHECK (kind IN ('view', 'join', 'call', 'telegram', 'price', 'notify')),
  path TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT 'en',
  device TEXT NOT NULL DEFAULT 'computer' CHECK (device IN ('phone', 'computer')),
  referrer TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS website_events_at ON website_events (at);

-- The website's insert-only account (npm run website:forms-user), if it exists yet.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'camcow_website') THEN
    GRANT INSERT ON website_events TO camcow_website;
  END IF;
END $$;
