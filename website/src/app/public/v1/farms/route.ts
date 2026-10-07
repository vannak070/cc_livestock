import { getSnapshot } from '@/lib/snapshot/read';
import { json, readLimited } from '@/lib/api/respond';

/** Member farms for the map and list. */
export async function GET(request: Request) {
  const limited = readLimited(request);
  if (limited) return limited;
  return json((await getSnapshot()).farms);
}
