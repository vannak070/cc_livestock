import type { MetadataRoute } from 'next';

// Web app manifest (served at /manifest.webmanifest). This is what makes the
// app installable from Chrome, Edge and Android; iOS reads the appleWebApp
// metadata in layout.tsx instead.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'CC Livestock',
    short_name: 'CC Livestock',
    description: 'Cattle fattening records: stock, batches, weights, health, feed and sales.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#F7F6F3',
    theme_color: '#0E7A38',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
