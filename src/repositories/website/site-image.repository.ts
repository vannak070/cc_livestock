import type { PoolClient } from 'pg';
import { run } from './shared';

/** Replaced built-in website pictures (table website_site_images): slot -> photo id. */
export class WebsiteSiteImageRepository {
  async all(): Promise<Record<string, string>> {
    const res = await run('SELECT slot, photo_id FROM website_site_images', []);
    return Object.fromEntries(res.rows.map(r => [r.slot as string, r.photo_id as string]));
  }

  async set(slot: string, photoId: string, by: string, client?: PoolClient): Promise<void> {
    await run(
      `INSERT INTO website_site_images (slot, photo_id, updated_by, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (slot) DO UPDATE SET photo_id = EXCLUDED.photo_id, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [slot, photoId, by], client,
    );
  }

  async clear(slot: string, client?: PoolClient): Promise<void> {
    await run('DELETE FROM website_site_images WHERE slot = $1', [slot], client);
  }
}

export const websiteSiteImageRepository = new WebsiteSiteImageRepository();
