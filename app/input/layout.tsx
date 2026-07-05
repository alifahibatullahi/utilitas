'use client';

import { TankDataProvider } from '@/hooks/useTankData';

// TankDataProvider scoped ke route ini saja (dipindah dari root layout) —
// form legacy /input memakai submitLevel/submitFlowRates dari context tank.
export default function InputLayout({ children }: { children: React.ReactNode }) {
    return <TankDataProvider>{children}</TankDataProvider>;
}
