import { describe, expect, it } from 'vitest';
import { imageHasMetadata } from './photo.service';

const webp = (chunks: [string, number][]) => {
  const body = chunks.map(([tag, size]) => {
    const b = Buffer.alloc(8 + size + (size % 2));
    b.write(tag, 0, 'ascii');
    b.writeUInt32LE(size, 4);
    return b;
  });
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'ascii');
  head.write('WEBP', 8, 'ascii');
  return Buffer.concat([head, ...body]);
};
const jpeg = (markers: number[]) => Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  ...markers.map(m => Buffer.from([0xff, m, 0x00, 0x04, 0x00, 0x00])),
  Buffer.from([0xff, 0xda, 0x00, 0x02]),
]);

describe('photo metadata check', () => {
  it('passes clean WebP and JPEG files made by the browser', () => {
    expect(imageHasMetadata(webp([['VP8 ', 10]]), 'image/webp')).toBe(false);
    expect(imageHasMetadata(jpeg([0xe0, 0xdb]), 'image/jpeg')).toBe(false);
  });
  it('refuses files that still carry EXIF or XMP (camera and GPS data)', () => {
    expect(imageHasMetadata(webp([['VP8 ', 10], ['EXIF', 6]]), 'image/webp')).toBe(true);
    expect(imageHasMetadata(webp([['XMP ', 4]]), 'image/webp')).toBe(true);
    expect(imageHasMetadata(jpeg([0xe1]), 'image/jpeg')).toBe(true);
  });
  it('refuses a file that is not what it claims, or another type', () => {
    expect(imageHasMetadata(Buffer.from('hello world!'), 'image/webp')).toBe(true);
    expect(imageHasMetadata(jpeg([0xe0]), 'image/png')).toBe(true);
  });
});
