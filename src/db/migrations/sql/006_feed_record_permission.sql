-- 006: new permission `feed_record` (record daily feed use). People store
-- their own access, so the new key is added to everyone who already manages
-- feed, and to Farm Owners and Farm Staff, who write down each day's feeding.
-- The same goes for the stored role definitions. Admins always have full
-- access and need no change.
UPDATE users
SET permissions = permissions || '["feed_record"]'::jsonb
WHERE jsonb_typeof(permissions) = 'array'
  AND jsonb_array_length(permissions) > 0
  AND NOT permissions ? 'feed_record'
  AND (permissions ? 'feed_manage' OR role IN ('Farm Owner', 'Farm Staff'));

UPDATE master_settings ms
SET data = jsonb_set(ms.data, '{roles}', (
  SELECT jsonb_agg(
    CASE WHEN jsonb_typeof(r->'permissions') = 'array'
           AND NOT (r->'permissions') ? 'feed_record'
           AND ((r->'permissions') ? 'feed_manage' OR r->>'name' IN ('Farm Owner', 'Farm Staff'))
         THEN jsonb_set(r, '{permissions}', (r->'permissions') || '["feed_record"]'::jsonb)
         ELSE r END
    ORDER BY ord)
  FROM jsonb_array_elements(ms.data->'roles') WITH ORDINALITY AS x(r, ord)
))
WHERE ms.key = 'master_setup'
  AND jsonb_typeof(ms.data->'roles') = 'array'
  AND jsonb_array_length(ms.data->'roles') > 0;
