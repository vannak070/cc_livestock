import type { MetadataRoute } from 'next';
import { DEFAULT_LANG } from '@/lib/i18n/langs';

/**
 * Web app manifest (/manifest.webmanifest): lets a visitor add CamCow to the phone's home screen like an app.
 * Installable only; there is deliberately no service worker, because the farms and cattle shown change through
 * the day and a cache could show stale cattle availability.
 */
export default function manifest(): MetadataRoute.Manifest {
  // The home address opens in the visitor's remembered language (src/proxy.ts); the shortcuts below use the default.
  const start = `/${DEFAULT_LANG}`;
  return {
    id: '/',
    name: 'ខេម ខោវ CamCow',
    short_name: 'CamCow',
    description: 'Cattle fattening with Cambodian family farms. Every animal recorded, from arrival to sale.',
    lang: 'en',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    categories: ['business', 'agriculture'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Cattle available', url: `${start}/cattle`, icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Join as a member farm', url: `${start}/join`, icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
