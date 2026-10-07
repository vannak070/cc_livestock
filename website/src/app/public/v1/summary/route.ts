import { getSnapshot } from '@/lib/snapshot/read';
import { json, readLimited } from '@/lib/api/respond';

/** Network totals for the home page (rounded). */
export async function GET(request: Request) {
  const limited = readLimited(request);
  if (limited) return limited;
  const s = await getSnapshot();
  return json({ ...s.summary, updatedAt: s.builtAt || null });
}
