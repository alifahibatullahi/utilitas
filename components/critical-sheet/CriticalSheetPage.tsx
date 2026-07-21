'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import CriticalSheetList from './CriticalSheetList';
import MaintenanceSheetList from './MaintenanceSheetList';

/**
 * Viewer Critical Maintenance — data & input tinggal di Google Sheets, halaman ini
 * hanya menampilkan (plus upload foto). Data di-cache server 60 detik; tombol
 * "Perbarui data" memaksa baca ulang dari sheet.
 */
export default function CriticalSheetPage() {
    const router = useRouter();
    const [tab, setTab] = useState<'critical' | 'maintenance'>('critical');
    const [reloadKey, setReloadKey] = useState(0);
    const [fetchedAt, setFetchedAt] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const onMeta = useCallback((at: string) => setFetchedAt(at), []);

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
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg font-bold text-slate-800 leading-tight">Critical Maintenance</h1>
                        <p className="text-[11px] text-slate-400 font-medium">
                            Sumber data: Google Sheets · input tetap di spreadsheet
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

                {/* Tabs */}
                <div className="flex rounded-xl bg-slate-200/60 p-1 mb-4">
                    {([
                        { id: 'critical', label: 'Critical', icon: 'warning' },
                        { id: 'maintenance', label: 'Riwayat Maintenance', icon: 'build' },
                    ] as const).map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'critical'
                    ? <CriticalSheetList reloadKey={reloadKey} onMeta={onMeta} />
                    : <MaintenanceSheetList reloadKey={reloadKey} onMeta={onMeta} />}
            </div>
        </div>
    );
}
