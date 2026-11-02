// The photo of an animal is stored as a small image in the cattle record. These rules are shared by the page
// (which shrinks the picture before sending) and the server (which refuses anything else).

/** The longest side, in pixels, a photo is shrunk to before it is sent. */
export const PHOTO_MAX_SIDE = 1280;
/** JPEG quality used when shrinking. */
export const PHOTO_QUALITY = 0.82;
/** The most the server accepts, as the length of the data URL (about 1.5 MB of picture). */
export const PHOTO_MAX_CHARS = 2_000_000;

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Why a photo cannot be stored, or null. An empty value (no photo, or removing it) is fine. */
export function photoProblem(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.length > PHOTO_MAX_CHARS) return 'The photo is too big. Take a new photo or choose a smaller picture.';
  if (!DATA_URL.test(imageUrl)) return 'The photo must be a JPG, PNG or WebP picture.';
  return null;
}
