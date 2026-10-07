/**
 * Khmer has no spaces between words, and browsers do not know every Khmer
 * word, so headings can wrap inside one (កសិ / ដ្ឋាន) or leave a lone word.
 * markKmWords puts an invisible zero-width space (​) at every word end,
 * found with the built-in Khmer word list (Intl.Segmenter); text that already
 * has marks, or has no Khmer, is returned as it is. Punctuation (។ ៕ ! ? …)
 * stays with the word before it.
 */
const KHMER = /[ក-៿᧠-᧿]/;
const PUNCT = /^[។-៚!-/:-@…“”»«)]+$/;
export const ZWSP = '​';

export function markKmWords(text: string): string {
  if (!text || text.includes(ZWSP) || !KHMER.test(text) || typeof Intl === 'undefined' || !('Segmenter' in Intl)) return text;
  const segmenter = new Intl.Segmenter('km', { granularity: 'word' });
  let out = '';
  for (const { segment } of segmenter.segment(text)) {
    const last = out.slice(-1);
    if (/^\s+$/.test(segment) || PUNCT.test(segment) || out === '' || /\s/.test(last)) out += segment;
    else out += ZWSP + segment;
  }
  return out;
}

/** The text split into pieces that must not break inside: words (by marks) and the spaces between them. */
export function kmPieces(text: string): string[] {
  return text.split(/(\s+)/).flatMap(part => (/^\s+$/.test(part) ? [part] : part.split(ZWSP))).filter(p => p !== '');
}
