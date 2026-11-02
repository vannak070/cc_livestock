import { describe, expect, it } from 'vitest';
import { breedList, breedName, canonicalBreed } from './breeds';

describe('breeds', () => {
  it('merges spelling variants', () => {
    expect(canonicalBreed('ប្រាម៉ាន់កាត់ទន្លេ')).toBe(canonicalBreed('ប្រ៉ាម៉ាន់ កាត់ទន្លេ'));
  });
  it('names known breeds in English and keeps unknown ones', () => {
    expect(breedName('ប្រ៉ាម៉ាន់', 'en')).toBe('Brahman');
    expect(breedName('ប្រាម៉ាន់កាត់ទន្លេ', 'en')).toBe('Brahman × Tonle cross');
    expect(breedName('Angus', 'en')).toBe('Angus');
    expect(breedName('ប្រាម៉ាន់កាត់ទន្លេ', 'km')).toBe('ប្រ៉ាម៉ាន់កាត់ទន្លេ');
  });
  it('lists each breed once', () => {
    const list = breedList([['ប្រ៉ាម៉ាន់ កាត់ទន្លេ', 'គោទន្លេ'], ['ប្រាម៉ាន់កាត់ទន្លេ']], 'en');
    expect(list.map(b => b.label)).toEqual(['Brahman × Tonle cross', 'Tonle cattle']);
  });
});
