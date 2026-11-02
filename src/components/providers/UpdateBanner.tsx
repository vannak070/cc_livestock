'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { APP_UPDATED_EVENT, isNewerRelease, isStaleAppError } from '@/lib/app-update';

const CHECK_EVERY_MS = 3 * 60 * 1000;

/**
 * "CC Livestock was updated" bar. The page remembers the release it was opened with (`version`, from the server) and
 * asks /api/version when it comes back into view, when the network returns and every 3 minutes; a different release,
 * or a save that failed because the page is from an older release (APP_UPDATED_EVENT), shows the bar with Reload.
 * Both languages, because it also shows on the sign-in screen before a language is chosen.
 */
export default function UpdateBanner({ version }: { version: string }) {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { version: server } = (await res.json()) as { version?: string };
        if (!stopped && isNewerRelease(version, server)) setStale(true);
      } catch {
        // Offline or the server is restarting: try again at the next check.
      }
    };
    const onVisible = () => { void check(); };
    const onStale = () => setStale(true);
    // A failed save that no screen caught.
    const onRejection = (e: PromiseRejectionEvent) => { if (isStaleAppError(e.reason)) setStale(true); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    window.addEventListener(APP_UPDATED_EVENT, onStale);
    window.addEventListener('unhandledrejection', onRejection);
    const timer = window.setInterval(onVisible, CHECK_EVERY_MS);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
      window.removeEventListener(APP_UPDATED_EVENT, onStale);
      window.removeEventListener('unhandledrejection', onRejection);
      window.clearInterval(timer);
    };
  }, [version]);

  if (!stale) return null;
  return (
    <div role="alert" className="fixed inset-x-3 bottom-3 z-[1000] mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 pl-4 text-base text-amber-950 shadow-lg sm:inset-x-auto sm:left-1/2 sm:w-[min(36rem,calc(100%-1.5rem))] sm:-translate-x-1/2">
      <p className="min-w-0 flex-1">
        <span className="block font-semibold">CC Livestock was updated</span>
        <span className="block text-sm">ប្រព័ន្ធត្រូវបានធ្វើបច្ចុប្បន្នភាព · Reload to keep working</span>
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-900 px-4 font-semibold text-white hover:bg-amber-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-900 focus-visible:ring-offset-2"
      >
        <RefreshCw className="h-4 w-4" aria-hidden /> Reload · ផ្ទុកឡើងវិញ
      </button>
    </div>
  );
}
