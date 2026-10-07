import { describe, it, expect } from 'vitest';
import { checkPhotosIn, imageHasMetadata, MAX_PHOTOS } from './intake-photos';
import { checkPhotos } from '../../../website/src/lib/forms/photos';

const riff = (chunks: [string, number][]): Buffer => {
  const parts = chunks.map(([tag, size]) => { const b = Buffer.alloc(8 + size + (size % 2)); b.write(tag, 0, 'ascii'); b.writeUInt32LE(size, 4); return b; });
  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), ...parts]);
  const head = Buffer.alloc(8); head.write('RIFF', 0, 'ascii'); head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
};
const cleanWebp = riff([['VP8 ', 20]]);
const exifWebp = riff([['VP8 ', 20], ['EXIF', 10]]);
const cleanJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x00, 0x00]);
const exifJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x04, 0x00, 0x00, 0xff, 0xda, 0x00, 0x02]);
const b64 = (b: Buffer) => b.toString('base64');
const photo = (over: Record<string, unknown> = {}) => ({ mime: 'image/webp', large: b64(cleanWebp), small: b64(cleanWebp), width: 800, height: 600, ...over });

describe('photo metadata', () => {
  it('lets plain images through and stops EXIF or XMP', () => {
    expect(imageHasMetadata(cleanWebp, 'image/webp')).toBe(false);
    expect(imageHasMetadata(exifWebp, 'image/webp')).toBe(true);
    expect(imageHasMetadata(riff([['XMP ', 8]]), 'image/webp')).toBe(true);
    expect(imageHasMetadata(cleanJpeg, 'image/jpeg')).toBe(false);
    expect(imageHasMetadata(exifJpeg, 'image/jpeg')).toBe(true);
  });
  it('refuses a file that is not what it claims, or an unknown type', () => {
    expect(imageHasMetadata(Buffer.from('hello world, not an image'), 'image/webp')).toBe(true);
    expect(imageHasMetadata(cleanWebp, 'image/jpeg')).toBe(true);
    expect(imageHasMetadata(cleanJpeg, 'image/png')).toBe(true);
  });
});

describe('photos of an application', () => {
  it('accepts none, or up to the limit, and decodes them', () => {
    expect(checkPhotosIn(undefined)).toEqual([]);
    expect(checkPhotosIn(null)).toEqual([]);
    const ok = checkPhotosIn([photo(), photo({ mime: 'image/jpeg', large: b64(cleanJpeg), small: b64(cleanJpeg) })]);
    expect(ok).toHaveLength(2);
    expect(ok![0].large.equals(cleanWebp)).toBe(true);
  });
  it('refuses anything not acceptable, as a whole', () => {
    expect(checkPhotosIn('photo')).toBeNull();
    expect(checkPhotosIn(Array.from({ length: MAX_PHOTOS + 1 }, () => photo()))).toBeNull();
    expect(checkPhotosIn([photo({ mime: 'image/gif' })])).toBeNull();
    expect(checkPhotosIn([photo({ large: b64(exifWebp) })])).toBeNull();
    expect(checkPhotosIn([photo({ small: '' })])).toBeNull();
    expect(checkPhotosIn([photo({ width: 50 })])).toBeNull();
    expect(checkPhotosIn([photo({ width: 5000 })])).toBeNull();
    expect(checkPhotosIn([photo({ large: b64(Buffer.alloc(800_000, 1)) })])).toBeNull();
    expect(checkPhotosIn([photo(), null])).toBeNull();
  });
  it('gives the same answer as the website for the same photos', () => {
    const cases: unknown[] = [undefined, [photo()], [photo({ large: b64(exifWebp) })], [photo({ width: 50 })], [photo(), photo(), photo(), photo()], [photo({ mime: 'image/gif' })], 'x'];
    for (const c of cases) expect(checkPhotosIn(c)).toEqual(checkPhotos(c));
  });
});
