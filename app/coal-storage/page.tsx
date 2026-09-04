'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import {
    COAL_AREAS, formatTanggal, lotsSisa, petaWarnaSupplier, Sorotan, TON_PER_SHOVEL,
} from '@/lib/coal-storage';
import { COAL_LOTS, COAL_LOTS_UPDATED_AT } from '@/lib/coal-storage-data';
import { COAL_LOADINGS } from '@/lib/coal-loading-data';
import RingkasanEstimasi from '@/components/coal-storage/RingkasanEstimasi';
import AreaDenah from '@/components/coal-storage/AreaDenah';
import SupplierLegend from '@/components/coal-storage/SupplierLegend';
import UmurStok from '@/components/coal-storage/UmurStok';
import RiwayatLoading from '@/components/coal-storage/RiwayatLoading';
import './coal-storage.css';

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
    const [highlight, setHighlight] = useState<Sorotan | null>(null);
    // Satu peta warna untuk seluruh halaman supaya denah, kartu detail, dan
    // legend memakai warna yang sama persis per supplier. Sengaja dihitung dari
    // daftar lot PENUH, bukan sisa: kalau tidak, warna supplier lain ikut
    // bergeser begitu satu supplier habis diambil.
    const warna = useMemo(() => petaWarnaSupplier(COAL_LOTS), []);
    // Yang ditampilkan di denah adalah stok nyata: penempatan masuk − loading.
    const sisa = useMemo(() => lotsSisa(COAL_LOTS, COAL_LOADINGS), []);
    const diambilTon = useMemo(
        () => COAL_LOADINGS.reduce((t, l) => t + l.shovel * TON_PER_SHOVEL, 0), []);

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
                    {/* Header berlogo — pola sama dengan /critical-maintenance. Logo yang
                        lebih lebar disembunyikan bertahap di layar sempit supaya judul
                        dan tombol menu tetap kebagian ruang. */}
                    <div className="cs-fade-up flex items-center gap-3 mb-4">
                        <div className="flex items-center gap-2 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo/Danantara_Indonesia_(no_SW).png" alt="Danantara" className="h-7 w-auto object-contain hidden lg:block" />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo/Logo_Pupuk_Indonesia__Persero_-removebg-preview.png" alt="Pupuk Indonesia" className="h-7 w-auto object-contain hidden sm:block" />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo/logo-PG-agro-trans-small-removebg-preview.png" alt="Petrokimia Gresik" className="h-7 w-auto object-contain" />
                        </div>
                        <div className="hidden sm:block h-8 w-px bg-neutral-200 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-tight">Storage Batubara</h1>
                            <p className="text-[11px] text-neutral-400 font-medium">
                                Estimasi penempatan supplier · data per {formatTanggal(COAL_LOTS_UPDATED_AT)}
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/home')}
                            className="w-9 h-9 rounded-xl bg-white border border-neutral-300 text-neutral-500 hover:bg-neutral-100 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                            aria-label="Kembali ke menu"
                            title="Kembali ke menu"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>home</span>
                        </button>
                    </div>

                    <div className="cs-fade-up" style={{ animationDelay: '80ms' }}>
                        <RingkasanEstimasi lots={sisa} diambilTon={diambilTon} />
                    </div>

                    {COAL_AREAS.map((area, i) => (
                        <AreaDenah key={area.key} area={area} areaIndex={i} lots={sisa} warna={warna} highlight={highlight} />
                    ))}

                    <SupplierLegend lots={sisa} warna={warna} onSorot={setHighlight} />

                    {/* Dua tabel bersanding di bawah denah: kondisi sekarang (umur tiap
                        tumpukan) dan apa yang sudah diambil (riwayat loading). Riwayat
                        dapat daftar lot PENUH supaya tumpukan yang sudah habis pun masih
                        bisa dikenali suppliernya. */}
                    <div className="grid gap-3 lg:grid-cols-2 mt-6">
                        <UmurStok lots={sisa} warna={warna} onSorot={setHighlight} />
                        <RiwayatLoading lots={COAL_LOTS} loadings={COAL_LOADINGS} warna={warna} onSorot={setHighlight} />
                    </div>
                </div>
            </main>
        </div>
    );
}
