import { getSnapshot } from '@/lib/snapshot/read';
import { json } from '@/lib/api/respond';

/** Published news posts, newest first. */
export async function GET() {
  return json((await getSnapshot()).news);
}
