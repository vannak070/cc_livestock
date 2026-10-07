import type { QueryResultRow } from 'pg';
import type { WebsiteNewsPost } from '../../lib/types';
import type { NewsInput } from '../../lib/website';
import { iso, run } from './shared';

/** News and training posts (table website_news). */
export class WebsiteNewsRepository {
  private map(row: QueryResultRow): WebsiteNewsPost {
    return {
      id: row.id,
      titleKm: row.title_km,
      titleEn: row.title_en || '',
      bodyKm: row.body_km,
      bodyEn: row.body_en || '',
      ...(row.photo_id ? { photoId: row.photo_id } : {}),
      published: !!row.published,
      ...(row.published_at ? { publishedAt: iso(row.published_at) } : {}),
      createdBy: row.created_by || '',
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    };
  }

  async findAll(): Promise<WebsiteNewsPost[]> {
    const res = await run('SELECT * FROM website_news ORDER BY created_at DESC', []);
    return res.rows.map(r => this.map(r));
  }

  async find(id: string): Promise<WebsiteNewsPost | null> {
    const res = await run('SELECT * FROM website_news WHERE id = $1', [id]);
    return res.rows.length ? this.map(res.rows[0]) : null;
  }

  async create(id: string, input: NewsInput, by: string): Promise<WebsiteNewsPost> {
    const res = await run(
      'INSERT INTO website_news (id, title_km, title_en, body_km, body_en, photo_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [id, input.titleKm.trim(), input.titleEn.trim(), input.bodyKm.trim(), input.bodyEn.trim(), input.photoId ?? null, by]
    );
    return this.map(res.rows[0]);
  }

  async update(id: string, input: NewsInput): Promise<WebsiteNewsPost | null> {
    const res = await run(
      'UPDATE website_news SET title_km = $2, title_en = $3, body_km = $4, body_en = $5, photo_id = $6, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, input.titleKm.trim(), input.titleEn.trim(), input.bodyKm.trim(), input.bodyEn.trim(), input.photoId ?? null]
    );
    return res.rows.length ? this.map(res.rows[0]) : null;
  }

  async setPublished(id: string, published: boolean): Promise<void> {
    await run('UPDATE website_news SET published = $2, published_at = CASE WHEN $2 THEN COALESCE(published_at, NOW()) ELSE published_at END, updated_at = NOW() WHERE id = $1', [id, published]);
  }

  async delete(id: string): Promise<boolean> {
    const res = await run('DELETE FROM website_news WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
}

export const websiteNewsRepository = new WebsiteNewsRepository();
