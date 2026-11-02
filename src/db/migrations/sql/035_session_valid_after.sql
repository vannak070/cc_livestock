-- Sign-ins made before this moment no longer count (src/lib/authz.ts loadActor). Set whenever a password changes,
-- so a stolen or forgotten session on another phone stops working at once instead of living out its 30 days.
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_valid_after TIMESTAMPTZ;
