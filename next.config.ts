import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to this project. Without it Next.js walks up and
    // picks the first lockfile it finds (a stray ~/pnpm-lock.yaml on the dev
    // machine), which widens file watching and the build cache to the whole
    // home folder.
    root: path.resolve(__dirname),
  },
  // Next logs every server action with its arguments while developing, which printed sign-in passwords in the
  // dev terminal. Turned off; production never logged them.
  logging: { serverFunctions: false },
  experimental: {
    // A receipt PDF or photo goes to a server action as text (base64), well over the 1 MB default.
    serverActions: { bodySizeLimit: '10mb' },
  },
  async headers() {
    // Hardening for every response. This Content-Security-Policy is the base for files (icons, sw.js, offline.html);
    // pages get the strict one, with a script nonce per page load, from src/proxy.ts (src/lib/app-csp.ts).
    const security = [
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      // The receipt/cattle photo buttons use a file input with capture, so the camera is only allowed for this site.
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
      // Browsers ignore this over plain HTTP, so it only takes effect once the site is served over HTTPS.
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];
    return [
      { source: "/:path*", headers: security },
      // Browsers must always re-check the service worker for updates.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
