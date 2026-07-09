import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { OperatorProvider } from "@/hooks/useOperator";
import AppShell from "@/components/layout/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Web Utilitas Batubara | Sistem Monitoring Boiler & STG",
  description: "Sistem monitoring real-time untuk Boiler A/B, STG, Tank Level, dan Laporan Shift",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} ${inter.className} antialiased bg-bg-dark text-slate-50 min-h-screen`}>
        {/* TankDataProvider TIDAK lagi di root — dulu SEMUA halaman ikut fetch
            ~9 query tank + 4 channel realtime + poll 5 menit walau tak memakainya
            (sumber ±30rb call tank_flow_readings/bulan). Kini provider hanya
            di layout route yang butuh: /tank-level, /input, /dashboard/[tank]. */}
        <OperatorProvider>
          <AppShell>
            {children}
          </AppShell>
        </OperatorProvider>
      </body>
    </html>
  );
}
