import { insertInquiry } from '@/lib/forms/db';
import { clientAddress, overLimit } from '@/lib/forms/rate-limit';
import { checkInquiry, isRobot } from '@/lib/forms/validate';
import { fromThisSite, json, readBody } from '@/lib/api/respond';

/** "Ask for a price" form. Adds one row; never returns stored data. */
export async function POST(request: Request) {
  if (!fromThisSite(request)) return json({ ok: false, error: 'origin' }, 403, false);
  const body = await readBody(request);
  if (!body) return json({ ok: false, error: 'bad-request' }, 400, false);
  if (isRobot(body)) return json({ ok: true }, 200, false);
  if (overLimit(`inq:${clientAddress(request)}`)) return json({ ok: false, error: 'too-many' }, 429, false);
  const checked = checkInquiry(body);
  if (!checked.ok) return json({ ok: false, field: checked.field }, 400, false);
  try {
    await insertInquiry(checked.value);
    return json({ ok: true }, 200, false);
  } catch (err) {
    console.error('[forms] Inquiry not saved:', err instanceof Error ? err.message : err);
    return json({ ok: false, error: 'server' }, 500, false);
  }
}
