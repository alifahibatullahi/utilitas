'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import CriticalSheetPage from '@/components/critical-sheet/CriticalSheetPage';

export default function CriticalMaintenanceRoute() {
    const router = useRouter();
    const { operator, loading } = useOperator();

    useEffect(() => {
        if (!loading && !operator) router.replace('/');
    }, [loading, operator, router]);

    if (loading || !operator) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <p className="text-sm text-slate-400 font-medium">Memuat…</p>
            </div>
        );
    }
    // CriticalSheetPage pakai useSearchParams → butuh Suspense boundary.
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
            <CriticalSheetPage />
        </Suspense>
    );
}
