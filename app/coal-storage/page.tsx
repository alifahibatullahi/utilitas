'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { COAL_AREAS, formatTanggal, petaWarnaSupplier } from '@/lib/coal-storage';
import { COAL_LOTS, COAL_LOTS_UPDATED_AT } from '@/lib/coal-storage-data';
import RingkasanEstimasi from '@/components/coal-storage/RingkasanEstimasi';
import AreaDenah from '@/components/coal-storage/AreaDenah';
import SupplierLegend from '@/components/coal-storage/SupplierLegend';

// Penjaga login memakai useSearchParams → butuh Suspense.
export default function CoalStorageRoute() {
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
    const [highlight, setHighlight] = useState<string | null>(null);
    // Satu peta warna untuk seluruh halaman supaya denah, kartu detail, dan
    // legend memakai warna yang sama persis per supplier.
    const warna = useMemo(() => petaWarnaSupplier(COAL_LOTS), []);

    // Belum login → ke halaman pilih operator dengan tujuan dititipkan di ?next=,
    // supaya link dari WA tetap mendarat di sini (pola /critical-maintenance).
    useEffect(() => {
        if (loading || operator) return;
        const qs = searchParams?.toString();
        const next = `/coal-storage${qs ? `?${qs}` : ''}`;
        router.replace(`/?next=${encodeURIComponent(next)}`);
    }, [loading, operator, searchParams, router]);

    if (loading || !operator) {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
                <p className="text-sm text-neutral-400 font-medium">Memuat…</p>
            </div>
        );
    }

    return (
        // AppShell membungkus halaman ini dengan bg gelap, jadi latar terangnya
        // dipasang sendiri di sini — sama seperti /logbook.
        <div className="min-h-screen bg-neutral-50 pb-24">
            <main className="max-w-7xl mx-auto px-4 sm:px-5 pt-5 sm:pt-8">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                                <span aria-hidden="true" className="material-symbols-outlined text-orange-500 text-xl">inventory_2</span>
                            </span>
                            <h1 className="text-base font-bold text-slate-800 leading-tight min-w-0">Storage Batubara</h1>
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-500 border border-slate-200 rounded-full px-2.5 py-1">
                            {formatTanggal(COAL_LOTS_UPDATED_AT)}
                        </span>
                    </div>

                    <RingkasanEstimasi lots={COAL_LOTS} />

                    {COAL_AREAS.map(area => (
                        <AreaDenah key={area.key} area={area} lots={COAL_LOTS} warna={warna} highlight={highlight} />
                    ))}

                    <SupplierLegend lots={COAL_LOTS} onHighlight={setHighlight} />
                </div>
            </main>
        </div>
    );
}
