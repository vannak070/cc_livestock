-- Feed is not part of the action plan (user, 2026-10-15): the plan is the monthly swap only (cattle sold to the farm
-- and bought back the same day). Feed deliveries made by the first version of farm programs are removed, and tasks can
-- only be the two cattle kinds. Idempotent: deleting nothing is fine, and the constraint is replaced by name.
DELETE FROM ops_tasks WHERE kind = 'feed_delivery';
ALTER TABLE ops_tasks DROP CONSTRAINT IF EXISTS ops_tasks_kind_check;
ALTER TABLE ops_tasks ADD CONSTRAINT ops_tasks_kind_check CHECK (kind IN ('sell_to_farm', 'buy_back'));
