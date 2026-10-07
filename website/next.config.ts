import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep Turbopack inside this project (a lockfile higher up would widen it).
  turbopack: { root: path.resolve(__dirname) },
  poweredByHeader: false,
  // Snapshot photos and local images go through the Next image resizer, so phones get small copies.
  // Only these paths (no query strings) may be resized; anything else is refused.
  images: {
    localPatterns: [
      { pathname: '/photos/**', search: '' },
      { pathname: '/logo.png', search: '' },
      { pathname: '/partners/**', search: '' },
      { pathname: '/team/**', search: '' },
    ],
  },
  // The root layout is app/[lang]/layout.tsx, so unknown addresses need app/global-not-found.tsx (Next 16 docs: not-found.md).
  experimental: { globalNotFound: true },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
