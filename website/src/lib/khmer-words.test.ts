import { describe, expect, it } from 'vitest';
import { kmPieces, markKmWords, ZWSP } from './khmer-words';

describe('Khmer word marks for headings', () => {
  it('marks Khmer word ends and keeps ។ with its word', () => {
    const marked = markKmWords('កសិដ្ឋានរបស់អ្នក គួរតែនៅលើផែនទីនេះ។');
    expect(marked.replaceAll(ZWSP, '')).toBe('កសិដ្ឋានរបស់អ្នក គួរតែនៅលើផែនទីនេះ។');
    expect(kmPieces(marked)).toContain('នេះ។');
    expect(kmPieces(marked)).toContain('កសិដ្ឋាន');
  });
  it('leaves English and already-marked text alone', () => {
    expect(markKmWords('Our farms, on the map')).toBe('Our farms, on the map');
    const hand = `គោ${ZWSP}គ្រប់`;
    expect(markKmWords(hand)).toBe(hand);
  });
  it('keeps spaces as their own pieces', () => {
    expect(kmPieces(`ខេម ខោវ`)).toEqual(['ខេម', ' ', 'ខោវ']);
  });
});
