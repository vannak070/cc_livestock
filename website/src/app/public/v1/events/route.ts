import { insertEvent } from '@/lib/forms/db';
import { clientAddress, MINUTE, overLimit } from '@/lib/forms/rate-limit';
import { fromThisSite, readBody } from '@/lib/api/respond';
import { checkEvent, isBot, isPhone } from '@/lib/visits';

const quiet = () => new Response(null, { status: 204 });

/**
 * One page view or button press from this site's own pages (src/lib/visits.ts).
 * Always answers 204 and never says why something was not counted.
 */
export async function POST(request: Request) {
  const ua = request.headers.get('user-agent');
  if (!fromThisSite(request) || isBot(ua)) return quiet();
  if (overLimit(`event:${clientAddress(request)}`, 120, Date.now(), MINUTE)) return quiet();
  const body = await readBody(request, 2_000);
  const event = body && checkEvent(body, new URL(request.url).hostname);
  if (!event) return quiet();
  try {
    await insertEvent(event, isPhone(ua) ? 'phone' : 'computer');
  } catch (err) {
    console.error('[visits] Not saved:', err instanceof Error ? err.message : err);
  }
  return quiet();
}
