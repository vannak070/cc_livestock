-- User rule 2026-11-04: farm accounts do not register cattle or record sales; they only view them. The office does both.
-- The app refuses these for farm roles whatever is stored (hasPermission in src/lib/utils.ts); this tidies the stored
-- access so screens and the access editor agree. Cattle and sales already recorded are not touched.
UPDATE users
SET permissions = permissions - '{stock_create,sales_record,sales_delete}'::text[]
WHERE role IN ('Farm Owner', 'Farm Staff', 'Veterinarian')
  AND jsonb_typeof(permissions) = 'array'
  AND permissions ?| array['stock_create', 'sales_record', 'sales_delete'];

UPDATE master_settings ms
SET data = jsonb_set(ms.data, '{roles}', (
  SELECT jsonb_agg(
    CASE WHEN r->>'name' IN ('Farm Owner', 'Farm Staff', 'Veterinarian') AND jsonb_typeof(r->'permissions') = 'array'
         THEN jsonb_set(r, '{permissions}', (r->'permissions') - '{stock_create,sales_record,sales_delete}'::text[])
         ELSE r END
    ORDER BY ord)
  FROM jsonb_array_elements(ms.data->'roles') WITH ORDINALITY AS x(r, ord)
))
WHERE ms.key = 'master_setup'
  AND jsonb_typeof(ms.data->'roles') = 'array'
  AND jsonb_array_length(ms.data->'roles') > 0;
