/**
 * Photos sent with a Join application. The browser resizes them first
 * (which drops GPS and camera data); the server checks again and refuses any
 * file that is not a plain WebP or JPEG, is too big, or still carries EXIF/XMP.
 * Same rule as CC Livestock's src/services/website/photo.service.ts.
 */
export const MAX_PHOTOS = 3;
export const LARGE_PX = 1200;
export const SMALL_PX = 400;
export const MAX_PHOTO_BYTES = 700_000;
export const PHOTO_TYPES = ['image/webp', 'image/jpeg'];

export interface PhotoIn {
  mime: string;
  large: string;
  small: string;
  width: number;
  height: number;
}

export interface CheckedPhoto {
  mime: string;
  large: Buffer;
  small: Buffer;
  width: number;
  height: number;
}

/** True when the file still carries location or camera data, or is not the type it claims. */
export function imageHasMetadata(buf: Buffer, mime: string): boolean {
  if (mime === 'image/webp') {
    if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return true;
    for (let i = 12; i + 8 <= buf.length;) {
      const tag = buf.toString('ascii', i, i + 4);
      if (tag === 'EXIF' || tag === 'XMP ') return true;
      const size = buf.readUInt32LE(i + 4);
      i += 8 + size + (size % 2);
    }
    return false;
  }
  if (mime === 'image/jpeg') {
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return true;
    for (let i = 2; i + 4 <= buf.length;) {
      if (buf[i] !== 0xff) return false;
      const marker = buf[i + 1];
      if (marker === 0xda) return false;
      if (marker === 0xe1) return true;
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return false;
  }
  return true;
}

/** Checks the photos of one application; null when any of them is not acceptable. */
export function checkPhotos(raw: unknown): CheckedPhoto[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_PHOTOS) return null;
  const out: CheckedPhoto[] = [];
  for (const p of raw as Partial<PhotoIn>[]) {
    if (!p || typeof p.large !== 'string' || typeof p.small !== 'string' || !PHOTO_TYPES.includes(String(p.mime))) return null;
    const width = Number(p.width), height = Number(p.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 100 || height < 100 || width > LARGE_PX || height > LARGE_PX) return null;
    const large = Buffer.from(p.large, 'base64');
    const small = Buffer.from(p.small, 'base64');
    if (!large.length || !small.length || large.length > MAX_PHOTO_BYTES || small.length > MAX_PHOTO_BYTES) return null;
    if (imageHasMetadata(large, p.mime!) || imageHasMetadata(small, p.mime!)) return null;
    out.push({ mime: p.mime!, large, small, width, height });
  }
  return out;
}
