import { getSessionActor } from '@/lib/session';
import { canOpenWebsitePage } from '@/lib/website';
import { websitePhotoRepository } from '@/repositories/website';

/**
 * Shows a website photo inside the office app (Website page). Signed-in
 * people who can open the Website page only; the public site gets its copies
 * from the snapshot instead (step 2). `?size=small` for thumbnails.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getSessionActor();
  if (!actor || !canOpenWebsitePage(actor)) return new Response('Not allowed', { status: 403 });
  const { id } = await params;
  const size = new URL(request.url).searchParams.get('size') === 'small' ? 'small' : 'large';
  const photo = await websitePhotoRepository.bytes(id, size);
  if (!photo) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: { 'Content-Type': photo.mime, 'Cache-Control': 'private, max-age=86400' },
  });
}
