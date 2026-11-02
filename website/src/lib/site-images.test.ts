import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resolveSiteImages, SITE_IMAGE_DEFAULTS } from './site-images';

describe('resolveSiteImages', () => {
  it('shows the original pictures when nothing is chosen', () => {
    expect(resolveSiteImages(undefined)).toEqual(SITE_IMAGE_DEFAULTS);
  });

  it('uses the chosen photo for its slot only', () => {
    const r = resolveSiteImages({ 'team-group': 'PHOTO-ABC123' });
    expect(r['team-group']).toBe('/photos/PHOTO-ABC123-large');
    expect(r['farm-shed']).toBe('/stand/farm-shed.jpg');
  });

  it('ignores unknown slots and odd ids', () => {
    const r = resolveSiteImages({ logo: 'PHOTO-X', 'farm-shed': '../../etc/passwd' });
    expect(r).toEqual(SITE_IMAGE_DEFAULTS);
    expect(Object.keys(r)).not.toContain('logo');
  });
});
