import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { cleanSiteImages, isSiteImageSlot, SITE_IMAGE_DEFAULT_FILE, SITE_IMAGE_SLOTS } from './site-images';
import { photosIn } from '../../services/website/snapshot-publisher.service';

describe('site images', () => {
  it('uses the same slot names as the public website', () => {
    const site = readFileSync(path.resolve(__dirname, '../../../website/src/lib/site-images.ts'), 'utf8');
    const block = site.slice(site.indexOf('SITE_IMAGE_DEFAULTS = {'), site.indexOf('} as const'));
    const siteSlots = [...block.matchAll(/'([a-z0-9-]+)':/g)].map(m => m[1]);
    expect([...siteSlots].sort()).toEqual([...SITE_IMAGE_SLOTS].sort());
  });

  it('has an office copy of every original picture', () => {
    for (const slot of SITE_IMAGE_SLOTS) {
      expect(() => readFileSync(path.resolve(__dirname, '../../../public/website-defaults', SITE_IMAGE_DEFAULT_FILE[slot]))).not.toThrow();
    }
  });

  it('keeps only real slots with an id', () => {
    expect(isSiteImageSlot('leader-1')).toBe(true);
    expect(isSiteImageSlot('logo')).toBe(false);
    expect(cleanSiteImages({ 'leader-1': 'PHOTO-1', logo: 'PHOTO-2', 'leader-2': null })).toEqual({ 'leader-1': 'PHOTO-1' });
  });

  it('publishes the chosen pictures with the snapshot', () => {
    const snapshot = { farms: [], news: [], siteImages: { 'farm-shed': 'PHOTO-9' } } as never;
    expect(photosIn(snapshot)).toEqual(['PHOTO-9']);
  });
});
