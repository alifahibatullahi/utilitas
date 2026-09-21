'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { createClient } from '@/lib/supabase/client';
import { COAL_AREAS, formatTanggal, lotsSisa, petaWarnaSupplier, Sorotan } from '@/lib/coal-storage';
import { fetchDenah, type DenahData } from '@/lib/coal-storage-query';
import Toast from '@/components/ui/Toast';
import RingkasanEstimasi from '@/components/coal-storage/RingkasanEstimasi';
import AreaDenah from '@/components/coal-storage/AreaDenah';
import SupplierLegend from '@/components/coal-storage/SupplierLegend';
import UmurStok from '@/components/coal-storage/UmurStok';
import RiwayatLoading from '@/components/coal-storage/RiwayatLoading';
import ZonaEditor from '@/components/coal-storage/ZonaEditor';
import './coal-storage.css';

// Jeda minimum antar refetch otomatis saat tab dibuka lagi. Halaman ini sengaja
// tidak memakai realtime (tabel nyasar di publication pernah bikin API 522), jadi
// ini penggantinya: denah yang ditinggal semalam di layar kontrol ikut segar saat
// orangnya kembali, tanpa memukuli Supabase tiap kali jendela berpindah.
const JEDA_REFETCH_MS = 60_000;

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
    const [zonaTerpilih, setZonaTerpilih] = useState<string | null>(null);

    const [data, setData] = useState<DenahData | null>(null);
    const [memuat, setMemuat] = useState(true);
    const [galat, setGalat] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const terakhirFetch = useRef(0);

    const muat = useCallback(async () => {
        setMemuat(true);
        setGalat(null);
        try {
            setData(await fetchDenah(createClient()));
            terakhirFetch.current = Date.now();
        } catch (e) {
            // Sengaja TIDAK jatuh ke data contoh: denah yang salah tapi tampak
            // meyakinkan lebih berbahaya daripada denah yang jujur kosong.
            setGalat(e instanceof Error ? e.message : 'Gagal memuat data denah.');
        } finally {
            setMemuat(false);
        }
    }, []);

    useEffect(() => { if (operator) muat(); }, [operator, muat]);

    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            if (Date.now() - terakhirFetch.current < JEDA_REFETCH_MS) return;
            muat();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [muat]);

    const lots = useMemo(() => data?.lots ?? [], [data]);
    // Satu peta warna untuk seluruh halaman supaya denah, kartu detail, dan
    // legend memakai warna yang sama persis per supplier. Sengaja dihitung dari
    // daftar lot PENUH, bukan sisa: kalau tidak, warna supplier lain ikut
    // bergeser begitu satu supplier habis diambil.
    const warna = useMemo(() => petaWarnaSupplier(lots), [lots]);
    // Yang ditampilkan di denah adalah stok nyata: penempatan masuk − loading.
    const sisa = useMemo(() => lotsSisa(lots, data?.loadings ?? []), [lots, data]);

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

    const subjudul = galat ? 'gagal memuat data'
        : memuat && !data ? 'memuat…'
        : data?.diubahPada
            ? `data per ${formatTanggal(data.diubahPada.slice(0, 10))}`
                + (data.diubahOleh ? ` · terakhir diubah ${data.diubahOleh}` : '')
            : 'belum ada data';

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
                            <p className="text-[11px] text-neutral-400 font-medium truncate">
                                Estimasi penempatan supplier · {subjudul}
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

                    {galat ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center">
                            <p className="text-sm font-semibold text-red-800">Denah gagal dimuat</p>
                            <p className="text-[11px] text-red-600 mt-1">{galat}</p>
                            <button
                                type="button" onClick={muat}
                                className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs
                                    font-bold text-red-700 hover:bg-red-100 cursor-pointer transition-colors"
                            >
                                Coba lagi
                            </button>
                        </div>
                    ) : memuat && !data ? (
                        <DenahSkeleton />
                    ) : (
                        <>
                            <div className="cs-fade-up" style={{ animationDelay: '80ms' }}>
                                <RingkasanEstimasi lots={sisa} />
                            </div>

                            {COAL_AREAS.map((area, i) => (
                                <AreaDenah
                                    key={area.key} area={area} areaIndex={i} lots={sisa}
                                    warna={warna} highlight={highlight} onPilihZona={setZonaTerpilih}
                                />
                            ))}

                            <SupplierLegend lots={sisa} warna={warna} onSorot={setHighlight} />

                            {/* Dua tabel bersanding di bawah denah: kondisi sekarang (umur tiap
                                tumpukan) dan apa yang sudah diambil (riwayat loading). Riwayat
                                dapat daftar lot PENUH supaya tumpukan yang sudah habis pun masih
                                bisa dikenali suppliernya. */}
                            <div className="grid gap-3 lg:grid-cols-2 mt-6">
                                <UmurStok lots={sisa} warna={warna} onSorot={setHighlight} />
                                <RiwayatLoading lots={lots} loadings={data?.loadings ?? []} warna={warna} onSorot={setHighlight} />
                            </div>
                        </>
                    )}
                </div>
            </main>

            <ZonaEditor
                zonaId={zonaTerpilih}
                lots={sisa}
                warna={warna}
                operator={{ name: operator.name, supabaseId: operator.supabaseId }}
                onTutup={() => setZonaTerpilih(null)}
                onTersimpan={async (pesan) => { setToast(pesan); await muat(); }}
            />

            {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        </div>
    );
}

/** Rangka denah selagi data ditarik — supaya header tidak berkedip sendirian. */
function DenahSkeleton() {
    return (
        <div className="animate-pulse space-y-6" aria-hidden="true">
            <div className="h-16 rounded-xl bg-slate-100" />
            {[7, 12].map((n, area) => (
                <div key={area}>
                    <div className="h-14 rounded-xl bg-slate-200 mb-3" />
                    <div className="flex gap-px">
                        {Array.from({ length: n }, (_, i) => (
                            <div key={i} className="flex-1 h-[78px] rounded-[3px] bg-slate-100" />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
