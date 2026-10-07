import { getSnapshot } from '@/lib/snapshot/read';
import { json } from '@/lib/api/respond';

/** Network totals for the home page (rounded). */
export async function GET() {
  const s = await getSnapshot();
  return json({ ...s.summary, updatedAt: s.builtAt || null });
}
