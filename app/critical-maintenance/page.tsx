'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import CriticalSheetPage from '@/components/critical-sheet/CriticalSheetPage';

// CriticalSheetPage & penjaga login sama-sama pakai useSearchParams → butuh Suspense.
export default function CriticalMaintenanceRoute() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-neutral-50" />}>
            <GuardedPage />
        </Suspense>
    );
}

function GuardedPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { operator, loading } = useOperator();

    /**
     * Belum login → ke halaman pilih operator, TAPI tujuannya dititipkan di `?next=`.
     * Link dari spreadsheet (menu 📷 Upload Foto & sel "Link Foto") membawa `?item=…&foto=…`
     * yang gunanya membuka modal record itu begitu halaman siap; kalau paramnya dibuang
     * saat redirect, operator mendarat di menu dan harus mencari sendiri recordnya.
     * Pola yang sama dipakai /input-laporan untuk link reminder WA.
     */
    useEffect(() => {
        if (loading || operator) return;
        const qs = searchParams?.toString();
        const next = `/critical-maintenance${qs ? `?${qs}` : ''}`;
        router.replace(`/?next=${encodeURIComponent(next)}`);
    }, [loading, operator, searchParams, router]);

    if (loading || !operator) {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
                <p className="text-sm text-neutral-400 font-medium">Memuat…</p>
            </div>
        );
    }
    return <CriticalSheetPage />;
}
