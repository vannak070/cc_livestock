import { currentAppVersion } from '@/lib/app-version';

/** The release this server runs, for the "CC Livestock was updated" banner (src/components/providers/UpdateBanner.tsx). */
export async function GET() {
  return Response.json({ version: await currentAppVersion() }, { headers: { 'Cache-Control': 'no-store' } });
}
