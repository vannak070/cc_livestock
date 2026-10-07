import { getSnapshot } from '@/lib/snapshot/read';
import { json, readLimited } from '@/lib/api/respond';

/** One member farm with its cattle available. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = readLimited(request);
  if (limited) return limited;
  const { slug } = await params;
  const s = await getSnapshot();
  const farm = s.farms.find(f => f.slug === slug);
  if (!farm) return json({ error: 'not-found' }, 404, false);
  return json({ ...farm, listings: s.cattle.filter(l => l.farmSlug === slug) });
}
