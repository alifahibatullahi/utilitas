'use client';

import { TankDataProvider } from '@/hooks/useTankData';

// TankDataProvider scoped ke route ini saja (dipindah dari root layout) —
// fetch tank + realtime channel hanya jalan saat halaman tank benar-benar dibuka.
export default function TankLevelLayout({ children }: { children: React.ReactNode }) {
    return <TankDataProvider>{children}</TankDataProvider>;
}
