import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Cloudflare R2 public URL (pub-*.r2.dev)
        protocol: 'https',
        hostname: '**.r2.dev',
      },
    ],
  },
};

export default nextConfig;
