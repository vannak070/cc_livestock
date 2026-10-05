-- 009: feed products can belong to one farm. owner_farm NULL = a default
-- product set by the office (everyone can use it, only the office can change
-- it). A farm name = a product that farm's owner made; only that farm sees and
-- edits it. New permission `feed_own_products` lets Farm Owners add and edit
-- their own farm's products; it is given to existing Farm Owner accounts and
-- to the stored Farm Owner role.
ALTER TABLE feed_products ADD COLUMN IF NOT EXISTS owner_farm TEXT;

UPDATE users
SET permissions = permissions || '["feed_own_products"]'::jsonb
WHERE jsonb_typeof(permissions) = 'array'
  AND jsonb_array_length(permissions) > 0
  AND NOT permissions ? 'feed_own_products'
  AND role = 'Farm Owner';

UPDATE master_settings ms
SET data = jsonb_set(ms.data, '{roles}', (
  SELECT jsonb_agg(
    CASE WHEN jsonb_typeof(r->'permissions') = 'array'
           AND NOT (r->'permissions') ? 'feed_own_products'
           AND r->>'name' = 'Farm Owner'
         THEN jsonb_set(r, '{permissions}', (r->'permissions') || '["feed_own_products"]'::jsonb)
         ELSE r END
    ORDER BY ord)
  FROM jsonb_array_elements(ms.data->'roles') WITH ORDINALITY AS x(r, ord)
))
WHERE ms.key = 'master_setup'
  AND jsonb_typeof(ms.data->'roles') = 'array'
  AND jsonb_array_length(ms.data->'roles') > 0;
