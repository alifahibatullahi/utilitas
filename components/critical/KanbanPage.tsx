'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCriticalMaintenance } from '@/hooks/useCriticalMaintenance';
import { useOperator } from '@/hooks/useOperator';
import { HAR_SCOPES, FOREMAN_OPTIONS, SHIFT_OPTIONS, getShiftWindow, detectCurrentShift } from '@/lib/constants';
import type { HarScope, ForemanType } from '@/lib/supabase/types';
import KanbanBoard from './KanbanBoard';
import MaintenanceFormModal from './MaintenanceFormModal';

const SHIFT_LABELS: Record<string, string> = { malam: 'Malam', pagi: 'Pagi', sore: 'Sore' };

function toLocalDateStr(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function KanbanPage() {
    const router = useRouter();
    const { operator } = useOperator();
    const cm = useCriticalMaintenance();

    const [filterScope, setFilterScope] = useState<HarScope | ''>('');
    const [filterForeman, setFilterForeman] = useState<ForemanType | ''>('');
    const [showForm, setShowForm] = useState(false);

    const defaultShift = detectCurrentShift();
    const [selectedDate, setSelectedDate] = useState(defaultShift.date);
    const [selectedShift, setSelectedShift] = useState<'pagi' | 'sore' | 'malam'>(defaultShift.shift);

    const shiftWindow = getShiftWindow(selectedDate, selectedShift);

    // Apply filters
    const filtered = cm.maintenances.filter(m => {
        if (filterScope && m.scope !== filterScope) return false;
        if (filterForeman && m.foreman !== filterForeman) return false;
        return true;
    });

    const today = new Date();
    const dateStr = today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-3">
                    <div className="flex items-center justify-between">
                        {/* Left: logos + title */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/logo/Danantara_Indonesia_(no_SW).png" alt="Danantara" className="h-8 w-auto object-contain" />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/logo/Logo_Pupuk_Indonesia__Persero_-removebg-preview.png" alt="Pupuk Indonesia" className="h-8 w-auto object-contain" />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/logo/logo-PG-agro-trans-small-removebg-preview.png" alt="PG" className="h-8 w-auto object-contain" />
                            </div>
                            <div className="hidden md:block h-8 w-px bg-gray-200" />
                            <div>
                                <h1 className="text-base md:text-lg font-bold text-gray-800">Maintenance Board</h1>
                                <p className="text-[10px] md:text-xs text-gray-500">{dateStr}</p>
                            </div>
                        </div>

                        {/* Right: shift selector + filters + back */}
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            {/* Date picker */}
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="px-2 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs outline-none cursor-pointer"
                            />

                            {/* Shift tabs */}
                            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                                {SHIFT_OPTIONS.map(s => (
                                    <button
                                        key={s.value}
                                        onClick={() => setSelectedShift(s.value)}
                                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${selectedShift === s.value ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {SHIFT_LABELS[s.value]}
                                    </button>
                                ))}
                            </div>

                            <div className="w-px h-5 bg-gray-300 hidden md:block" />

                            {/* Scope filter */}
                            <select
                                value={filterScope}
                                onChange={e => setFilterScope(e.target.value as HarScope | '')}
                                className="px-2 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs outline-none cursor-pointer"
                            >
                                <option value="">Semua Scope</option>
                                {HAR_SCOPES.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>

                            {/* Foreman filter */}
                            <select
                                value={filterForeman}
                                onChange={e => setFilterForeman(e.target.value as ForemanType | '')}
                                className="hidden md:block px-2 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs outline-none cursor-pointer"
                            >
                                <option value="">Semua Foreman</option>
                                {FOREMAN_OPTIONS.map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>

                            {/* Add maintenance */}
                            <button
                                onClick={() => setShowForm(true)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                                <span className="hidden md:inline">Maintenance</span>
                            </button>

                            {/* Back to main */}
                            <button
                                onClick={() => router.push('/critical')}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-xs transition-colors cursor-pointer"
                                title="Kembali ke PowerOps"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
                                <span className="hidden md:inline text-[10px]">PowerOps</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Board content */}
            <main className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">
                {cm.loading ? (
                    <div className="flex items-center justify-center py-20 text-gray-400">
                        <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
                        <span className="ml-3 text-sm">Memuat data...</span>
                    </div>
                ) : (
                    <KanbanBoard
                        maintenances={filtered}
                        shiftWindow={shiftWindow}
                        onMoveStatus={cm.moveMaintenanceStatus}
                        onKonfirmasiShift={cm.konfirmasiShift}
                    />
                )}

                {/* Summary footer */}
                {!cm.loading && (
                    <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            Open: {filtered.filter(m => m.status === 'OPEN').length}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            In Progress: {filtered.filter(m => m.status === 'IP').length}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            Selesai: {filtered.filter(m => m.status === 'OK').length}
                        </span>
                    </div>
                )}
            </main>

            {/* Maintenance form modal — light theme version uses same dark modal for now */}
            <MaintenanceFormModal
                open={showForm}
                onClose={() => setShowForm(false)}
                onSubmit={cm.createMaintenance}
                activeCriticals={cm.criticals}
                operatorName={operator?.name}
            />
        </div>
    );
}
