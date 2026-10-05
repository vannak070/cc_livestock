-- 007: feed grown or cut on the farm (grass, straw from own fields). Its use
-- is recorded every day, but it is not kept as stock: no feed in, no stock
-- level, no running-low warning. Bought feed (the default) is unchanged.
ALTER TABLE feed_products ADD COLUMN IF NOT EXISTS track_stock BOOLEAN NOT NULL DEFAULT true;
