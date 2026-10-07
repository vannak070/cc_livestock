import { getSnapshot } from '@/lib/snapshot/read';
import { json } from '@/lib/api/respond';

/** Member farms for the map and list. */
export async function GET() {
  return json((await getSnapshot()).farms);
}
