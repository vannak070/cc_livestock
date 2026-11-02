import { photoUrl } from './photo-url';
import { getSnapshot } from './snapshot/read';

/**
 * The pictures built into the site that the office can replace (CC Livestock: Website -> Pictures). Until a photo is
 * chosen each slot shows its file in public/; the snapshot's `siteImages` names the chosen photos. Keep the slot names
 * the same as SITE_IMAGE_SLOTS in CC Livestock's src/lib/website/site-images.ts (its test checks this file).
 */
export const SITE_IMAGE_DEFAULTS = {
  'farm-shed': '/stand/farm-shed.jpg',
  'farm-grazing': '/stand/farm-grazing.jpg',
  'farm-feeding': '/stand/farm-feeding.jpg',
  'team-group': '/team/group.jpg',
  'leader-1': '/team/leader-1.jpg',
  'leader-2': '/team/leader-2.jpg',
  'partner-ardb': '/partners/ardb.jpg',
  'partner-techo': '/partners/techo.jpg',
} as const;

export type SiteImageSlot = keyof typeof SITE_IMAGE_DEFAULTS;
export type SiteImages = Record<SiteImageSlot, string>;

/** Every slot's address: the chosen photo, or the original file. Unknown slots in the snapshot are ignored. */
export function resolveSiteImages(chosen: Partial<Record<string, string>> | undefined): SiteImages {
  const out = { ...SITE_IMAGE_DEFAULTS } as SiteImages;
  for (const slot of Object.keys(SITE_IMAGE_DEFAULTS) as SiteImageSlot[]) {
    const id = chosen?.[slot];
    if (typeof id === 'string' && /^[A-Za-z0-9-]+$/.test(id)) out[slot] = photoUrl(id, 'large');
  }
  return out;
}

/** The pictures for this page, from the latest snapshot. */
export async function siteImages(): Promise<SiteImages> {
  return resolveSiteImages((await getSnapshot()).siteImages);
}
