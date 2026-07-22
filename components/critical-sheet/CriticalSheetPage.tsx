'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ItemList from './ItemList';
import ItemDetail from './ItemDetail';
import type { SheetItem } from './types';

/**
 * Viewer Critical Maintenance — item-centric. Data & input tinggal di Google Sheets;
 * halaman ini menampilkan riwayat critical/maintenance/foto + spesifikasi per item.
 * Item aktif disimpan di query `?item=<key>` supaya tombol back browser & deep-link jalan.
 */
export default function CriticalSheetPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeKey = searchParams.get('item');

    const [reloadKey, setReloadKey] = useState(0);
    const [fetchedAt, setFetchedAt] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const onMeta = useCallback((at: string) => setFetchedAt(at), []);

    // Reset stempel waktu saat pindah antara list ↔ detail (masing-masing punya fetchedAt sendiri).
    useEffect(() => { setFetchedAt(null); }, [activeKey]);

    function selectItem(item: SheetItem) {
        router.push(`/critical-maintenance?item=${encodeURIComponent(item.key)}`);
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
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => router.push('/home')}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                        aria-label="Kembali ke menu"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>home</span>
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg font-bold text-slate-800 leading-tight">Critical Maintenance</h1>
                        <p className="text-[11px] text-slate-400 font-medium">
                            Riwayat & spesifikasi per item · sumber data Google Sheets
                            {stamp && <span> · data per {stamp}</span>}
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 cursor-pointer transition-colors shrink-0"
                        title="Baca ulang data dari spreadsheet"
                    >
                        <span className={`material-symbols-outlined ${refreshing ? 'animate-spin' : ''}`} style={{ fontSize: 16 }}>refresh</span>
                        <span className="hidden sm:inline">{refreshing ? 'Memuat…' : 'Perbarui data'}</span>
                    </button>
                </div>

                {activeKey
                    ? <ItemDetail itemKey={activeKey} reloadKey={reloadKey} onBack={back} />
                    : <ItemList reloadKey={reloadKey} onSelect={selectItem} onMeta={onMeta} />}
            </div>
        </div>
    );
}
