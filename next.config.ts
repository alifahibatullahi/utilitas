import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Cloudflare R2 default public URLs (pub-*.r2.dev)
      { protocol: 'https', hostname: '**.r2.dev' },
      // Cloudflare R2 worker domains (in case custom)
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      // Catch-all for HTTPS — aman untuk app internal
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
