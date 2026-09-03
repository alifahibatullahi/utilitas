'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { FluidKey, formatTanggal } from '@/lib/piping';
import { PIPING_LINES, PIPING_NODES, PIPING_UPDATED_AT } from '@/lib/piping-data';
import IsoDiagram from '@/components/piping/IsoDiagram';
import ServiceLegend from '@/components/piping/ServiceLegend';
import './piping.css';

// Penjaga login memakai useSearchParams → butuh Suspense.
export default function PipingRoute() {
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
    // Sorot kursor dan sorot terkunci dipisah: di HP tidak ada hover, jadi
    // ketukan pada legend harus mengunci sorotnya (lihat ServiceLegend).
    const [hover, setHover] = useState<FluidKey | null>(null);
    const [pin, setPin] = useState<FluidKey | null>(null);
    const highlight = pin ?? hover;

    // Belum login → ke halaman pilih operator dengan tujuan dititipkan di ?next=,
    // supaya link dari WA tetap mendarat di sini (pola /coal-storage).
    useEffect(() => {
        if (loading || operator) return;
        const qs = searchParams?.toString();
        const next = `/piping${qs ? `?${qs}` : ''}`;
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
        // dipasang sendiri di sini — sama seperti /coal-storage.
        <div className="min-h-screen bg-neutral-50 pb-24">
            <main className="max-w-7xl mx-auto px-4 sm:px-5 pt-5 sm:pt-8">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
                    {/* Header berlogo — pola sama dengan /coal-storage. Logo yang lebih
                        lebar disembunyikan bertahap di layar sempit supaya judul dan
                        tombol menu tetap kebagian ruang. */}
                    <div className="pp-fade-up flex items-center gap-3 mb-4">
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
                            <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-tight">Jalur Pipa Air</h1>
                            <p className="text-[11px] text-neutral-400 font-medium">
                                Gambar isometrik rute line · data per {formatTanggal(PIPING_UPDATED_AT)}
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

                    {/* Status isi gambar dipasang di muka: sebagian rute masih tebakan,
                        jadi jangan sampai terbaca sebagai gambar jadi. */}
                    <div className="pp-fade-up rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 mb-4 flex gap-2.5" style={{ animationDelay: '80ms' }}>
                        <span aria-hidden="true" className="material-symbols-outlined text-amber-500 shrink-0" style={{ fontSize: 18 }}>draw</span>
                        <p className="text-[11px] leading-relaxed text-amber-900">
                            <span className="font-bold">Rangka gambar — belum final.</span>{' '}
                            Yang sudah dipastikan hanya suplai dari Tangki RCW (cooling tower, air service, pemadam)
                            dan Tangki Demin → pompa demin → deaerator; itu digambar garis penuh. Rute lain, elevasi,
                            tag peralatan, dan nomor line masih sementara dan digambar putus-putus. Ukuran pipa,
                            valve, dan fitting belum dimasukkan, jadi gambar ini untuk orientasi — bukan acuan
                            fabrikasi.
                        </p>
                    </div>

                    <div className="pp-fade-up" style={{ animationDelay: '140ms' }}>
                        <IsoDiagram nodes={PIPING_NODES} lines={PIPING_LINES} highlight={highlight} />
                    </div>

                    <ServiceLegend
                        lines={PIPING_LINES}
                        highlight={highlight}
                        pin={pin}
                        onHover={setHover}
                        onPin={setPin}
                    />
                </div>
            </main>
        </div>
    );
}
