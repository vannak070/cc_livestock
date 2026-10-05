'use client';

import { useEffect } from 'react';

// Registers /sw.js (offline fallback page only). Production only, so the dev
// server's hot reload is never intercepted.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Registration is optional; the app works the same without it.
    });
  }, []);
  return null;
}
