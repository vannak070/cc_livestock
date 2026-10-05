-- 010: a management review of a batch that is near its selling date.
-- batches.sale_review holds the last decision as JSON:
--   {"decision":"ready"|"extend","note":"...","by":"name","at":"ISO time","previousTarget":"YYYY-MM-DD"}
-- New permission `batch_review` (review batches for sale). Given to existing
-- Management, Company and Farm Owner accounts, and to those stored roles.
-- Admins always have full access and need no change.
ALTER TABLE batches ADD COLUMN IF NOT EXISTS sale_review JSONB;

UPDATE users
SET permissions = permissions || '["batch_review"]'::jsonb
WHERE jsonb_typeof(permissions) = 'array'
  AND jsonb_array_length(permissions) > 0
  AND NOT permissions ? 'batch_review'
  AND role IN ('Management', 'Company', 'Farm Owner');

UPDATE master_settings ms
SET data = jsonb_set(ms.data, '{roles}', (
  SELECT jsonb_agg(
    CASE WHEN jsonb_typeof(r->'permissions') = 'array'
           AND NOT (r->'permissions') ? 'batch_review'
           AND r->>'name' IN ('Management', 'Company', 'Farm Owner')
         THEN jsonb_set(r, '{permissions}', (r->'permissions') || '["batch_review"]'::jsonb)
         ELSE r END
    ORDER BY ord)
  FROM jsonb_array_elements(ms.data->'roles') WITH ORDINALITY AS x(r, ord)
))
WHERE ms.key = 'master_setup'
  AND jsonb_typeof(ms.data->'roles') = 'array'
  AND jsonb_array_length(ms.data->'roles') > 0;
