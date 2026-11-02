import 'server-only';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import type { CheckedPhoto } from './photos';
import type { EventIn } from '../visits';
import type { ApplicationIn, InquiryIn } from './validate';
import { callGateway, gatewayOn, SEND_TIMEOUT_MS } from '../gateway';
import { enqueue, park, remove, waiting } from './outbox';

/**
 * Hands form sends (and visitor counts) to CC Livestock, which shows the
 * request on its Website page and sends a Telegram message. Two ways, chosen
 * by CAMCOW_API_URL (see lib/gateway.ts):
 *  - API: posted to CC Livestock's website gateway, which checks everything
 *    again and saves it. This site then needs no database account.
 *  - Database: written with the insert-only account (FORMS_DATABASE_URL, user
 *    camcow_website). That account cannot read anything, so nothing is ever
 *    selected here.
 */
let pool: Pool | null = null;
function db(): Pool {
  const url = process.env.FORMS_DATABASE_URL?.trim();
  if (!url) throw new Error('FORMS_DATABASE_URL is not set.');
  pool ??= new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 30_000 });
  return pool;
}

const id = (prefix: string) => `${prefix}-${randomUUID().slice(0, 12).toUpperCase()}`;

/** A send that failed. `retryable`: CC Livestock (or its database) could not be reached, so trying later can work. */
class SendError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}

/** Sends one entry to the gateway; anything but success is an error. */
async function viaGateway(path: string, body: unknown): Promise<void> {
  let res: Response;
  try {
    res = await callGateway(path, { method: 'POST', body, timeoutMs: SEND_TIMEOUT_MS });
  } catch (err) {
    throw new SendError(err instanceof Error ? err.message : String(err), true);
  }
  if (!res.ok && res.status !== 204) throw new SendError(`CC Livestock answered ${res.status}.`, res.status >= 500 || res.status === 429 || res.status === 408);
}

/** A database error that means "not reachable now" (connection refused, timed out, server shutting down). */
const DB_DOWN = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', '57P01', '57P03']);
const retryable = (err: unknown): boolean => {
  if (err instanceof SendError) return err.retryable;
  const code = (err as { code?: string } | null)?.code ?? '';
  return DB_DOWN.has(code) || code.startsWith('08');
};

interface QueuedPhoto { mime: string; large: string; small: string; width: number; height: number }
const toQueue = (photos: CheckedPhoto[]): QueuedPhoto[] => photos.map(p => ({ mime: p.mime, large: p.large.toString('base64'), small: p.small.toString('base64'), width: p.width, height: p.height }));
const fromQueue = (photos: QueuedPhoto[]): CheckedPhoto[] => photos.map(p => ({ ...p, large: Buffer.from(p.large, 'base64'), small: Buffer.from(p.small, 'base64') }) as CheckedPhoto);

/** The application and its photos in one transaction: all saved, or nothing. */
async function sendApplication(a: ApplicationIn, photos: CheckedPhoto[] = []): Promise<void> {
  if (gatewayOn()) {
    await viaGateway('/applications', {
      ...a,
      photos: photos.map(p => ({ mime: p.mime, large: p.large.toString('base64'), small: p.small.toString('base64'), width: p.width, height: p.height })),
    });
    return;
  }
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

async function sendInquiry(i: InquiryIn): Promise<void> {
  if (gatewayOn()) return viaGateway('/inquiries', i);
  await db().query(
    `INSERT INTO website_inquiries (id, kind, name, phone, buyer_type, quantity, weight_class, listing_ref, message, language)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id('INQ'), i.kind, i.name, i.phone, i.buyerType, i.quantity, i.weightClass, i.listingId, i.message, i.language]
  );
}

/** One page view or button press (no cookies, addresses or browser details). */
export async function insertEvent(e: EventIn, device: 'phone' | 'computer'): Promise<void> {
  if (gatewayOn()) return viaGateway('/events', { ...e, device });
  await db().query('INSERT INTO website_events (kind, path, lang, device, referrer) VALUES ($1, $2, $3, $4, $5)', [e.kind, e.path, e.lang, device, e.referrer]);
}

/**
 * Saves a Join application. If CC Livestock cannot be reached it waits in the outbox and is sent later, and the
 * visitor is still told it was received; anything CC Livestock refuses is an error as before.
 */
export async function insertApplication(a: ApplicationIn, photos: CheckedPhoto[] = []): Promise<void> {
  void flushOutbox();
  try {
    await sendApplication(a, photos);
  } catch (err) {
    if (!retryable(err)) throw err;
    await enqueue('application', { a, photos: toQueue(photos) });
    console.warn('[forms] CC Livestock cannot be reached: the application waits in the outbox.', err instanceof Error ? err.message : err);
  }
}

/** Saves a price or question request, the same way as insertApplication. */
export async function insertInquiry(i: InquiryIn): Promise<void> {
  void flushOutbox();
  try {
    await sendInquiry(i);
  } catch (err) {
    if (!retryable(err)) throw err;
    await enqueue('inquiry', i);
    console.warn('[forms] CC Livestock cannot be reached: the request waits in the outbox.', err instanceof Error ? err.message : err);
  }
}

let flushing: Promise<void> | null = null;
let lastFlush = 0;
const FLUSH_GAP_MS = 30_000;

/**
 * Sends the waiting form entries, oldest first, and stops at the first one that still cannot get through (the
 * office is still down). Runs at most every 30 seconds and never twice at once.
 */
export function flushOutbox(force = false): Promise<void> {
  if (flushing) return flushing;
  if (!force && Date.now() - lastFlush < FLUSH_GAP_MS) return Promise.resolve();
  lastFlush = Date.now();
  flushing = (async () => {
    let sent = 0;
    for (const { name, item } of await waiting()) {
      try {
        if (item.kind === 'application') {
          const p = item.payload as { a: ApplicationIn; photos: QueuedPhoto[] };
          await sendApplication(p.a, fromQueue(p.photos ?? []));
        } else {
          await sendInquiry(item.payload as InquiryIn);
        }
        await remove(name);
        sent++;
      } catch (err) {
        if (retryable(err)) break;
        await park(name);
        console.error('[forms] CC Livestock refused a waiting entry; it was moved to the outbox failed/ folder.', err instanceof Error ? err.message : err);
      }
    }
    if (sent > 0) console.info(`[forms] Sent ${sent} waiting form entr${sent === 1 ? 'y' : 'ies'} to CC Livestock.`);
  })().catch(err => console.error('[forms] Could not read the outbox:', err instanceof Error ? err.message : err)).finally(() => { flushing = null; });
  return flushing;
}
