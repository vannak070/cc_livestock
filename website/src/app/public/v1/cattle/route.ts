import { getSnapshot } from '@/lib/snapshot/read';
import { json } from '@/lib/api/respond';

/** Cattle available (classes and rounded counts only; no prices). */
export async function GET() {
  return json((await getSnapshot()).cattle);
}
