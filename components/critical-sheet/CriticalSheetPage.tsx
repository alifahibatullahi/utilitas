'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RecordBrowser from './RecordBrowser';
import ItemDetail from './ItemDetail';
import RecordPhotoModal, { photoTargetOf, type PhotoRecordTarget } from './RecordPhotoModal';
import { fetchFocusRecord, readPhotoFocus } from './types';

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
    const wantsRefresh = searchParams.get('refresh') === '1';

    const [reloadKey, setReloadKey] = useState(0);
    const [fetchedAt, setFetchedAt] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    /**
     * Record yang ditunjuk tautan dari spreadsheet — ditangkap SEKALI saat mount, karena
     * param-nya langsung dibuang dari URL di bawah. Pop up-nya dimiliki halaman ini, bukan
     * halaman item: operator yang datang dari menu spreadsheet harus mendarat di pop up
     * recordnya, bukan menunggu seluruh riwayat item termuat lalu mencari barisnya sendiri.
     */
    const [focus, setFocus] = useState(() => readPhotoFocus(searchParams));
    const [focusRecord, setFocusRecord] = useState<PhotoRecordTarget | null>(null);
    const [focusError, setFocusError] = useState<string | null>(null);
    /** `?refresh=1` harus selesai dulu: baris yang baru diketik belum ada di cermin. */
    const [needsSync] = useState(wantsRefresh);
    const [syncDone, setSyncDone] = useState(false);

    const onMeta = useCallback((at: string) => setFetchedAt(at), []);

    // Reset stempel waktu saat pindah antara list ↔ detail (masing-masing punya fetchedAt sendiri).
    useEffect(() => { setFetchedAt(null); }, [activeKey]);

    /**
     * Buang param sekali-pakai dari URL tanpa menambah entri history.
     *
     * Query-nya disimpan di ref, bukan dibaca ulang dari `searchParams`/`window.location`
     * tiap panggilan: `router.replace` baru mengubah URL setelah navigasinya commit,
     * sedangkan halaman ini memanggil pembersih DUA kali (param fokus saat mount, param
     * refresh setelah POST-nya selesai). Tanpa ref, panggilan kedua menghitung URL dari
     * alamat yang belum berubah dan mengembalikan param yang baru saja dibuang.
     */
    const queryRef = useRef<URLSearchParams | null>(null);
    const stripParams = useCallback((names: string[]) => {
        const next = queryRef.current ?? new URLSearchParams(window.location.search);
        for (const n of names) next.delete(n);
        queryRef.current = next;
        const qs = next.toString();
        router.replace(qs ? `/critical-maintenance?${qs}` : '/critical-maintenance', { scroll: false });
    }, [router]);

    // Param fokus dibuang begitu tertangkap: isinya sudah ada di state, dan URL yang bersih
    // membuat reload/refetch tidak membuka ulang pop up yang sudah ditutup operator.
    const focusStripped = useRef(false);
    useEffect(() => {
        if (!focus || focusStripped.current) return;
        focusStripped.current = true;
        stripParams(['foto', 'kind', 'row', 'sig']);
    }, [focus, stripParams]);

    // Cari barisnya langsung ke cermin — satu query kecil, tidak menunggu halaman di
    // belakangnya. Baris berfoto ditemukan lewat uid, baris yang belum berfoto lewat
    // nomor baris + sidik jari (aturan yang sama dengan saat fotonya nanti disimpan).
    useEffect(() => {
        if (!focus || (needsSync && !syncDone)) return;
        let cancelled = false;
        fetchFocusRecord(focus)
            .then(r => { if (!cancelled) setFocusRecord(photoTargetOf(r)); })
            .catch(err => { if (!cancelled) setFocusError(err instanceof Error ? err.message : 'Gagal membuka record'); });
        return () => { cancelled = true; };
    }, [focus, needsSync, syncDone]);

    /** Tutup pop up deep-link: fokusnya selesai, dan daftar di belakang dibaca ulang
     *  supaya jumlah foto yang baru ikut terlihat. */
    const closeFocus = useCallback(() => {
        setFocus(null);
        setFocusRecord(null);
        setReloadKey(k => k + 1);
    }, []);

    /**
     * `?refresh=1` datang dari menu di spreadsheet: baris yang BARU diketik operator
     * belum tentu ada di cache loader (TTL 5 menit), dan ID-nya belum di-backfill.
     * Dijalankan sekali lalu paramnya dibuang dari URL supaya reload tidak memicu lagi.
     * Server tetap punya rem sendiri (MIN_FORCE_INTERVAL_MS) bila banyak operator
     * membuka menu bersamaan. `tab` ikut dibuang: link lama dari spreadsheet masih
     * membawa `?tab=recent` yang sekarang tidak berarti apa-apa (daftar record sudah
     * jadi tampilan awal).
     */
    const refreshHandled = useRef(false);
    useEffect(() => {
        // `needsSync`, bukan `wantsRefresh`: paramnya sudah dibuang lebih dulu oleh
        // pembersih fokus di atas, dan sinkronisasinya tetap harus jalan.
        if (!needsSync || refreshHandled.current) return;
        refreshHandled.current = true;
        setRefreshing(true);
        fetch('/api/critical-maintenance/refresh', { method: 'POST' })
            .catch(() => { /* daftar akan menampilkan errornya sendiri */ })
            .finally(() => {
                setRefreshing(false);
                setSyncDone(true);
                setReloadKey(k => k + 1);
                stripParams(['refresh', 'tab']);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needsSync]);

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

                {/* Tautan dari spreadsheet yang gagal dibuka HARUS berbunyi: tanpa ini
                    kegagalannya cuma terlihat sebagai "pop up-nya tidak muncul". */}
                {focusError && (
                    <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                        <span className="material-symbols-outlined text-red-500 shrink-0" style={{ fontSize: 18 }}>error</span>
                        <p className="flex-1 text-sm text-red-700 font-medium">{focusError}</p>
                        <button
                            onClick={() => setFocusError(null)}
                            className="shrink-0 w-6 h-6 rounded-lg text-red-400 hover:bg-red-100 flex items-center justify-center cursor-pointer transition-colors"
                            aria-label="Tutup pesan"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                        </button>
                    </div>
                )}

                {activeKey
                    ? <ItemDetail
                        itemKey={activeKey}
                        reloadKey={reloadKey}
                        onBack={back}
                    />
                    : <RecordBrowser
                        reloadKey={reloadKey}
                        onSelect={selectItem}
                        onMeta={onMeta}
                    />}
            </div>

            {/* Pop up record dari spreadsheet. Kerangkanya tampil lebih dulu supaya yang
                pertama dilihat operator memang pop up-nya — isinya menyusul, halaman di
                belakang memuat sendiri. */}
            {focus && !focusRecord && !focusError && <FocusSkeleton />}
            {focusRecord && (
                <RecordPhotoModal
                    key={focusRecord.uid || `${focusRecord.kind}:${focusRecord.rowIndex}`}
                    record={focusRecord}
                    onClose={closeFocus}
                />
            )}
        </div>
    );
}

/** Bentuk kasar RecordPhotoModal selagi barisnya dicari — ukuran & sudutnya sengaja sama,
 *  jadi pop up-nya tidak "melompat" saat isinya datang. */
function FocusSkeleton() {
    return (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
            <div className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl px-4 sm:px-5 py-4" aria-busy="true">
                <div className="h-6 w-40 rounded-lg bg-neutral-200 animate-pulse" />
                <div className="h-5 w-3/4 rounded bg-neutral-200 animate-pulse mt-3" />
                <div className="h-4 w-1/2 rounded bg-neutral-100 animate-pulse mt-2" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-5">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="aspect-square rounded-xl bg-neutral-200 animate-pulse" />
                    ))}
                </div>
                <p className="text-[11px] font-bold text-neutral-400 mt-4">Membuka record dari spreadsheet…</p>
            </div>
        </div>
    );
}
