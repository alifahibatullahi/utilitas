'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RecordBrowser from './RecordBrowser';
import ItemDetail from './ItemDetail';

/**
 * Viewer Critical Maintenance. Data & input tinggal di Google Sheets; halaman ini
 * mendarat di daftar record critical + maintenance (tabel berkolom seperti sheet),
 * dan halaman item (riwayat + spesifikasi + galeri foto) ada di balik `?item=<key>`
 * supaya tombol back browser & deep-link jalan.
 */
export default function CriticalSheetPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeKey = searchParams.get('item');
    const focusUid = searchParams.get('foto');
    const wantsRefresh = searchParams.get('refresh') === '1';

    const [reloadKey, setReloadKey] = useState(0);
    const [fetchedAt, setFetchedAt] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const onMeta = useCallback((at: string) => setFetchedAt(at), []);

    // Reset stempel waktu saat pindah antara list ↔ detail (masing-masing punya fetchedAt sendiri).
    useEffect(() => { setFetchedAt(null); }, [activeKey]);

    /** Buang param sekali-pakai dari URL tanpa menambah entri history. */
    const stripParams = useCallback((names: string[]) => {
        const next = new URLSearchParams(Array.from(searchParams.entries()));
        for (const n of names) next.delete(n);
        const qs = next.toString();
        router.replace(qs ? `/critical-maintenance?${qs}` : '/critical-maintenance', { scroll: false });
    }, [router, searchParams]);

    const handleFocusHandled = useCallback(() => stripParams(['foto']), [stripParams]);

    /**
     * `?refresh=1` datang dari menu di spreadsheet: baris yang BARU diketik operator
     * belum tentu ada di cache loader (TTL 60 detik), dan ID-nya belum di-backfill.
     * Dijalankan sekali lalu paramnya dibuang dari URL supaya reload tidak memicu lagi.
     * Server tetap punya rem sendiri (MIN_FORCE_INTERVAL_MS) bila banyak operator
     * membuka menu bersamaan. `tab` ikut dibuang: link lama dari spreadsheet masih
     * membawa `?tab=recent` yang sekarang tidak berarti apa-apa (daftar record sudah
     * jadi tampilan awal).
     */
    const refreshHandled = useRef(false);
    useEffect(() => {
        if (!wantsRefresh || refreshHandled.current) return;
        refreshHandled.current = true;
        setRefreshing(true);
        fetch('/api/critical-maintenance/refresh', { method: 'POST' })
            .catch(() => { /* daftar akan menampilkan errornya sendiri */ })
            .finally(() => {
                setRefreshing(false);
                setReloadKey(k => k + 1);
                stripParams(['refresh', 'tab']);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wantsRefresh]);

    function selectItem(key: string) {
        router.push(`/critical-maintenance?item=${encodeURIComponent(key)}`);
    }
    function back() {
        router.push('/critical-maintenance');
    }

    async function handleRefresh() {
        setRefreshing(true);
        try {
            await fetch('/api/critical-maintenance/refresh', { method: 'POST' });
        } catch { /* list akan tampilkan errornya sendiri saat refetch */ }
        setReloadKey(k => k + 1);
        setRefreshing(false);
    }

    const stamp = fetchedAt
        ? new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : null;

    return (
        <div className="min-h-screen bg-neutral-50">
            {/* Kedua tampilan sama-sama tabel berkolom; halaman item malah harus berbagi
                baris dengan sidebar spesifikasi, jadi lebarnya tidak boleh disempitkan. */}
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    {/* Logo perusahaan — pola sama dengan header /critical (CriticalPage).
                        Danantara disembunyikan di layar sempit supaya judul tetap kebagian ruang. */}
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
                        <h1 className="text-base sm:text-xl font-bold text-neutral-900 leading-tight">Critical Maintenance Utilitas Batubara</h1>
                        <p className="text-[11px] text-neutral-400 font-medium">
                            Daftar critical & maintenance · sumber data Google Sheets
                            {stamp && <span> · data per {stamp}</span>}
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-neutral-300 text-xs font-bold text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 cursor-pointer transition-colors shrink-0"
                        title="Baca ulang data dari spreadsheet"
                    >
                        <span className={`material-symbols-outlined ${refreshing ? 'animate-spin' : ''}`} style={{ fontSize: 16 }}>refresh</span>
                        <span className="hidden sm:inline">{refreshing ? 'Memuat…' : 'Perbarui data'}</span>
                    </button>
                    <button
                        onClick={() => router.push('/home')}
                        className="w-9 h-9 rounded-xl bg-white border border-neutral-300 text-neutral-500 hover:bg-neutral-100 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                        aria-label="Kembali ke menu"
                        title="Kembali ke menu"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>home</span>
                    </button>
                </div>

                {activeKey
                    ? <ItemDetail
                        itemKey={activeKey}
                        reloadKey={reloadKey}
                        onBack={back}
                        focusUid={focusUid}
                        onFocusHandled={handleFocusHandled}
                    />
                    : <RecordBrowser
                        reloadKey={reloadKey}
                        onSelect={selectItem}
                        onMeta={onMeta}
                    />}
            </div>
        </div>
    );
}
