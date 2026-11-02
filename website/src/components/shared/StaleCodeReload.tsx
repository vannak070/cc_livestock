'use client';

import { useEffect } from 'react';

const KEY = 'camcow-stale-reload';
const STALE = /ChunkLoadError|Loading (CSS )?chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

/**
 * After a release the files of the previous one are gone. A page that was open (or shown from the browser's memory)
 * still asks for them when it loads more code, e.g. the map, and that part stays empty until a hard refresh. Here the
 * page reloads itself once instead, at most once a minute so a real network problem cannot cause a reload loop.
 */
export function StaleCodeReload() {
  useEffect(() => {
    const reloadOnce = () => {
      try {
        const last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last < 60_000) return;
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {
        return;
      }
      window.location.reload();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { name?: string; message?: string } | undefined;
      if (STALE.test(`${r?.name ?? ''} ${r?.message ?? String(e.reason ?? '')}`)) reloadOnce();
    };
    // A script or style sheet of the site that fails to load (the files of an older release).
    const onError = (e: Event) => {
      const el = e.target as HTMLScriptElement | HTMLLinkElement | null;
      const url = (el && ('src' in el ? el.src : 'href' in el ? el.href : '')) || '';
      if (url.includes('/_next/static/')) reloadOnce();
    };
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError, true);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError, true);
    };
  }, []);
  return null;
}
