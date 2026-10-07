import { getSnapshot } from '@/lib/snapshot/read';
import { json, readLimited } from '@/lib/api/respond';

/** Cattle available (classes and rounded counts only; no prices). */
export async function GET(request: Request) {
  const limited = readLimited(request);
  if (limited) return limited;
  return json((await getSnapshot()).cattle);
}
