-- 013: migration 009 gave the new permission `feed_own_products` only to Farm
-- Owners. Nobody may hand out access they do not hold, so office accounts
-- (Company, Company Admin, ...) could no longer add or change a Farm Owner:
-- "You cannot give access you do not have yourself (feed_own_products)".
-- Everyone who manages all feed products (`feed_manage`) already does more
-- than this, so they get it too, and so do stored roles with feed_manage.
-- Admins always have full access and need no change.
UPDATE users
SET permissions = permissions || '["feed_own_products"]'::jsonb
WHERE jsonb_typeof(permissions) = 'array'
  AND jsonb_array_length(permissions) > 0
  AND NOT permissions ? 'feed_own_products'
  AND permissions ? 'feed_manage';

UPDATE master_settings ms
SET data = jsonb_set(ms.data, '{roles}', (
  SELECT jsonb_agg(
    CASE WHEN jsonb_typeof(r->'permissions') = 'array'
           AND NOT (r->'permissions') ? 'feed_own_products'
           AND (r->'permissions') ? 'feed_manage'
         THEN jsonb_set(r, '{permissions}', (r->'permissions') || '["feed_own_products"]'::jsonb)
         ELSE r END
    ORDER BY ord)
  FROM jsonb_array_elements(ms.data->'roles') WITH ORDINALITY AS x(r, ord)
))
WHERE ms.key = 'master_setup'
  AND jsonb_typeof(ms.data->'roles') = 'array'
  AND jsonb_array_length(ms.data->'roles') > 0;
