'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCriticalMaintenance } from '@/hooks/useCriticalMaintenance';
import { useOperator } from '@/hooks/useOperator';
import { SHIFT_OPTIONS, getShiftWindow, detectCurrentShift } from '@/lib/constants';
import type { CriticalWithMaintenance, MaintenanceWithCritical, MaintenanceLogRow, PhotoRow } from '@/lib/supabase/types';
import KanbanBoard from './KanbanBoard';
import HistoryView from './HistoryView';
import CriticalTableView from './CriticalTableView';
import CriticalFormModal from './CriticalFormModal';
import MaintenanceFormModal from './MaintenanceFormModal';

function HeaderOperatorSelect() {
    const { operator, operators, login } = useOperator();
    const sorted = [...operators].sort((a,b) => a.name.localeCompare(b.name));
    
    return (
        <div className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 shadow-sm transition-colors hover:bg-gray-200 focus-within:ring-2 focus-within:ring-blue-500/20">
            <span className="material-symbols-outlined text-gray-500" style={{ fontSize: 16 }}>person</span>
            <select
                value={operator?.id || ''}
                onChange={e => {
                    const op = operators.find(o => String(o.id) === e.target.value);
                    if (op) login(op);
                }}
                className="bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer pr-4 appearance-none hover:text-gray-900"
            >
                <option value="" disabled>Login Sebagai...</option>
                {sorted.map(op => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                ))}
            </select>
            <span className="material-symbols-outlined absolute right-2 text-gray-400 pointer-events-none hidden sm:block" style={{ fontSize: 14, right: 8 }}>expand_more</span>
        </div>
    );
}

export default function CriticalPage() {
    const router = useRouter();
    const { operator } = useOperator();
    const cm = useCriticalMaintenance();

    const [view, setView] = useState<'history' | 'board'>('history');

    // Shift selector for board view
    const defaultShift = detectCurrentShift();
    const [boardDate, setBoardDate] = useState(defaultShift.date);
    const [boardShift, setBoardShift] = useState<'pagi' | 'sore' | 'malam'>(defaultShift.shift);
    const shiftWindow = getShiftWindow(boardDate, boardShift);

    // Modal state
    const [showCriticalForm, setShowCriticalForm] = useState(false);
    const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
    // Edit state
    const [editingCritical, setEditingCritical] = useState<CriticalWithMaintenance | null>(null);
    const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceWithCritical | null>(null);
    const [maintenanceInitial, setMaintenanceInitial] = useState<Partial<Omit<MaintenanceLogRow, 'id' | 'created_at' | 'updated_at'>> | undefined>(undefined);

    // Apply basic Kanban filters (no scope/foreman filters applied anymore per user request)
    const filteredKanban = cm.maintenances;

    // Photos for Kanban board
    const [photosByMaintId, setPhotosByMaintId] = useState<Record<string, PhotoRow[]>>({});
    useEffect(() => {
        if (view !== 'board') return;
        const ids = cm.maintenances.map(m => m.id);
        cm.fetchPhotosForMaintList(ids).then(setPhotosByMaintId);
    }, [view, cm.maintenances]); // eslint-disable-line react-hooks/exhaustive-deps

    const today = new Date();
    const dateStr = today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="min-h-screen bg-[#f8f9fb]">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
                <div className="max-w-[1600px] mx-auto px-4 py-3">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        {/* Left: logos + title */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/logo/Danantara_Indonesia_(no_SW).png" alt="Danantara" className="h-7 w-auto object-contain hidden lg:block" />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/logo/Logo_Pupuk_Indonesia__Persero_-removebg-preview.png" alt="Pupuk Indonesia" className="h-7 w-auto object-contain" />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/logo/logo-PG-agro-trans-small-removebg-preview.png" alt="PG" className="h-7 w-auto object-contain" />
                            </div>
                            <div className="hidden sm:block h-8 w-px bg-gray-200" />
                            <div>
                                <h1 className="text-base md:text-lg font-extrabold tracking-tight text-gray-800 leading-tight">Critical & Maintenance</h1>
                                <p className="text-[10px] md:text-xs font-semibold text-gray-500">{dateStr}</p>
                            </div>
                        </div>

                        {/* Middle: Tab Toggle */}
                        <div className="flex bg-gray-100/80 p-1.5 rounded-xl border border-gray-200/60 shadow-inner max-w-fit mx-auto xl:mx-0">
                            <button
                                onClick={() => setView('history')}
                                className={`flex items-center px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                                    view === 'history' ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 shadow-transparent'
                                }`}
                            >
                                <span className="material-symbols-outlined mr-2" style={{ fontSize: 18 }}>table_view</span>
                                Critical
                            </button>
                            <button
                                onClick={() => setView('board')}
                                className={`flex items-center px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                                    view === 'board' ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 shadow-transparent'
                                }`}
                            >
                                <span className="material-symbols-outlined mr-2" style={{ fontSize: 18 }}>view_kanban</span>
                                Maintenance
                            </button>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar justify-end">
                            {view === 'board' && (
                                <>
                                    <button
                                        onClick={() => setShowMaintenanceForm(true)}
                                        className="whitespace-nowrap flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition-colors shadow-sm cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>build</span>
                                        + Tambah Maintenance
                                    </button>
                                    <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>
                                </>
                            )}
                            <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>
                            
                            {/* NEW: Operator Select */}
                            <div className="relative flex items-center">
                                <HeaderOperatorSelect />
                            </div>

                            <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>

                            <button
                                onClick={() => router.push('/dashboard')}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                                title="Kembali ke PowerOps"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                                <span className="hidden sm:inline">PowerOps</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-[1600px] mx-auto px-4 py-6 min-h-[calc(100vh-100px)] flex flex-col">
                {cm.loading ? (
                    <div className="flex flex-col flex-1 items-center justify-center text-gray-400">
                        <span className="material-symbols-outlined animate-spin text-4xl mb-3 text-blue-500">progress_activity</span>
                        <span className="text-sm font-bold">Memuat data...</span>
                    </div>
                ) : (
                    <>
                        {view === 'history' && (
                            <div className="w-full flex-1 transition-all animate-in fade-in zoom-in-95 duration-300">
                                <CriticalTableView
                                    criticals={cm.criticals}
                                    onEditCritical={(c) => setEditingCritical(c)}
                                    onDeleteCritical={async (id) => { await cm.deleteCritical(id); }}
                                    onAddCritical={() => setShowCriticalForm(true)}
                                    onEditMaintenance={(m) => setEditingMaintenance({ ...m, critical_equipment: null })}
                                    onDeleteMaintenance={async (id) => { await cm.deleteMaintenance(id, operator?.name); }}
                                    onAddMaintenance={(critical) => {
                                        setMaintenanceInitial({
                                            critical_id: critical.id,
                                            item: critical.item,
                                            scope: critical.scope,
                                            foreman: critical.foreman,
                                            date: new Date().toISOString().split('T')[0],
                                        });
                                        setShowMaintenanceForm(true);
                                    }}
                                    fetchPhotos={cm.fetchPhotos}
                                    deletePhoto={cm.deletePhoto}
                                    operatorName={operator?.name}
                                />
                            </div>
                        )}

                        {view === 'board' && (
                            <div className="w-full flex-1 flex flex-col transition-all animate-in fade-in zoom-in-95 duration-300">
                                {/* Shift selector — centered above columns */}
                                <div className="flex items-center justify-center gap-3 mb-5">
                                    <input
                                        type="date"
                                        value={boardDate}
                                        onChange={e => setBoardDate(e.target.value)}
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-medium outline-none cursor-pointer shadow-sm"
                                    />
                                    <div className="flex bg-gray-100 rounded-xl p-1 gap-1 border border-gray-200 shadow-inner">
                                        {SHIFT_OPTIONS.map(s => (
                                            <button
                                                key={s.value}
                                                onClick={() => setBoardShift(s.value)}
                                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${boardShift === s.value ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                {s.value.charAt(0).toUpperCase() + s.value.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <KanbanBoard
                                    maintenances={filteredKanban}
                                    shiftWindow={shiftWindow}
                                    onMoveStatus={cm.moveMaintenanceStatus}
                                    onKonfirmasiShift={cm.konfirmasiShift}
                                    photosByMaintId={photosByMaintId}
                                />
                                {/* Summary footer */}
                                <div className="mt-8 flex items-center justify-center gap-6 text-xs text-gray-500 bg-white py-2 px-6 rounded-full shadow-sm w-fit mx-auto border border-gray-200">
                                    <span className="flex items-center gap-2 font-bold">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/30" />
                                        Open: {filteredKanban.filter(m => m.status === 'OPEN').length}
                                    </span>
                                    <span className="flex items-center gap-2 font-bold">
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/30" />
                                        In Progress: {filteredKanban.filter(m => m.status === 'IP').length}
                                    </span>
                                    <span className="flex items-center gap-2 font-bold">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30" />
                                        Selesai: {filteredKanban.filter(m => m.status === 'OK').length}
                                    </span>
                                </div>
                            </div>
                        )}


                    </>
                )}
            </main>

            {/* Modals — create */}
            <CriticalFormModal
                key={showCriticalForm ? 'critical-open' : 'critical-closed'}
                open={showCriticalForm}
                onClose={() => setShowCriticalForm(false)}
                onSubmit={cm.createCritical}
                operatorName={operator?.name}
            />
            <MaintenanceFormModal
                key={showMaintenanceForm ? `open-${maintenanceInitial?.critical_id ?? 'none'}` : 'closed'}
                open={showMaintenanceForm}
                onClose={() => { setShowMaintenanceForm(false); setMaintenanceInitial(undefined); }}
                onSubmit={cm.createMaintenance}
                activeCriticals={cm.criticals}
                initial={maintenanceInitial}
                operatorName={operator?.name}
            />
            {/* Modals — edit */}
            {editingCritical && (
                <CriticalFormModal
                    open={true}
                    onClose={() => setEditingCritical(null)}
                    initial={editingCritical}
                    onSubmit={async (data) => {
                        const res = await cm.updateCritical(editingCritical.id, data, operator?.name);
                        if (!res.error) setEditingCritical(null);
                        return res;
                    }}
                    operatorName={operator?.name}
                />
            )}
            {editingMaintenance && (
                <MaintenanceFormModal
                    open={true}
                    onClose={() => setEditingMaintenance(null)}
                    initial={editingMaintenance}
                    activeCriticals={cm.criticals}
                    onSubmit={async (data) => {
                        const res = await cm.updateMaintenance(editingMaintenance.id, data, operator?.name);
                        if (!res.error) setEditingMaintenance(null);
                        return res;
                    }}
                    operatorName={operator?.name}
                />
            )}
        </div>
    );
}
