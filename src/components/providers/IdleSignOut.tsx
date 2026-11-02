'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { RENEW_EVERY_MS, WARN_BEFORE_MS } from '@/lib/session-policy';
import { useText } from '@/hooks/useText';

/** Shared by every tab of this browser, so working in one tab keeps the others signed in. */
const EXPIRES_KEY = 'cc_session_expires';
const RENEWED_KEY = 'cc_session_renewed';
/** Read by the sign-in screen (src/components/LoginScreen.tsx) to say why the person was signed out. */
export const SIGNED_OUT_KEY = 'cc_signed_out';
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

function readNumber(key: string): number {
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}
function writeNumber(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* storage blocked: this tab keeps its own copy */
  }
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Signs the person out after the sign-in time limit (src/lib/session-policy.ts). The server is what enforces it: the
 * sign-in cookie runs out on its own. This keeps the screen in step: real activity (typing, tapping, clicking,
 * scrolling with the wheel, opening the app) renews the sign-in at most once a minute; background checks and saves
 * started by timers do not. Five minutes before the end a box asks "Are you still there?"; at the end the app signs
 * out and reloads, so no farm or money records stay on an unattended screen.
 */
export default function IdleSignOut({ expiresAt, idleMinutes: initialIdle, onSignOut }: {
  /** When the sign-in runs out (seconds), from the server. */
  expiresAt: number;
  idleMinutes: number;
  onSignOut: () => Promise<void>;
}) {
  const { tx } = useText('session');
  const [left, setLeft] = useState<number | null>(null);
  const [atLongest, setAtLongest] = useState(false);
  const deadline = useRef(expiresAt * 1000);
  const idle = useRef(initialIdle);
  const signingOut = useRef(false);
  const longest = useRef(false);

  const signOut = useCallback(async (reason: 'idle' | 'longest' | 'manual') => {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      if (reason !== 'manual') window.sessionStorage.setItem(SIGNED_OUT_KEY, reason === 'longest' ? 'longest' : `idle:${idle.current}`);
    } catch {
      /* the notice is only a courtesy */
    }
    try {
      await onSignOut();
    } catch {
      // The sign-in has run out on the server anyway.
    }
    // A full reload, so nothing from the session stays in memory or on screen.
    window.location.replace('/');
  }, [onSignOut]);

  const renew = useCallback(async () => {
    writeNumber(RENEWED_KEY, Date.now());
    try {
      const res = await fetch('/api/session', { method: 'POST', cache: 'no-store' });
      if (res.status === 401) { void signOut('idle'); return; }
      if (!res.ok) return;
      const body = (await res.json()) as { expiresAt: number; idleMinutes: number; atLongest: boolean };
      deadline.current = body.expiresAt * 1000;
      idle.current = body.idleMinutes;
      writeNumber(EXPIRES_KEY, deadline.current);
      longest.current = body.atLongest;
      setAtLongest(body.atLongest);
    } catch {
      // Offline: the next activity tries again.
    }
  }, [signOut]);

  useEffect(() => {
    writeNumber(EXPIRES_KEY, deadline.current);
    // Opening the app is activity.
    const opened = window.setTimeout(() => void renew(), 0);

    const onActivity = () => {
      if (signingOut.current) return;
      // While the warning shows, only its buttons count.
      if (deadline.current - Date.now() <= WARN_BEFORE_MS) return;
      if (Date.now() - readNumber(RENEWED_KEY) < RENEW_EVERY_MS) return;
      void renew();
    };
    const tick = () => {
      // Another tab may have renewed the sign-in.
      const shared = readNumber(EXPIRES_KEY);
      if (shared > deadline.current) deadline.current = shared;
      const remaining = deadline.current - Date.now();
      if (remaining <= 0) { void signOut(longest.current ? 'longest' : 'idle'); return; }
      setLeft(remaining <= WARN_BEFORE_MS ? remaining : null);
    };
    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, onActivity, { passive: true, capture: true });
    document.addEventListener('visibilitychange', tick);
    const timer = window.setInterval(tick, 1000);
    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, onActivity, { capture: true });
      document.removeEventListener('visibilitychange', tick);
      window.clearInterval(timer);
      window.clearTimeout(opened);
    };
  }, [renew, signOut]);

  if (left === null) return null;
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-slate-900/50 p-3 sm:items-center">
      <div role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-body" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="idle-title" className="flex items-center gap-2 text-xl font-bold text-ink">
          <Clock className="h-6 w-6 text-amber-700" aria-hidden /> {tx('warnTitle')}
        </h2>
        <p id="idle-body" className="mt-2 text-base text-ink">
          {tx(atLongest ? 'warnLongest' : 'warnBody', { time: clock(left) })}
        </p>
        <p className="mt-3 text-center font-mono text-4xl font-bold tabular-nums text-ink" aria-hidden>{clock(left)}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => void signOut('manual')}
            className="h-12 rounded-xl border-2 border-slate-300 px-4 text-base font-semibold text-ink hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            {tx('signOutNow')}
          </button>
          {!atLongest && (
            <button
              type="button"
              autoFocus
              onClick={() => { setLeft(null); void renew(); }}
              className="h-12 rounded-xl bg-emerald-700 px-5 text-base font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
            >
              {tx('stay')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
