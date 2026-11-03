/**
 * Plain white or black strips around an uploaded photo (a picture pasted onto a white page, a phone screenshot with
 * black bars). The office photo picker cuts them off before resizing, so website cards show the photo, not the strips
 * (user request 2026-11-02: SokcheaCC4's photo had white strips left and right). Pure, so it can be tested; the picker
 * reads the pixels from a small canvas copy and scales the answer back up.
 */

export interface CropBox { x: number; y: number; width: number; height: number }

/** How close to pure white / black a pixel must be (0-255 per colour). */
const NEAR = 24;
/** A row or column counts as a strip when this share of its pixels is plain. */
const PLAIN_SHARE = 0.985;
/** Never keep less than this share of the width or height: a mostly white picture (a document, a logo) is left alone. */
const KEEP_AT_LEAST = 0.5;

type Tone = 'white' | 'black';

function toneAt(px: Uint8ClampedArray, i: number): Tone | null {
  const r = px[i], g = px[i + 1], b = px[i + 2];
  if (r >= 255 - NEAR && g >= 255 - NEAR && b >= 255 - NEAR) return 'white';
  if (r <= NEAR && g <= NEAR && b <= NEAR) return 'black';
  return null;
}

/**
 * The part of the picture to keep, in the same pixels as `px` (RGBA, `width` x `height`), or null when there is
 * nothing worth cutting. Each side is cut while its whole row or column is one plain tone (white or black).
 */
export function plainEdgeCrop(px: Uint8ClampedArray, width: number, height: number): CropBox | null {
  const lineTone = (count: number, at: (k: number) => number): Tone | null => {
    let white = 0, black = 0;
    for (let k = 0; k < count; k++) {
      const t = toneAt(px, at(k));
      if (t === 'white') white++;
      else if (t === 'black') black++;
    }
    if (white >= count * PLAIN_SHARE) return 'white';
    if (black >= count * PLAIN_SHARE) return 'black';
    return null;
  };
  const rowTone = (y: number) => lineTone(width, x => (y * width + x) * 4);
  const colTone = (x: number) => lineTone(height, y => (y * width + x) * 4);

  let top = 0, bottom = height - 1, left = 0, right = width - 1;
  while (top < bottom && rowTone(top)) top++;
  while (bottom > top && rowTone(bottom)) bottom--;
  while (left < right && colTone(left)) left++;
  while (right > left && colTone(right)) right--;

  const box = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  if (box.width === width && box.height === height) return null;
  if (box.width < width * KEEP_AT_LEAST || box.height < height * KEEP_AT_LEAST) return null;
  return box;
}

/**
 * A crop found on a small copy (`smallWidth` x `smallHeight`), in the full picture's pixels. A side that was cut moves
 * one more pixel inwards, so no thin line of the strip survives the scaling; an uncut side stays at the edge.
 */
export function scaleCrop(box: CropBox, smallWidth: number, smallHeight: number, fullWidth: number, fullHeight: number): CropBox {
  const fx = fullWidth / smallWidth, fy = fullHeight / smallHeight;
  const x = box.x > 0 ? Math.floor(box.x * fx) + 1 : 0;
  const y = box.y > 0 ? Math.floor(box.y * fy) + 1 : 0;
  const right = box.x + box.width < smallWidth ? Math.ceil((box.x + box.width) * fx) - 1 : fullWidth;
  const bottom = box.y + box.height < smallHeight ? Math.ceil((box.y + box.height) * fy) - 1 : fullHeight;
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}
