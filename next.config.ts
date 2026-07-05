import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // URL lama /input-shift TETAP TERPAKAI selamanya — link permanen reminder WA
  // yang sudah terkirim ke HP operator memuat /input-shift?station=... Redirect
  // permanen meneruskan query param otomatis ke route baru /input-laporan.
  async redirects() {
    return [
      { source: '/input-shift', destination: '/input-laporan', permanent: true },
    ];
  },
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
