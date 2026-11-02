/**
 * The pictures built into the public website that Super Admin and Admin can replace from Website -> Pictures
 * (user, 2026-10-28). Each slot shows its original file until a photo is chosen; "Use the original" goes back to it.
 * The slot names travel in the public snapshot (`siteImages`) and must stay the same as SITE_IMAGE_DEFAULTS in
 * website/src/lib/site-images.ts (site-images.test.ts checks this). The logo is not a slot on purpose: it is also the
 * browser icon, the phone app icon and the share picture.
 */
export const SITE_IMAGE_SLOTS = [
  'farm-shed', 'farm-grazing', 'farm-feeding', 'team-group', 'leader-1', 'leader-2', 'partner-ardb', 'partner-techo',
] as const;

export type SiteImageSlot = (typeof SITE_IMAGE_SLOTS)[number];

/** Slot -> website photo id, only for the slots that have a chosen photo. */
export type SiteImages = Partial<Record<SiteImageSlot, string>>;

export const isSiteImageSlot = (slot: unknown): slot is SiteImageSlot =>
  typeof slot === 'string' && (SITE_IMAGE_SLOTS as readonly string[]).includes(slot);

/** The original file of each slot; a copy is kept in public/website-defaults/ so the office can show it. */
export const SITE_IMAGE_DEFAULT_FILE: Record<SiteImageSlot, string> = {
  'farm-shed': 'farm-shed.jpg',
  'farm-grazing': 'farm-grazing.jpg',
  'farm-feeding': 'farm-feeding.jpg',
  'team-group': 'group.jpg',
  'leader-1': 'leader-1.jpg',
  'leader-2': 'leader-2.jpg',
  'partner-ardb': 'ardb.jpg',
  'partner-techo': 'techo.jpg',
};

/** The shape the website shows the picture in, so the office can say which photo fits: wide, tall (portrait) or a square logo. */
export const SITE_IMAGE_SHAPE: Record<SiteImageSlot, 'wide' | 'tall' | 'square'> = {
  'farm-shed': 'wide',
  'farm-grazing': 'wide',
  'farm-feeding': 'wide',
  'team-group': 'wide',
  'leader-1': 'tall',
  'leader-2': 'tall',
  'partner-ardb': 'square',
  'partner-techo': 'square',
};

/** Only real slots with a photo id: anything else is dropped before it can reach the public snapshot. */
export function cleanSiteImages(input: Record<string, string | null | undefined> | undefined): SiteImages {
  const out: SiteImages = {};
  for (const [slot, id] of Object.entries(input ?? {})) if (isSiteImageSlot(slot) && typeof id === 'string' && id) out[slot] = id;
  return out;
}
