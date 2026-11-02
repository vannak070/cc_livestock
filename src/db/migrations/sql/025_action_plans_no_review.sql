-- 025: action plans have no approval step (user, 2026-10-14: "management just need to
-- see the report based on action plan"). Super Admin/Admin write and save plans;
-- Management only reads them and the report. The status and decision columns from 024 go.
ALTER TABLE farm_action_plans DROP COLUMN IF EXISTS status;
ALTER TABLE farm_action_plans DROP COLUMN IF EXISTS decided_by;
ALTER TABLE farm_action_plans DROP COLUMN IF EXISTS decided_at;
ALTER TABLE farm_action_plans DROP COLUMN IF EXISTS decision_note;
