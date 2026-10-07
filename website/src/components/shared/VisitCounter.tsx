'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import type { EventKind } from '@/lib/visits';

const refused = () => typeof navigator !== 'undefined' && (navigator.doNotTrack === '1' || (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true);

/** Sends one count to this site (src/lib/visits.ts). Never blocks or fails the page. */
export function countVisit(kind: EventKind, extra: { referrer?: string } = {}): void {
  if (refused()) return;
  try {
    const body = JSON.stringify({ kind, path: window.location.pathname, ...extra });
    if (!navigator.sendBeacon?.('/public/v1/events', new Blob([body], { type: 'application/json' }))) {
      void fetch('/public/v1/events', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => undefined);
    }
  } catch {
    // Counting is never worth an error.
  }
}

/** What a pressed link means: Join, Call or Telegram. */
function pressOf(a: HTMLAnchorElement): EventKind | null {
  const href = a.getAttribute('href') ?? '';
  if (href.startsWith('tel:')) return 'call';
  if (/t\.me\/|telegram\./i.test(href)) return 'telegram';
  if (/\/join(?:$|[?#])/.test(href)) return 'join';
  return null;
}

/** Counts page views and presses of Join, Call and Telegram links (no cookies, nothing personal). */
export function VisitCounter() {
  const pathname = usePathname();

  useEffect(() => {
    // The other site's address is only sent with the first page of a visit.
    const first = !sessionStorageFlag();
    countVisit('view', first ? { referrer: document.referrer } : {});
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a');
      const kind = a && pressOf(a as HTMLAnchorElement);
      if (kind) countVisit(kind);
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}

/** True after the first page of this visit (a tab-only flag, gone when the tab closes; not a cookie). */
function sessionStorageFlag(): boolean {
  try {
    if (sessionStorage.getItem('cc-seen')) return true;
    sessionStorage.setItem('cc-seen', '1');
  } catch {
    // Private mode: treat every page as the first.
  }
  return false;
}
