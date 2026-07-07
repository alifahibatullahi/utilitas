import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Root workspace EKSPLISIT — ada package-lock.json nyasar di folder induk
  // (D:\INOVASI 2025) yang membuat Next salah memilih root; sejak middleware.ts
  // ditambahkan, salah root ini membuat dev server macet di "Starting...".
  turbopack: { root: __dirname },
  // Redirect URL lama /input-shift → /input-laporan kini ditangani middleware.ts
  // (butuh manipulasi query: link reminder lama diarahkan ke modal Pilih Laporan
  // dengan membuang param station/mode, sedangkan link review dipertahankan utuh —
  // redirects() di sini tidak bisa membuang query param). JANGAN tambahkan redirect
  // /input-shift di sini: redirects() config berjalan SEBELUM middleware dan akan
  // membajaknya.
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
