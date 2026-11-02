/**
 * Breed names for the public website. Breeds are typed in by hand on the farms, so one breed can be spelled
 * several ways (a missing "៉" mark, an extra space). The same breed must show once, under one spelling.
 * Keep the same as CC Livestock's src/lib/website/breeds.ts.
 */
const strip = (s: string) => s.normalize('NFC').replace(/[\s​-‍⁠]/g, '');
/** The comparison form: no spaces and no "៉" / "៊" tone marks. */
const key = (s: string) => strip(s).replace(/[៉៊]/g, '');

/** The spellings the website shows (and translates) for the breeds CamCow farms keep. */
export const KNOWN_BREEDS = ['ប្រ៉ាម៉ាន់', 'គោទន្លេ', 'ប្រ៉ាម៉ាន់កាត់ទន្លេ'];
const BY_KEY = new Map(KNOWN_BREEDS.map(name => [key(name), name]));

/** One spelling per breed: a known breed in its standard spelling, anything else just tidied (trimmed, single spaces). */
export const canonicalBreed = (raw: string): string => BY_KEY.get(key(raw)) ?? raw.trim().replace(/\s+/g, ' ');

/** English names for the known breeds (Khmer pages show the Khmer spelling). Edit here. */
const ENGLISH: Record<string, string> = {
  'ប្រ៉ាម៉ាន់': 'Brahman',
  'គោទន្លេ': 'Tonle cattle',
  'ប្រ៉ាម៉ាន់កាត់ទន្លេ': 'Brahman × Tonle cross',
};

/** What to show for a breed on a page: the breed in the visitor's language, one spelling per breed. */
export const breedName = (raw: string, lang: 'km' | 'en'): string => {
  const name = canonicalBreed(raw);
  return lang === 'en' ? ENGLISH[name] ?? name : name;
};

/** The breeds of several farms, each once, sorted by the name shown. */
export const breedList = (all: string[][], lang: 'km' | 'en'): { value: string; label: string }[] => {
  const seen = new Map<string, string>();
  for (const b of all.flat()) seen.set(canonicalBreed(b), breedName(b, lang));
  return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
};
