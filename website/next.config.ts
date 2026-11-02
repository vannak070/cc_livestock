import path from 'path';
import type { NextConfig } from 'next';
import { securityHeaders } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  // Keep Turbopack inside this project (a lockfile higher up would widen it).
  turbopack: { root: path.resolve(__dirname) },
  poweredByHeader: false,
  // Snapshot photos and local images go through the Next image resizer, so phones get small copies.
  // Only these paths (no query strings) may be resized; anything else is refused.
  images: {
    // AVIF first (much smaller photos on phones that support it), WebP for the rest.
    formats: ['image/avif', 'image/webp'],
    // Quality 85 for every resized image (Next's default 75 made AVIF photos visibly soft: cattle faces, grass; 2026-10-30).
    // Next 16 only serves listed qualities and moves any other value to the closest one.
    qualities: [85],
    localPatterns: [
      { pathname: '/photos/**', search: '' },
      { pathname: '/logo.png', search: '' },
      { pathname: '/logo-2026.png', search: '' },
      { pathname: '/partners/**', search: '' },
      { pathname: '/team/**', search: '' },
      { pathname: '/stand/**', search: '' },
    ],
  },
  // The root layout is app/[lang]/layout.tsx, so unknown addresses need app/global-not-found.tsx (Next 16 docs: not-found.md).
  experimental: { globalNotFound: true },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders(process.env.NODE_ENV !== 'production'),
      },
      // Fixed pictures in public/ are re-checked on every visit by default (max-age=0): keep them a week.
      // Rename a file when its picture changes (as logo-2026.png was), or visitors may see the old one for up to 7 days.
      {
        source: '/:dir(stand|team|partners)/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
      {
        source: '/:file(logo-2026.png|contact-qr.svg)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default nextConfig;
