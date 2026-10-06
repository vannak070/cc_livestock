-- 014: farm cattle limits. A farm's limit is still farms[].capacity in
-- master_settings; only Super Admin and Admin change it (enforced in the app).
-- These tables hold a farm's requests for a higher limit and a record of
-- every change to a limit (who, when, from and to, why).
CREATE TABLE IF NOT EXISTS farm_limit_requests (
  id TEXT PRIMARY KEY,
  farm_location TEXT NOT NULL,
  extra INTEGER NOT NULL CHECK (extra > 0),
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  requested_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  new_limit INTEGER
);
CREATE INDEX IF NOT EXISTS farm_limit_requests_farm ON farm_limit_requests (farm_location);

CREATE TABLE IF NOT EXISTS farm_limit_changes (
  id TEXT PRIMARY KEY,
  farm_location TEXT NOT NULL,
  old_limit INTEGER NOT NULL,
  new_limit INTEGER NOT NULL,
  changed_by TEXT NOT NULL DEFAULT '',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL DEFAULT '',
  request_id TEXT
);
CREATE INDEX IF NOT EXISTS farm_limit_changes_farm ON farm_limit_changes (farm_location);
