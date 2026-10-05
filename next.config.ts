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
  async headers() {
    // Browsers must always re-check the service worker for updates.
    return [
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
