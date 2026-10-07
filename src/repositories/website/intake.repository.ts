import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../config/database';
import type { ApplicationIn, Device, EventIn, InquiryIn } from '../../lib/website/intake';
import type { CheckedPhoto } from '../../services/website/intake-photos';

const id = (prefix: string) => `${prefix}-${randomUUID().slice(0, 12).toUpperCase()}`;

/**
 * Rows arriving from the public website (through the website gateway). The
 * same inserts the website used to run itself with its own database account.
 */
export class WebsiteIntakeRepository {
  /** The application and its photos in one transaction: all saved, or nothing. */
  async insertApplication(a: ApplicationIn, photos: CheckedPhoto[]): Promise<string> {
    return withTransaction(async (client: PoolClient) => {
      const photoIds: string[] = [];
      for (const p of photos) {
        const pid = id('PHOTO');
        await client.query(
          'INSERT INTO website_photos (id, mime, large, small, width, height, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [pid, p.mime, p.large, p.small, p.width, p.height, 'website form']
        );
        photoIds.push(pid);
      }
      const appId = id('APP');
      await client.query(
        `INSERT INTO website_applications (id, name, phone, province, district, land_m2, cattle_now, has_pens, photo_ids, consent_checked, language)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [appId, a.name, a.phone, a.province, a.district, a.landM2, a.cattleNow, a.hasPens, JSON.stringify(photoIds), a.consent, a.language]
      );
      return appId;
    });
  }

  async insertInquiry(i: InquiryIn): Promise<string> {
    const inqId = id('INQ');
    await query(
      `INSERT INTO website_inquiries (id, kind, name, phone, buyer_type, quantity, weight_class, listing_ref, message, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [inqId, i.kind, i.name, i.phone, i.buyerType, i.quantity, i.weightClass, i.listingId, i.message, i.language]
    );
    return inqId;
  }

  /** One page view or button press (no cookies, addresses or browser details). */
  async insertEvent(e: EventIn, device: Device): Promise<void> {
    await query('INSERT INTO website_events (kind, path, lang, device, referrer) VALUES ($1, $2, $3, $4, $5)', [e.kind, e.path, e.lang, device, e.referrer]);
  }
}

export const websiteIntakeRepository = new WebsiteIntakeRepository();
