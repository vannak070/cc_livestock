import { OG_SIZE, shareImage } from '@/lib/og';
import { getSnapshot } from '@/lib/snapshot/read';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'A CamCow member farm';

/** A member farm's share preview: its public name (Latin letters only) and province. */
export default async function Image({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { slug } = await params;
  const farm = (await getSnapshot()).farms.find(f => f.slug === slug);
  const latin = (s: string) => s.replace(/[^\x20-\x7E]/g, '').trim();
  const name = farm ? latin(farm.publicName) || 'CamCow member farm' : 'CamCow member farm';
  return shareImage(name, farm ? `Member farm in ${farm.province}` : 'Meet our member farms.');
}
