-- 005: the Farms list is the one list of farm names. Settings used to keep a
-- second list, `locations`, that repeated them. A name in that old list that
-- is still used somewhere (cattle, batches, feed movements, people) but has no
-- farm becomes a farm (capacity 100, editable on the Farms page); unused names
-- are dropped. Then `locations` is removed from the settings document.
UPDATE master_settings ms
SET data = jsonb_set(
      ms.data,
      '{farms}',
      COALESCE(ms.data->'farms', '[]'::jsonb) || COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', 'FARM-' || upper(substr(md5(loc), 1, 8)), 'name', loc, 'capacity', 100) ORDER BY loc)
        FROM (SELECT DISTINCT btrim(l) AS loc FROM jsonb_array_elements_text(ms.data->'locations') AS l) names
        WHERE loc <> ''
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(ms.data->'farms', '[]'::jsonb)) f WHERE f->>'name' = loc)
          AND (EXISTS (SELECT 1 FROM stock WHERE location = loc)
            OR EXISTS (SELECT 1 FROM batches WHERE farm_location = loc)
            OR EXISTS (SELECT 1 FROM feed_transactions WHERE source_farm = loc OR target_farm = loc)
            OR EXISTS (SELECT 1 FROM users WHERE farm_location = loc))
      ), '[]'::jsonb)
    ) - 'locations'
WHERE ms.key = 'master_setup'
  AND jsonb_typeof(ms.data->'locations') = 'array';

-- Anything else left under that key (null, not a list) is removed too.
UPDATE master_settings SET data = data - 'locations' WHERE key = 'master_setup' AND data ? 'locations';
