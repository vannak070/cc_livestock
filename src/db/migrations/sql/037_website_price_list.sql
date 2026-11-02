-- The beef price list on the public website (Website -> Beef prices; src/lib/website/price-list.ts).
-- Prices are riel per kg; NULL price = "ask us". Filled once from the CamCow Price List brochure (2026-10-28) when empty.
CREATE TABLE IF NOT EXISTS website_price_list (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  published BOOLEAN NOT NULL DEFAULT TRUE,
  note_km TEXT NOT NULL DEFAULT '',
  note_en TEXT NOT NULL DEFAULT '',
  chart_photo_id TEXT REFERENCES website_photos(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS website_price_sections (
  id TEXT PRIMARY KEY,
  title_km TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS website_price_items (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES website_price_sections(id) ON DELETE CASCADE,
  name_km TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  detail_km TEXT NOT NULL DEFAULT '',
  detail_en TEXT NOT NULL DEFAULT '',
  price INTEGER CHECK (price IS NULL OR (price > 0 AND price <= 10000000)),
  photo_id TEXT REFERENCES website_photos(id) ON DELETE SET NULL,
  shown BOOLEAN NOT NULL DEFAULT TRUE,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_website_price_items_section ON website_price_items (section_id, sort);

INSERT INTO website_price_list (id, published, note_km, note_en, updated_by)
VALUES (1, TRUE, 'តម្លៃក្នុង ១ គីឡូក្រាម។ ★ តម្លៃអាចកែប្រែ តាមការចរចាជាក់ស្តែង។', 'Prices are in riel per kilogram. Prices may change; the final price is agreed when you order.', 'migration 037')
ON CONFLICT (id) DO NOTHING;

INSERT INTO website_price_sections (id, title_km, title_en, sort) SELECT 'PS-WHOLE', 'សាច់ទាំងមូល', 'Whole carcass', 1 WHERE NOT EXISTS (SELECT 1 FROM website_price_sections);
INSERT INTO website_price_sections (id, title_km, title_en, sort) SELECT 'PS-FRESH', 'សាច់គោស្រស់', 'Fresh beef cuts', 2 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-WHOLE') AND NOT EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH');
INSERT INTO website_price_sections (id, title_km, title_en, sort) SELECT 'PS-OFFAL', 'គ្រឿងក្នុង', 'Offal', 3 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-WHOLE') AND NOT EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OFFAL');
INSERT INTO website_price_sections (id, title_km, title_en, sort) SELECT 'PS-OTHER', 'ចំណែកផ្សេងៗ', 'Other parts', 4 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-WHOLE') AND NOT EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OTHER');
INSERT INTO website_price_sections (id, title_km, title_en, sort) SELECT 'PS-MADE', 'ផលិតផលកែច្នៃ', 'Processed products', 5 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-WHOLE') AND NOT EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-MADE');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-WHOLE-01', 'PS-WHOLE', 'គោញី', 'Cow (female)', '', '', 26000, 1 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-WHOLE') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-WHOLE-01');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-WHOLE-02', 'PS-WHOLE', 'គោឈ្មោល', 'Bull (male)', '', '', 28000, 2 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-WHOLE') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-WHOLE-02');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-01', 'PS-FRESH', 'សាច់ស្មា', 'Shoulder (chuck)', '', '', 36000, 1 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-01');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-02', 'PS-FRESH', 'សាច់ឆ្អឹងជំនី', 'Rib meat', '', '', 40000, 2 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-02');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-03', 'PS-FRESH', 'សាច់ចំឡុកក្រៅ', 'Striploin', '', '', 48000, 3 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-03');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-04', 'PS-FRESH', 'សាច់ត្រគៀក', 'Rump', '', '', 60000, 4 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-04');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-05', 'PS-FRESH', 'សាច់ភ្លៅក្រោយ', 'Hind leg (round)', '', '', 36000, 5 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-05');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-06', 'PS-FRESH', 'សាច់គុម្ពកន្ទុយ', 'Tail end (rump cap)', '', '', 44000, 6 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-06');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-07', 'PS-FRESH', 'សាច់ទ្រូង', 'Brisket', '', '', 36000, 7 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-07');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-08', 'PS-FRESH', 'សាច់បាងពោះ', 'Belly flank', '', '', 36000, 8 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-08');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-09', 'PS-FRESH', 'សាច់បាង', 'Flank', '', '', 36000, 9 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-09');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-10', 'PS-FRESH', 'សាច់កំភួនជើង', 'Shank', '', '', 34000, 10 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-10');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-11', 'PS-FRESH', 'សាច់ចំឡុកក្នុង', 'Tenderloin', '', '', 76000, 11 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-11');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-12', 'PS-FRESH', 'សាច់ស្តេកពូថៅ', 'Tomahawk steak', '', '', 56000, 12 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-12');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-13', 'PS-FRESH', 'សាច់ស្តេកចំឡុកក្រៅ', 'Striploin steak', '', '', 52000, 13 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-13');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-14', 'PS-FRESH', 'សាច់ស្តេកចំឡុកក្រៅជាប់ឆ្អឹង', 'Bone-in striploin steak', '', '', 56000, 14 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-14');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-15', 'PS-FRESH', 'សាច់ស្រយ (អូសូ ប៊ុយកូ)', 'Osso buco (cross-cut shank)', '', '', 38000, 15 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-15');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-FRESH-16', 'PS-FRESH', 'សាច់កិន', 'Minced beef', '', '', 40000, 16 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-FRESH') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-FRESH-16');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-OFFAL-01', 'PS-OFFAL', 'សាច់ក្រហម', 'Red offal', 'តម្លៃដូចគ្នា ក្នុង ១ គីឡូ៖ បេះដូង • ក្រលៀន • លំពែង • ថ្លើមគោ • សួតគោ', 'Same price per kg: heart, kidney, spleen, liver, lung', 26000, 1 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OFFAL') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-OFFAL-01');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-OFFAL-02', 'PS-OFFAL', 'សាច់ស៖ ពោះមួយរយស្រទាប់ • ពោះសំបុកឃ្មុំ • Peck', 'White offal: omasum, honeycomb tripe, peck', '', '', 18000, 2 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OFFAL') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-OFFAL-02');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-OFFAL-03', 'PS-OFFAL', 'សាច់ស៖ Abomasum', 'White offal: abomasum', '', '', 12000, 3 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OFFAL') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-OFFAL-03');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-OTHER-01', 'PS-OTHER', 'សាច់ថ្ពាល់', 'Cheek', '', '', 32000, 1 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OTHER') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-OTHER-01');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-OTHER-02', 'PS-OTHER', 'កន្ទុយគោ', 'Oxtail', '', '', 32000, 2 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OTHER') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-OTHER-02');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-OTHER-03', 'PS-OTHER', 'សរសៃជើង', 'Leg tendon', '', '', 32000, 3 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OTHER') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-OTHER-03');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-OTHER-04', 'PS-OTHER', 'សាច់ក្បាល', 'Head meat', '', '', 28000, 4 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OTHER') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-OTHER-04');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-OTHER-05', 'PS-OTHER', 'អណ្តាត', 'Tongue', '', '', 26000, 5 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OTHER') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-OTHER-05');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-OTHER-06', 'PS-OTHER', 'ខួរគោ', 'Brain', '', '', 24000, 6 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OTHER') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-OTHER-06');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-OTHER-07', 'PS-OTHER', 'ជើងគោ', 'Feet', '', '', 12000, 7 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OTHER') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-OTHER-07');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-OTHER-08', 'PS-OTHER', 'ស្បែក', 'Skin', '', '', 8000, 8 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OTHER') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-OTHER-08');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-OTHER-09', 'PS-OTHER', 'ខ្លាញ់', 'Fat', '', '', 8000, 9 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-OTHER') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-OTHER-09');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-MADE-01', 'PS-MADE', 'ស្តេកសាច់គោ', 'Beef steak', '', '', NULL, 1 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-MADE') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-MADE-01');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-MADE-02', 'PS-MADE', 'សាច់ឆ្អឹងជំនីគោ', 'Beef ribs', '', '', NULL, 2 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-MADE') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-MADE-02');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-MADE-03', 'PS-MADE', 'ខគោបែបអាឡឺម៉ង់', 'German-style braised beef', '', '', NULL, 3 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-MADE') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-MADE-03');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-MADE-04', 'PS-MADE', 'ប៉ាតេគោ', 'Beef pâté', '', '', NULL, 4 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-MADE') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-MADE-04');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-MADE-05', 'PS-MADE', 'ប្រហិតគោ', 'Beef balls', '', '', NULL, 5 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-MADE') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-MADE-05');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-MADE-06', 'PS-MADE', 'សាច់ក្រកគោ', 'Beef sausage', '', '', NULL, 6 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-MADE') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-MADE-06');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-MADE-07', 'PS-MADE', 'ហែមគោបែបអាឡឺម៉ង់', 'German-style beef ham', '', '', NULL, 7 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-MADE') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-MADE-07');
INSERT INTO website_price_items (id, section_id, name_km, name_en, detail_km, detail_en, price, sort) SELECT 'PI-MADE-08', 'PS-MADE', 'សាច់ក្រកគោឆ្អើ', 'Smoked beef sausage', '', '', NULL, 8 WHERE EXISTS (SELECT 1 FROM website_price_sections WHERE id = 'PS-MADE') AND NOT EXISTS (SELECT 1 FROM website_price_items WHERE id = 'PI-MADE-08');
