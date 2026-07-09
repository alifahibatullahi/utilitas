'use client';

import { TankDataProvider } from '@/hooks/useTankData';
import { DISABLED_FEATURES } from '@/lib/feature-flags';

// TankDataProvider scoped ke route ini saja (dipindah dari root layout).
// /dashboard/[tank] memakai useTankData. Saat fitur dashboard dinonaktifkan
// (lib/feature-flags.ts), provider ikut di-skip supaya halaman "dinonaktifkan"
// benar-benar 0 query; saat flag dibuka lagi provider otomatis aktif kembali.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    if (DISABLED_FEATURES.dashboard) return <>{children}</>;
    return <TankDataProvider>{children}</TankDataProvider>;
}
