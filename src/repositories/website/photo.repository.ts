import type { QueryResultRow } from 'pg';
import type { WebsitePhotoInfo } from '../../lib/types';
import { iso, run } from './shared';

/** Website photos (table website_photos): a large and a small WebP copy of each. */
export class WebsitePhotoRepository {
  private info(row: QueryResultRow): WebsitePhotoInfo {
    return { id: row.id, mime: row.mime, width: Number(row.width), height: Number(row.height), uploadedBy: row.uploaded_by || '', createdAt: iso(row.created_at)! };
  }

  async create(id: string, mime: string, large: Buffer, small: Buffer, width: number, height: number, by: string): Promise<WebsitePhotoInfo> {
    const res = await run(
      'INSERT INTO website_photos (id, mime, large, small, width, height, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, mime, width, height, uploaded_by, created_at',
      [id, mime, large, small, width, height, by]
    );
    return this.info(res.rows[0]);
  }

  /** One copy's bytes, for showing it in the office (and, in step 2, copying it to the public side). */
  async bytes(id: string, size: 'large' | 'small'): Promise<{ mime: string; data: Buffer } | null> {
    const res = await run(`SELECT mime, ${size === 'large' ? 'large' : 'small'} AS data FROM website_photos WHERE id = $1`, [id]);
    return res.rows.length ? { mime: res.rows[0].mime, data: res.rows[0].data as Buffer } : null;
  }
}

export const websitePhotoRepository = new WebsitePhotoRepository();
