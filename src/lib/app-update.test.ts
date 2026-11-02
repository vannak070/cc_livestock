import { describe, expect, it, vi } from 'vitest';
import { getErrorMessage } from './utils';
import { isNewerRelease, isStaleAppError, noteStaleApp, STALE_APP_MESSAGE } from './app-update';

const nextError = new Error('Server Action "40ba052584f6f0d6c9f2bf37b0f180f24d9b3217d3" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action');

describe('app update', () => {
  it('recognises the error of a page from an older release', () => {
    expect(isStaleAppError(nextError)).toBe(true);
    expect(isStaleAppError(new Error('This request might be from an older or newer deployment.'))).toBe(true);
    expect(isStaleAppError(new Error('The photo is too large.'))).toBe(false);
    expect(isStaleAppError(undefined)).toBe(false);
  });

  it('turns it into a plain reload message and tells the banner', () => {
    const fire = vi.fn();
    vi.stubGlobal('window', { dispatchEvent: fire });
    expect(getErrorMessage(nextError, 'Failed')).toBe(STALE_APP_MESSAGE);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(getErrorMessage(new Error('Enter the price.'), 'Failed')).toBe('Enter the price.');
    expect(noteStaleApp(new Error('other'))).toBe(false);
    vi.unstubAllGlobals();
  });

  it('compares releases, ignoring unknown ones', () => {
    expect(isNewerRelease('abc', 'def')).toBe(true);
    expect(isNewerRelease('abc', 'abc')).toBe(false);
    expect(isNewerRelease('unknown', 'def')).toBe(false);
    expect(isNewerRelease('abc', undefined)).toBe(false);
  });
});
