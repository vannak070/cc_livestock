import { describe, expect, it } from 'vitest';
import { PHOTO_MAX_CHARS, photoProblem } from './cattle-photo';

const small = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

describe('photoProblem', () => {
  it.each([[undefined], [null], ['']])('accepts no photo (%s)', v => expect(photoProblem(v)).toBeNull());
  it('accepts a small JPG, PNG or WebP data URL', () => {
    expect(photoProblem(small)).toBeNull();
    expect(photoProblem(small.replace('jpeg', 'png'))).toBeNull();
    expect(photoProblem(small.replace('jpeg', 'webp'))).toBeNull();
  });
  it('refuses other types and other kinds of address', () => {
    expect(photoProblem('data:image/svg+xml;base64,PHN2Zz4=')).toMatch(/JPG, PNG or WebP/);
    expect(photoProblem('data:text/html;base64,PGgxPg==')).toMatch(/JPG, PNG or WebP/);
    expect(photoProblem('https://example.com/a.jpg')).toMatch(/JPG, PNG or WebP/);
    expect(photoProblem('javascript:alert(1)')).toMatch(/JPG, PNG or WebP/);
  });
  it('refuses one that is too big', () => {
    expect(photoProblem(`data:image/jpeg;base64,${'A'.repeat(PHOTO_MAX_CHARS)}`)).toMatch(/too big/);
  });
});
