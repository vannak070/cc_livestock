import { describe, expect, it } from 'vitest';
import type { WebsiteConsent } from '../types';
import { consentProblem, currentConsent, newsProblem, nextApplicationStatuses, nextInquiryStatuses, photoProblem, profileProblem, publishProblem } from './validation';

const profile = { publicName: 'Green Hill Farm', province: 'Kandal', district: 'Kien Svay', storyKm: '', storyEn: '', photoIds: [] };
const consent = (extra: Partial<WebsiteConsent> = {}) => ({ id: 'c1', farmId: 'F1', givenByName: 'Sokha', givenOn: '2026-10-01', method: 'paper', mayShowName: true, mayShowPhotos: true, mayShowExactLocation: false, recordedBy: 'x', recordedAt: '2026-10-01T00:00:00Z', ...extra }) as WebsiteConsent;

describe('profile checks', () => {
  it('accepts a complete profile', () => {
    expect(profileProblem(profile, 2026)).toBeNull();
  });
  it('rejects a missing province, a half pin, a pin outside Cambodia and a future year', () => {
    expect(profileProblem({ ...profile, province: 'Bangkok' }, 2026)).toMatch(/province/);
    expect(profileProblem({ ...profile, mapLat: 11.5 }, 2026)).toMatch(/both/);
    expect(profileProblem({ ...profile, mapLat: 1, mapLng: 1 }, 2026)).toMatch(/inside Cambodia/);
    expect(profileProblem({ ...profile, memberSince: 2030 }, 2026)).toMatch(/year/);
  });
});

describe('consent', () => {
  it('needs a name, a past date, a method and permission to show the name', () => {
    const ok = { givenByName: 'Sokha', givenOn: '2026-10-01', method: 'paper' as const, mayShowName: true, mayShowPhotos: true, mayShowExactLocation: false };
    expect(consentProblem(ok, '2026-10-07')).toBeNull();
    expect(consentProblem({ ...ok, givenOn: '2026-10-09' }, '2026-10-07')).toMatch(/future/);
    expect(consentProblem({ ...ok, mayShowName: false }, '2026-10-07')).toMatch(/name/);
  });
  it('uses the newest consent that was not withdrawn', () => {
    const list = [consent({ id: 'old', givenOn: '2026-01-01' }), consent({ id: 'new', givenOn: '2026-09-01' }), consent({ id: 'gone', givenOn: '2026-10-01', withdrawnOn: '2026-10-05' })];
    expect(currentConsent(list, 'F1')?.id).toBe('new');
    expect(currentConsent(list, 'F2')).toBeNull();
  });
  it('blocks publishing without consent or a complete profile', () => {
    expect(publishProblem(profile, null)).toMatch(/consent/);
    expect(publishProblem({ ...profile, district: '' }, consent())).toMatch(/district/);
    expect(publishProblem(profile, consent())).toBeNull();
  });
});

describe('news, statuses and photos', () => {
  it('needs a Khmer title and text', () => {
    expect(newsProblem({ titleKm: '', titleEn: 'x', bodyKm: 'x', bodyEn: '' })).toMatch(/title/);
    expect(newsProblem({ titleKm: 'ចំណងជើង', titleEn: '', bodyKm: 'អត្ថបទ', bodyEn: '' })).toBeNull();
  });
  it('only lets requests move forward', () => {
    expect(nextApplicationStatuses('new')).toEqual(['contacted', 'declined']);
    expect(nextApplicationStatuses('accepted')).toEqual([]);
    expect(nextInquiryStatuses('contacted')).toEqual(['closed']);
  });
  it('accepts only app-prepared WebP or JPEG photos of a sensible size', () => {
    expect(photoProblem('image/webp', 200_000, 40_000, 1600, 1200)).toBeNull();
    expect(photoProblem('image/jpeg', 200_000, 40_000, 1600, 1200)).toBeNull();
    expect(photoProblem('image/png', 200_000, 40_000, 1600, 1200)).toMatch(/WebP or JPEG/);
    expect(photoProblem('image/webp', 2_000_000, 40_000, 1600, 1200)).toMatch(/too large/);
  });
});
