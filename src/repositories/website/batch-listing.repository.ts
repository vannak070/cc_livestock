import type { PoolClient, QueryResultRow } from 'pg';
import type { Availability, WebsiteBatchListing } from '../../lib/types';
import { iso, run } from './shared';

export interface ListingInput {
  publicBreed: string;
  publicSex: string;
  overrideAvailability?: Availability | null;
  photoId?: string | null;
}

/** Batches offered on the website (table website_batch_listings). */
export class WebsiteBatchListingRepository {
  private map(row: QueryResultRow): WebsiteBatchListing {
    return {
      batchId: row.batch_id,
      published: !!row.published,
      publicBreed: row.public_breed || '',
      publicSex: row.public_sex || '',
      ...(row.override_availability ? { overrideAvailability: row.override_availability } : {}),
      ...(row.photo_id ? { photoId: row.photo_id } : {}),
      ...(row.published_by ? { publishedBy: row.published_by } : {}),
      ...(row.published_at ? { publishedAt: iso(row.published_at) } : {}),
      updatedBy: row.updated_by || '',
      updatedAt: iso(row.updated_at)!,
    };
  }

  async findAll(): Promise<WebsiteBatchListing[]> {
    const res = await run('SELECT * FROM website_batch_listings', []);
    return res.rows.map(r => this.map(r));
  }

  async save(batchId: string, input: ListingInput, published: boolean, by: string, client?: PoolClient): Promise<WebsiteBatchListing> {
    const res = await run(
      `INSERT INTO website_batch_listings (batch_id, published, public_breed, public_sex, override_availability, photo_id, published_by, published_at, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $2 THEN $7 END, CASE WHEN $2 THEN NOW() END, $7, NOW())
       ON CONFLICT (batch_id) DO UPDATE SET published = $2, public_breed = $3, public_sex = $4, override_availability = $5, photo_id = $6,
         published_by = CASE WHEN $2 AND NOT website_batch_listings.published THEN $7 ELSE website_batch_listings.published_by END,
         published_at = CASE WHEN $2 AND NOT website_batch_listings.published THEN NOW() ELSE website_batch_listings.published_at END,
         updated_by = $7, updated_at = NOW()
       RETURNING *`,
      [batchId, published, input.publicBreed.trim(), input.publicSex.trim(), input.overrideAvailability ?? null, input.photoId ?? null, by],
      client
    );
    return this.map(res.rows[0]);
  }
}

export const websiteBatchListingRepository = new WebsiteBatchListingRepository();
