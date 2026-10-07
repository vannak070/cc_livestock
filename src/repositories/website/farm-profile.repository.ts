import type { PoolClient, QueryResultRow } from 'pg';
import type { WebsiteFarmProfile } from '../../lib/types';
import type { ProfileInput } from '../../lib/website';
import { ids, iso, num, run } from './shared';

/** Member farms' public profiles (table website_farm_profiles). */
export class WebsiteFarmProfileRepository {
  private map(row: QueryResultRow): WebsiteFarmProfile {
    return {
      farmId: row.farm_id,
      publicName: row.public_name || '',
      province: row.province || '',
      district: row.district || '',
      ...(row.map_lat !== null ? { mapLat: num(row.map_lat) } : {}),
      ...(row.map_lng !== null ? { mapLng: num(row.map_lng) } : {}),
      storyKm: row.story_km || '',
      storyEn: row.story_en || '',
      ...(row.member_since !== null ? { memberSince: num(row.member_since) } : {}),
      photoIds: ids(row.photo_ids),
      published: !!row.published,
      ...(row.published_by ? { publishedBy: row.published_by } : {}),
      ...(row.published_at ? { publishedAt: iso(row.published_at) } : {}),
      updatedBy: row.updated_by || '',
      updatedAt: iso(row.updated_at)!,
    };
  }

  async findAll(): Promise<WebsiteFarmProfile[]> {
    const res = await run('SELECT * FROM website_farm_profiles ORDER BY public_name', []);
    return res.rows.map(r => this.map(r));
  }

  async find(farmId: string, client?: PoolClient): Promise<WebsiteFarmProfile | null> {
    const res = await run('SELECT * FROM website_farm_profiles WHERE farm_id = $1', [farmId], client);
    return res.rows.length ? this.map(res.rows[0]) : null;
  }

  /** Creates or replaces the profile's details; publishing is changed separately. */
  async save(farmId: string, input: ProfileInput, by: string, client?: PoolClient): Promise<WebsiteFarmProfile> {
    const res = await run(
      `INSERT INTO website_farm_profiles (farm_id, public_name, province, district, map_lat, map_lng, story_km, story_en, member_since, photo_ids, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (farm_id) DO UPDATE SET public_name = $2, province = $3, district = $4, map_lat = $5, map_lng = $6, story_km = $7,
         story_en = $8, member_since = $9, photo_ids = $10, updated_by = $11, updated_at = NOW()
       RETURNING *`,
      [farmId, input.publicName.trim(), input.province, input.district.trim(), input.mapLat ?? null, input.mapLng ?? null,
        input.storyKm.trim(), input.storyEn.trim(), input.memberSince ?? null, JSON.stringify(input.photoIds), by],
      client
    );
    return this.map(res.rows[0]);
  }

  async setPublished(farmId: string, published: boolean, by: string, client?: PoolClient): Promise<void> {
    await run(
      `UPDATE website_farm_profiles SET published = $2, published_by = CASE WHEN $2 THEN $3 ELSE published_by END,
         published_at = CASE WHEN $2 THEN NOW() ELSE published_at END, updated_by = $3, updated_at = NOW() WHERE farm_id = $1`,
      [farmId, published, by],
      client
    );
  }
}

export const websiteFarmProfileRepository = new WebsiteFarmProfileRepository();
