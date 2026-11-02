-- Built-in pictures of the public website replaced from Website -> Pictures (src/lib/website/site-images.ts).
-- One row per replaced slot; no row = the website shows its original picture.
CREATE TABLE IF NOT EXISTS website_site_images (
  slot TEXT PRIMARY KEY,
  photo_id TEXT NOT NULL REFERENCES website_photos(id),
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
