import { readLimited } from '@/lib/api/respond';
import { outboxStatus } from '@/lib/forms/outbox';
import { getSnapshot, officeLink } from '@/lib/snapshot/read';
import { snapshotAgeMinutes, staleAfterHours } from '@/lib/snapshot/stale';

/** Form entries waiting longer than this mean CC Livestock has been unreachable for a while. */
const OUTBOX_ALERT_MINUTES = 30;

/**
 * For an uptime monitor (or `npm run website:watch` in CC Livestock): 200 when the site has fresh data and no
 * form entries are stuck, 503 otherwise, with the reason. Nothing private: ages and counts only.
 */
export async function GET(request: Request) {
  const limited = readLimited(request);
  if (limited) return limited;
  const s = await getSnapshot();
  const age = snapshotAgeMinutes(s);
  const outbox = await outboxStatus();
  const link = officeLink();
  const problems = [
    ...(age === null ? ['no data from CC Livestock yet'] : s.stale ? [`data is ${age < 120 ? `${age} minutes` : `${Math.round(age / 60)} hours`} old (limit ${staleAfterHours()} hours)`] : []),
    ...(!link.reachable ? ['CC Livestock cannot be reached'] : []),
    ...(outbox.oldestMinutes !== null && outbox.oldestMinutes > OUTBOX_ALERT_MINUTES ? [`${outbox.waiting} form entr${outbox.waiting === 1 ? 'y waits' : 'ies wait'} to be sent`] : []),
    ...(outbox.refused > 0 ? [`${outbox.refused} form entr${outbox.refused === 1 ? 'y was' : 'ies were'} refused (see the outbox failed/ folder)`] : []),
  ];
  return Response.json(
    { ok: problems.length === 0, problems, dataAgeMinutes: age, staleAfterHours: staleAfterHours(), office: link, outbox, checkedAt: new Date().toISOString() },
    { status: problems.length === 0 ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
