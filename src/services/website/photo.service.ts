import { randomUUID } from 'crypto';
import type { Actor } from '../../lib/authz';
import type { WebsitePhotoInfo } from '../../lib/types';
import { photoProblem } from '../../lib/website';
import { websitePhotoRepository } from '../../repositories/website';
import { assertWebsiteAdmin } from './guards';

export interface PhotoUpload {
  /** 'image/webp' or 'image/jpeg': what the browser made when it resized the photo (which also removed GPS and other EXIF data). */
  mime: string;
  largeBase64: string;
  smallBase64: string;
  width: number;
  height: number;
}

/**
 * True when the file still carries location or camera data (an EXIF or XMP
 * block), or is not the type it claims. A photo resized by the browser has none.
 */
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
    // Walk the segments before the image data; APP1 (0xFFE1) holds EXIF and XMP.
    for (let i = 2; i + 4 <= buf.length;) {
      if (buf[i] !== 0xff) return false;
      const marker = buf[i + 1];
      if (marker === 0xda) return false; // start of image data
      if (marker === 0xe1) return true;
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return false;
  }
  return true;
}

/** Website photos. Super Admin and Admin only. */
export class WebsitePhotoService {
  async upload(actor: Actor, input: PhotoUpload): Promise<WebsitePhotoInfo> {
    assertWebsiteAdmin(actor);
    const large = Buffer.from(input.largeBase64, 'base64');
    const small = Buffer.from(input.smallBase64, 'base64');
    const problem = photoProblem(input.mime, large.length, small.length, input.width, input.height);
    if (problem) throw new Error(problem);
    if (imageHasMetadata(large, input.mime) || imageHasMetadata(small, input.mime)) throw new Error('The photo must be prepared by the app. Please choose it again.');
    return websitePhotoRepository.create(`PHOTO-${randomUUID().slice(0, 12).toUpperCase()}`, input.mime, large, small, input.width, input.height, actor.name);
  }
}

export const websitePhotoService = new WebsitePhotoService();
