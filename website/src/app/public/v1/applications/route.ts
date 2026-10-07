import { insertApplication } from '@/lib/forms/db';
import { checkPhotos } from '@/lib/forms/photos';
import { clientAddress, overLimit } from '@/lib/forms/rate-limit';
import { checkApplication, isRobot } from '@/lib/forms/validate';
import { fromThisSite, json, readBody } from '@/lib/api/respond';

/** "Join as a member" form. Adds one row; never returns stored data. */
export async function POST(request: Request) {
  if (!fromThisSite(request)) return json({ ok: false, error: 'origin' }, 403, false);
  const body = await readBody(request, 3_500_000);
  if (!body) return json({ ok: false, error: 'bad-request' }, 400, false);
  if (isRobot(body)) return json({ ok: true }, 200, false);
  if (overLimit(`app:${clientAddress(request)}`)) return json({ ok: false, error: 'too-many' }, 429, false);
  const checked = checkApplication(body);
  if (!checked.ok) return json({ ok: false, field: checked.field }, 400, false);
  const photos = checkPhotos(body.photos);
  if (!photos) return json({ ok: false, field: 'photos' }, 400, false);
  try {
    await insertApplication(checked.value, photos);
    return json({ ok: true }, 200, false);
  } catch (err) {
    console.error('[forms] Application not saved:', err instanceof Error ? err.message : err);
    return json({ ok: false, error: 'server' }, 500, false);
  }
}
