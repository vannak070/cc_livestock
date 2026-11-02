/**
 * Breed names for the public website. Breeds are typed in by hand on the farms, so one breed can be spelled
 * several ways (a missing "៉" mark, an extra space). The same breed must show once, under one spelling.
 * Keep the same as website/src/lib/breeds.ts.
 */
const strip = (s: string) => s.normalize('NFC').replace(/[\s​-‍⁠]/g, '');
/** The comparison form: no spaces and no "៉" / "៊" tone marks. */
const key = (s: string) => strip(s).replace(/[៉៊]/g, '');

/** The spellings the website shows (and translates) for the breeds CamCow farms keep. */
export const KNOWN_BREEDS = ['ប្រ៉ាម៉ាន់', 'គោទន្លេ', 'ប្រ៉ាម៉ាន់កាត់ទន្លេ'];
const BY_KEY = new Map(KNOWN_BREEDS.map(name => [key(name), name]));

/** One spelling per breed: a known breed in its standard spelling, anything else just tidied (trimmed, single spaces). */
export const canonicalBreed = (raw: string): string => BY_KEY.get(key(raw)) ?? raw.trim().replace(/\s+/g, ' ');
