import { describe, expect, it } from 'vitest';
import { groupByFarm, khDigits, weightRangeText } from './cattle';
import type { PublicFarm, PublicListing } from './snapshot/types';

const farm = (slug: string, publicName: string, province: string): PublicFarm => ({ slug, publicName, province, provinceKm: province, district: 'D', lat: 0, lng: 0, breeds: [], sizeRange: 'Under 20 head', memberSince: 2026, badges: [], hasCattleAvailable: true, photoIds: [], storyKm: '', storyEn: '' });
const entry = (farmSlug: string, availability: 'now' | 'soon', over: Partial<PublicListing> = {}): PublicListing => ({ listingId: `l-${farmSlug}`, farmSlug, headCount: '10+', weightFrom: 300, weightTo: 400, province: 'Kandal', provinceKm: 'កណ្តាល', availability, ...over });

const en = { between: '{from}–{to} kg', under: 'Under {to} kg', over: '{from} kg+', any: 'Any size' };
const km = { between: '{from}–{to} គ.ក', under: 'តិចជាង {to} គ.ក', over: '{from} គ.ក ឡើង', any: 'គ្រប់ទំហំ' };

describe('weight ranges', () => {
  it('writes each kind of range in English', () => {
    expect(weightRangeText(300, 400, en)).toBe('300–400 kg');
    expect(weightRangeText(null, 250, en)).toBe('Under 250 kg');
    expect(weightRangeText(400, null, en)).toBe('400 kg+');
    expect(weightRangeText(null, null, en)).toBe('Any size');
  });
  it('uses Khmer digits for Khmer', () => {
    expect(weightRangeText(300, 400, km, 'km')).toBe('៣០០–៤០០ គ.ក');
    expect(weightRangeText(null, 250, km, 'km')).toBe('តិចជាង ២៥០ គ.ក');
    expect(weightRangeText(400, null, km, 'km')).toBe('៤០០ គ.ក ឡើង');
    expect(khDigits('2026')).toBe('២០២៦');
  });
});

describe('cattle by farm', () => {
  const farms = [farm('a', 'Alpha Farm', 'Takeo'), farm('b', 'Beta Farm', 'Kandal'), farm('c', 'Gamma Farm', 'Kandal')];

  it('makes one entry per farm, with its windows now first', () => {
    const groups = groupByFarm([entry('b', 'soon'), entry('b', 'now'), entry('a', 'soon')], farms);
    expect(groups.map(g => g.farm.slug)).toEqual(['b', 'a']);
    expect(groups[0].windows.map(w => w.availability)).toEqual(['now', 'soon']);
    expect(groups[0].listingId).toBe('l-b');
  });

  it('puts farms with cattle available now first, then by province and name', () => {
    const groups = groupByFarm([entry('a', 'soon'), entry('c', 'soon'), entry('b', 'now')], farms);
    expect(groups.map(g => g.farm.slug)).toEqual(['b', 'c', 'a']); // now first; then soon: Kandal before Takeo
  });

  it('ignores cattle of a farm that is not in the snapshot, and shows nothing for no cattle', () => {
    expect(groupByFarm([entry('zzz', 'now')], farms)).toEqual([]);
    expect(groupByFarm([], farms)).toEqual([]);
  });
});
