'use client';

import { usePathname } from 'next/navigation';
import { TankDataProvider } from '@/hooks/useTankData';
import { DISABLED_FEATURES } from '@/lib/feature-flags';

// TankDataProvider scoped ke route ini saja (dipindah dari root layout).
// Hanya /dashboard/[tank] yang memakai useTankData; /dashboard sendiri membaca data APM
// lewat /api/dashboard/apm, jadi provider (dan query tank-nya) dilewati di sana. Saat
// fitur dashboard dinonaktifkan (lib/feature-flags.ts), provider juga di-skip supaya
// halaman "dinonaktifkan" benar-benar 0 query.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    if (DISABLED_FEATURES.dashboard || pathname === '/dashboard') return <>{children}</>;
    return <TankDataProvider>{children}</TankDataProvider>;
}
