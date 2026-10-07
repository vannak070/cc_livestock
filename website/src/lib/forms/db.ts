import 'server-only';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import type { CheckedPhoto } from './photos';
import type { ApplicationIn, InquiryIn } from './validate';

/**
 * Writes form sends into CC Livestock with the insert-only account
 * (FORMS_DATABASE_URL, user camcow_website). That account cannot read
 * anything, so nothing is ever selected here. CC Livestock then shows the
 * request on its Website page and sends a Telegram message.
 */
let pool: Pool | null = null;
function db(): Pool {
  const url = process.env.FORMS_DATABASE_URL?.trim();
  if (!url) throw new Error('FORMS_DATABASE_URL is not set.');
  pool ??= new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 30_000 });
  return pool;
}

const id = (prefix: string) => `${prefix}-${randomUUID().slice(0, 12).toUpperCase()}`;

/** The application and its photos in one transaction: all saved, or nothing. */
export async function insertApplication(a: ApplicationIn, photos: CheckedPhoto[] = []): Promise<void> {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const photoIds: string[] = [];
    for (const p of photos) {
      const pid = id('PHOTO');
      await client.query(
        'INSERT INTO website_photos (id, mime, large, small, width, height, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [pid, p.mime, p.large, p.small, p.width, p.height, 'website form']
      );
      photoIds.push(pid);
    }
    await client.query(
      `INSERT INTO website_applications (id, name, phone, province, district, land_m2, cattle_now, has_pens, photo_ids, consent_checked, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id('APP'), a.name, a.phone, a.province, a.district, a.landM2, a.cattleNow, a.hasPens, JSON.stringify(photoIds), a.consent, a.language]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function insertInquiry(i: InquiryIn): Promise<void> {
  await db().query(
    `INSERT INTO website_inquiries (id, name, phone, buyer_type, quantity, weight_class, listing_ref, message, language)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id('INQ'), i.name, i.phone, i.buyerType, i.quantity, i.weightClass, i.listingId, i.message, i.language]
  );
}
