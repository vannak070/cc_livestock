import { describe, expect, it } from 'vitest';
import { canonicalBreed } from './breeds';

describe('canonicalBreed', () => {
  it('merges the spellings found on the farms into one', () => {
    expect(canonicalBreed('ប្រាម៉ាន់កាត់ទន្លេ')).toBe('ប្រ៉ាម៉ាន់កាត់ទន្លេ');
    expect(canonicalBreed('ប្រ៉ាម៉ាន់ កាត់ទន្លេ')).toBe('ប្រ៉ាម៉ាន់កាត់ទន្លេ');
    expect(canonicalBreed('ប្រ៉ាម៉ាន់')).toBe('ប្រ៉ាម៉ាន់');
    expect(canonicalBreed(' ប្រាម៉ាន់ ')).toBe('ប្រ៉ាម៉ាន់');
    expect(canonicalBreed('គោទន្លេ')).toBe('គោទន្លេ');
  });
  it('keeps an unknown breed as typed, only tidied', () => {
    expect(canonicalBreed('  Angus   cross ')).toBe('Angus cross');
  });
});
