import type { PoolClient, QueryResultRow } from 'pg';
import type { ApplicationStatus, InquiryStatus, WebsiteApplication, WebsiteInquiry } from '../../lib/types';
import { ids, iso, num, run } from './shared';

/**
 * Forms sent from the public website: farm applications and price inquiries
 * (tables website_applications, website_inquiries). The public side only ever
 * inserts (step 2); everything else happens here, in the office.
 */
export class WebsiteRequestRepository {
  private application(row: QueryResultRow): WebsiteApplication {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      province: row.province || '',
      district: row.district || '',
      ...(row.land_m2 !== null ? { landM2: num(row.land_m2) } : {}),
      ...(row.cattle_now !== null ? { cattleNow: num(row.cattle_now) } : {}),
      ...(row.has_pens !== null ? { hasPens: !!row.has_pens } : {}),
      photoIds: ids(row.photo_ids),
      consentChecked: !!row.consent_checked,
      language: row.language === 'en' ? 'en' : 'km',
      status: row.status,
      ...(row.handled_by ? { handledBy: row.handled_by } : {}),
      notes: row.notes || '',
      ...(row.farm_id ? { farmId: row.farm_id } : {}),
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    };
  }

  private inquiry(row: QueryResultRow): WebsiteInquiry {
    return {
      id: row.id,
      kind: row.kind === 'notify' ? 'notify' : 'price',
      name: row.name,
      phone: row.phone,
      buyerType: row.buyer_type || '',
      ...(row.quantity !== null ? { quantity: num(row.quantity) } : {}),
      weightClass: row.weight_class || '',
      ...(row.listing_ref ? { listingRef: row.listing_ref } : {}),
      message: row.message || '',
      language: row.language === 'en' ? 'en' : 'km',
      status: row.status,
      ...(row.handled_by ? { handledBy: row.handled_by } : {}),
      notes: row.notes || '',
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    };
  }

  async findApplications(): Promise<WebsiteApplication[]> {
    const res = await run('SELECT * FROM website_applications ORDER BY created_at DESC LIMIT 500', []);
    return res.rows.map(r => this.application(r));
  }

  async findInquiries(): Promise<WebsiteInquiry[]> {
    const res = await run('SELECT * FROM website_inquiries ORDER BY created_at DESC LIMIT 500', []);
    return res.rows.map(r => this.inquiry(r));
  }

  async findApplication(id: string, client?: PoolClient): Promise<WebsiteApplication | null> {
    const res = await run('SELECT * FROM website_applications WHERE id = $1', [id], client);
    return res.rows.length ? this.application(res.rows[0]) : null;
  }

  async findInquiry(id: string, client?: PoolClient): Promise<WebsiteInquiry | null> {
    const res = await run('SELECT * FROM website_inquiries WHERE id = $1', [id], client);
    return res.rows.length ? this.inquiry(res.rows[0]) : null;
  }

  async updateApplication(id: string, status: ApplicationStatus, notes: string, by: string, farmId?: string, client?: PoolClient): Promise<void> {
    await run('UPDATE website_applications SET status = $2, notes = $3, handled_by = $4, farm_id = COALESCE($5, farm_id), updated_at = NOW() WHERE id = $1', [id, status, notes, by, farmId ?? null], client);
  }

  async updateInquiry(id: string, status: InquiryStatus, notes: string, by: string): Promise<void> {
    await run('UPDATE website_inquiries SET status = $2, notes = $3, handled_by = $4, updated_at = NOW() WHERE id = $1', [id, status, notes, by]);
  }

  /** Requests from the last two days that have not been announced on Telegram yet, oldest first. */
  async findUnnotified(): Promise<{ applications: WebsiteApplication[]; inquiries: WebsiteInquiry[] }> {
    const since = "created_at > NOW() - INTERVAL '2 days'";
    const [a, i] = await Promise.all([
      run(`SELECT * FROM website_applications WHERE notified_at IS NULL AND ${since} ORDER BY created_at LIMIT 20`, []),
      run(`SELECT * FROM website_inquiries WHERE notified_at IS NULL AND ${since} ORDER BY created_at LIMIT 20`, []),
    ]);
    return { applications: a.rows.map(r => this.application(r)), inquiries: i.rows.map(r => this.inquiry(r)) };
  }

  /** Claims one request for its Telegram message; false when another process already did. */
  async markNotified(kind: 'application' | 'inquiry', id: string): Promise<boolean> {
    const table = kind === 'application' ? 'website_applications' : 'website_inquiries';
    const res = await run(`UPDATE ${table} SET notified_at = NOW() WHERE id = $1 AND notified_at IS NULL`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  /** Gives a claim back when the message could not be sent, so the next run tries again. */
  async unmarkNotified(kind: 'application' | 'inquiry', id: string): Promise<void> {
    const table = kind === 'application' ? 'website_applications' : 'website_inquiries';
    await run(`UPDATE ${table} SET notified_at = NULL WHERE id = $1`, [id]);
  }

  /**
   * Deletes applications and inquiries older than `months`, with the
   * application photos no profile, listing or news post uses. Applications
   * that became a member farm (linked to a farm) are kept (SFD section 9).
   * One transaction; returns how many of each went.
   */
  async deleteOlderThan(months: number, client: PoolClient): Promise<{ applications: number; inquiries: number; photos: number }> {
    const cutoff = `NOW() - make_interval(months => $1::int)`;
    const apps = await client.query(`DELETE FROM website_applications WHERE created_at < ${cutoff} AND farm_id IS NULL RETURNING photo_ids`, [months]);
    const inq = await client.query(`DELETE FROM website_inquiries WHERE created_at < ${cutoff}`, [months]);
    const photoIds = [...new Set(apps.rows.flatMap(r => ids(r.photo_ids)))];
    let photos = 0;
    if (photoIds.length) {
      const res = await client.query(
        `DELETE FROM website_photos p WHERE p.id = ANY($1::text[])
           AND NOT EXISTS (SELECT 1 FROM website_farm_profiles f WHERE f.photo_ids ? p.id)
           AND NOT EXISTS (SELECT 1 FROM website_batch_listings l WHERE l.photo_id = p.id)
           AND NOT EXISTS (SELECT 1 FROM website_news n WHERE n.photo_id = p.id)
           AND NOT EXISTS (SELECT 1 FROM website_applications a WHERE a.photo_ids ? p.id)`,
        [photoIds]
      );
      photos = res.rowCount ?? 0;
    }
    return { applications: apps.rowCount ?? 0, inquiries: inq.rowCount ?? 0, photos };
  }

  /** How many requests are still New, for the menu badge. */
  async countNew(): Promise<{ applications: number; inquiries: number }> {
    const res = await run(
      `SELECT (SELECT COUNT(*)::int FROM website_applications WHERE status = 'new') AS a, (SELECT COUNT(*)::int FROM website_inquiries WHERE status = 'new') AS i`,
      []
    );
    return { applications: res.rows[0].a, inquiries: res.rows[0].i };
  }
}

export const websiteRequestRepository = new WebsiteRequestRepository();
