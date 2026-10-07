import { readPhoto } from '@/lib/snapshot/read';

/** Photos the snapshot shows (only files the CC Livestock publisher wrote). */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const photo = await readPhoto(file);
  if (!photo) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(photo.data), { headers: { 'Content-Type': photo.type, 'Cache-Control': 'public, max-age=86400' } });
}
