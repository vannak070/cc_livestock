import { describe, expect, it } from 'vitest';
import { checkPhotos, imageHasMetadata } from './photos';

const webp = (extra: [string, number][] = []) => {
  const chunks = [['VP8 ', 10] as [string, number], ...extra].map(([tag, size]) => {
    const b = Buffer.alloc(8 + size + (size % 2));
    b.write(tag, 0, 'ascii');
    b.writeUInt32LE(size, 4);
    return b;
  });
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'ascii');
  head.write('WEBP', 8, 'ascii');
  return Buffer.concat([head, ...chunks]);
};
const photo = (buf = webp()) => ({ mime: 'image/webp', large: buf.toString('base64'), small: buf.toString('base64'), width: 1200, height: 900 });

describe('join form photos', () => {
  it('accepts up to three clean photos, and none', () => {
    expect(checkPhotos(undefined)).toEqual([]);
    expect(checkPhotos([photo(), photo()])).toHaveLength(2);
  });
  it('refuses too many, the wrong type, a bad size, or photos with GPS/camera data', () => {
    expect(checkPhotos([photo(), photo(), photo(), photo()])).toBeNull();
    expect(checkPhotos([{ ...photo(), mime: 'image/png' }])).toBeNull();
    expect(checkPhotos([{ ...photo(), width: 5000 }])).toBeNull();
    expect(checkPhotos([photo(webp([['EXIF', 6]]))])).toBeNull();
    expect(imageHasMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x04, 0, 0]), 'image/jpeg')).toBe(true);
  });
});
