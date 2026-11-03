import { describe, expect, it } from 'vitest';
import { plainEdgeCrop, scaleCrop } from './photo-edges';

/** A picture of `w` x `h`: plain `edge` colour everywhere except a coloured block inside `inner`. */
function picture(w: number, h: number, inner: { x: number; y: number; w: number; h: number } | null, edge = 255) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const inside = inner && x >= inner.x && x < inner.x + inner.w && y >= inner.y && y < inner.y + inner.h;
    px[i] = inside ? 120 : edge; px[i + 1] = inside ? 90 : edge; px[i + 2] = inside ? 60 : edge; px[i + 3] = 255;
  }
  return px;
}

describe('cutting plain strips off a photo', () => {
  it('cuts white strips left and right (the SokcheaCC4 case)', () => {
    expect(plainEdgeCrop(picture(100, 60, { x: 8, y: 0, w: 84, h: 60 }), 100, 60)).toEqual({ x: 8, y: 0, width: 84, height: 60 });
  });
  it('cuts black bars too', () => {
    expect(plainEdgeCrop(picture(100, 60, { x: 0, y: 10, w: 100, h: 40 }, 0), 100, 60)).toEqual({ x: 0, y: 10, width: 100, height: 40 });
  });
  it('leaves a photo with no strips alone', () => {
    expect(plainEdgeCrop(picture(50, 40, { x: 0, y: 0, w: 50, h: 40 }), 50, 40)).toBeNull();
  });
  it('leaves a mostly white picture alone (a logo or a document)', () => {
    expect(plainEdgeCrop(picture(100, 100, { x: 40, y: 40, w: 20, h: 20 }), 100, 100)).toBeNull();
    expect(plainEdgeCrop(picture(20, 20, null), 20, 20)).toBeNull();
  });
  it('stops at a line with something on it (text under a poster photo stays)', () => {
    const px = picture(100, 100, { x: 0, y: 0, w: 100, h: 60 });
    const i = (80 * 100 + 50) * 4; px[i] = 200; px[i + 1] = 20; px[i + 2] = 20; // one red dot of "text" at row 80
    for (let x = 30; x < 70; x++) { const j = (80 * 100 + x) * 4; px[j] = 200; px[j + 1] = 20; px[j + 2] = 20; }
    expect(plainEdgeCrop(px, 100, 100)).toEqual({ x: 0, y: 0, width: 100, height: 81 });
  });
  it('scales a crop from the small copy back to the full photo, inside the strips', () => {
    expect(scaleCrop({ x: 8, y: 0, width: 84, height: 60 }, 100, 60, 1000, 600)).toEqual({ x: 81, y: 0, width: 838, height: 600 });
  });
});
