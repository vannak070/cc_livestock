-- 021: the public CamCow website (docs/website/README.md).
-- The office decides here what may go public; the website itself never reads
-- these tables directly (a sync job builds a rounded public snapshot, step 2).
-- Farms stay in master_settings and are linked by their farm id (farms[].id).

-- A member farm's public profile. Nothing shows until `published` is true,
-- and publishing needs a valid consent (enforced in the app).
CREATE TABLE IF NOT EXISTS website_farm_profiles (
  farm_id TEXT PRIMARY KEY,
  public_name TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  map_lat DOUBLE PRECISION,
  map_lng DOUBLE PRECISION,
  story_km TEXT NOT NULL DEFAULT '',
  story_en TEXT NOT NULL DEFAULT '',
  member_since INTEGER,
  photo_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_by TEXT,
  published_at TIMESTAMPTZ,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Proof that a farmer agreed to be shown. A withdrawn consent stays on record.
CREATE TABLE IF NOT EXISTS website_consents (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  given_by_name TEXT NOT NULL,
  given_on DATE NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('paper', 'web_form', 'other')),
  may_show_name BOOLEAN NOT NULL DEFAULT TRUE,
  may_show_photos BOOLEAN NOT NULL DEFAULT TRUE,
  may_show_exact_location BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_by TEXT NOT NULL DEFAULT '',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_on DATE,
  withdrawn_by TEXT
);
CREATE INDEX IF NOT EXISTS website_consents_farm ON website_consents (farm_id);

-- A batch offered on the website ("cattle available").
CREATE TABLE IF NOT EXISTS website_batch_listings (
  batch_id TEXT PRIMARY KEY,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  public_breed TEXT NOT NULL DEFAULT '',
  public_sex TEXT NOT NULL DEFAULT '',
  override_availability TEXT CHECK (override_availability IN ('now', 'soon')),
  photo_id TEXT,
  published_by TEXT,
  published_at TIMESTAMPTZ,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "Join as a member" forms from the website.
CREATE TABLE IF NOT EXISTS website_applications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  province TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  land_m2 INTEGER,
  cattle_now INTEGER,
  has_pens BOOLEAN,
  photo_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  consent_checked BOOLEAN NOT NULL DEFAULT FALSE,
  language TEXT NOT NULL DEFAULT 'km',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'accepted', 'declined')),
  handled_by TEXT,
  notes TEXT NOT NULL DEFAULT '',
  farm_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS website_applications_status ON website_applications (status, created_at DESC);

-- "Ask for a price" forms from the website.
CREATE TABLE IF NOT EXISTS website_inquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  buyer_type TEXT NOT NULL DEFAULT '',
  quantity INTEGER,
  weight_class TEXT NOT NULL DEFAULT '',
  listing_ref TEXT,
  message TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'km',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  handled_by TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS website_inquiries_status ON website_inquiries (status, created_at DESC);

-- News and training posts.
CREATE TABLE IF NOT EXISTS website_news (
  id TEXT PRIMARY KEY,
  title_km TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  body_km TEXT NOT NULL,
  body_en TEXT NOT NULL DEFAULT '',
  photo_id TEXT,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Photos for profiles, listings and news. Resized and re-encoded in the
-- browser before upload, which also removes GPS and other EXIF data.
CREATE TABLE IF NOT EXISTS website_photos (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  large BYTEA NOT NULL,
  small BYTEA NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- New permission `website_requests` (see and handle website applications and
-- inquiries). Given to existing Company accounts and the stored Company role.
-- Super Admin and Admin always have full access and need no change.
UPDATE users
SET permissions = permissions || '["website_requests"]'::jsonb
WHERE jsonb_typeof(permissions) = 'array'
  AND jsonb_array_length(permissions) > 0
  AND NOT permissions ? 'website_requests'
  AND role IN ('Company');

UPDATE master_settings ms
SET data = jsonb_set(ms.data, '{roles}', (
  SELECT jsonb_agg(
    CASE WHEN jsonb_typeof(r->'permissions') = 'array'
           AND NOT (r->'permissions') ? 'website_requests'
           AND r->>'name' IN ('Company')
         THEN jsonb_set(r, '{permissions}', (r->'permissions') || '["website_requests"]'::jsonb)
         ELSE r END
    ORDER BY ord)
  FROM jsonb_array_elements(ms.data->'roles') WITH ORDINALITY AS x(r, ord)
))
WHERE ms.key = 'master_setup'
  AND jsonb_typeof(ms.data->'roles') = 'array'
  AND jsonb_array_length(ms.data->'roles') > 0;
