/**
 * Telling an open page that CC Livestock was released again (user, 2026-10-30, after "Server Action ... was not found"
 * on a photo upload). Each release gives the server functions new ids, so a page opened before the release fails on its
 * next save. The page now notices a new release (UpdateBanner asks /api/version) or such a failure, and asks for a
 * reload. Pure and browser-safe.
 */

/** Window event fired when an action failed because the page is from an older release. */
export const APP_UPDATED_EVENT = 'cc:app-updated';

/** Shown instead of Next's technical message. Both languages, because it can appear before the language is known. */
export const STALE_APP_MESSAGE = 'CC Livestock was updated. Please reload the page, then try again. · ប្រព័ន្ធត្រូវបានធ្វើបច្ចុប្បន្នភាព។ សូមផ្ទុកទំព័រឡើងវិញ រួចសាកល្បងម្តងទៀត។';

const STALE = /Server Action .* was not found|older or newer deployment|failed-to-find-server-action/i;

export function isStaleAppError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return STALE.test(message);
}

/** True (and the update banner is told) when `err` comes from an older release of the page. */
export function noteStaleApp(err: unknown): boolean {
  if (!isStaleAppError(err)) return false;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(APP_UPDATED_EVENT));
  return true;
}

/** The server runs a different release than the one this page came from. Unknown versions never count. */
export function isNewerRelease(mine: string | null | undefined, server: string | null | undefined): boolean {
  const known = (v: string | null | undefined) => !!v && v !== 'unknown';
  return known(mine) && known(server) && mine !== server;
}
