-- 003: one automatic ration deduction per batch/day/ingredient, enforced by
-- the database so concurrent runs of the daily feed job cannot double-deduct.
-- Scoped to the AUTO-RATION prefix so hand-typed reference numbers may repeat.
-- This fails (and rolls back only this migration) if duplicate AUTO-RATION rows
-- already exist: find them with
--   SELECT reference_no, count(*) FROM feed_transactions
--   WHERE reference_no LIKE 'AUTO-RATION-%' GROUP BY 1 HAVING count(*) > 1;
-- remove the extras, and run the migration again.
CREATE UNIQUE INDEX IF NOT EXISTS uq_feed_tx_auto_ration_ref
    ON feed_transactions(reference_no) WHERE reference_no LIKE 'AUTO-RATION-%';
