'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCriticalMaintenance } from '@/hooks/useCriticalMaintenance';
import { useOperator } from '@/hooks/useOperator';
import { HAR_SCOPES, FOREMAN_OPTIONS, SHIFT_OPTIONS, getShiftWindow, detectCurrentShift } from '@/lib/constants';
import type { HarScope, ForemanType } from '@/lib/supabase/types';
import KanbanBoard from './KanbanBoard';
import MaintenanceFormModal from './MaintenanceFormModal';
import CustomCalendarPopover from './CustomCalendarPopover';
import CriticalDetailModal from './CriticalDetailModal';
import WorkOrderDetailModal from './WorkOrderDetailModal';

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
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    // Detail modal & edit states
    const [expandedCriticalId, setExpandedCriticalId] = useState<string | null>(null);
    const [expandedWOId, setExpandedWOId] = useState<string | null>(null);
    const [editingMaintenance, setEditingMaintenance] = useState<any>(null);
    const [maintenanceInitial, setMaintenanceInitial] = useState<any>(null);
    const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
    const [returnToDetailId, setReturnToDetailId] = useState<string | null>(null);
    const [returnToWOId, setReturnToWOId] = useState<string | null>(null);

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
                        <div className="flex items-center gap-3 flex-wrap justify-end">
                            {/* Unified Navigation Island */}
                            <div className="flex items-center p-1.5 bg-slate-100/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-sm">
                                {/* Date Navigator */}
                                <div className="flex items-center h-9 bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
                                    <button
                                        onClick={() => {
                                            const [y, m, d] = selectedDate.split('-').map(Number);
                                            const prev = new Date(y, m - 1, d - 1);
                                            const pad = (n: number) => String(n).padStart(2, '0');
                                            setSelectedDate(`${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`);
                                        }}
                                        className="px-2.5 h-full flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-800 cursor-pointer transition-colors border-r border-slate-100"
                                        title="Tanggal sebelumnya"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                                    </button>
                                    <button
                                        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                        className="flex items-center gap-2 px-3 h-full cursor-pointer hover:bg-slate-50/80 transition-colors text-left"
                                        title="Pilih tanggal"
                                    >
                                        <span className="material-symbols-outlined text-blue-500" style={{ fontSize: 16 }}>calendar_month</span>
                                        <span className="text-sm font-black text-slate-700 tracking-tight">
                                            {(() => {
                                                const [y, m, d] = selectedDate.split('-').map(Number);
                                                const dt = new Date(y, m - 1, d);
                                                return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                                            })()}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const [y, m, d] = selectedDate.split('-').map(Number);
                                            const next = new Date(y, m - 1, d + 1);
                                            const pad = (n: number) => String(n).padStart(2, '0');
                                            setSelectedDate(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`);
                                        }}
                                        className="px-2.5 h-full flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-800 cursor-pointer transition-colors border-l border-slate-100"
                                        title="Tanggal berikutnya"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                                    </button>
                                    <CustomCalendarPopover
                                        value={selectedDate}
                                        onChange={setSelectedDate}
                                        isOpen={isCalendarOpen}
                                        onClose={() => setIsCalendarOpen(false)}
                                    />
                                </div>

                                {/* Hari Ini Indicator / Shortcut */}
                                {(() => {
                                    const now = detectCurrentShift();
                                    if (selectedDate !== now.date) {
                                        return null;
                                    } else {
                                        return (
                                            <div className="ml-2.5 mr-1 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-100/50 text-emerald-700 text-[10px] font-black uppercase tracking-wider border border-emerald-200/50" title="Tanggal hari ini">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
                                                HARI INI
                                            </div>
                                        );
                                    }
                                })()}

                                {/* Vertical Divider */}
                                <div className="w-px h-6 bg-slate-300/60 mx-2.5" />

                                {/* Shift Tabs */}
                                <div className="flex items-center gap-1 h-9">
                                    {SHIFT_OPTIONS.map(s => {
                                        const now = detectCurrentShift();
                                        const isCurrentRealShift = selectedDate === now.date && s.value === now.shift;
                                        const active = selectedShift === s.value;
                                        const shiftIcons: Record<string, string> = { pagi: 'light_mode', sore: 'wb_twilight', malam: 'dark_mode' };
                                        const shiftColors: Record<string, string> = { pagi: 'text-amber-500', sore: 'text-orange-500', malam: 'text-indigo-500' };

                                        return (
                                            <button
                                                key={s.value}
                                                onClick={() => setSelectedShift(s.value)}
                                                className={`relative flex items-center gap-1.5 px-3.5 h-full rounded-xl text-[13px] font-black transition-all cursor-pointer whitespace-nowrap overflow-hidden ${
                                                    active
                                                        ? 'bg-white text-slate-800 shadow-sm border border-slate-200/80'
                                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 border border-transparent'
                                                }`}
                                                title={isCurrentRealShift ? 'Shift saat ini (berlangsung)' : undefined}
                                            >
                                                {active && (
                                                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500" />
                                                )}
                                                <span className={`material-symbols-outlined ${shiftColors[s.value]}`} style={{ fontSize: 16 }}>
                                                    {shiftIcons[s.value]}
                                                </span>
                                                {SHIFT_LABELS[s.value]}
                                                {isCurrentRealShift && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50 ml-0.5" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
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
                                title="Kembali ke Web Utilitas Batubara"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
                                <span className="hidden md:inline text-[10px]">Web Utilitas Batubara</span>
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
                        workOrders={cm.workOrders}
                        onOpenDetail={(id, type) => {
                            if (type === 'critical') {
                                setExpandedCriticalId(id);
                            } else {
                                setExpandedWOId(id);
                            }
                        }}
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

            {/* Maintenance form modal */}
            <MaintenanceFormModal
                open={showForm || showMaintenanceForm || !!editingMaintenance}
                initial={editingMaintenance || maintenanceInitial}
                onClose={() => {
                    setShowForm(false);
                    setShowMaintenanceForm(false);
                    setEditingMaintenance(null);
                    setMaintenanceInitial(null);
                }}
                onSubmit={async (data) => {
                    let res;
                    if (editingMaintenance) {
                        res = await cm.updateMaintenance(editingMaintenance.id, data, operator?.name);
                    } else {
                        res = await cm.createMaintenance(data);
                    }
                    if (!res.error) {
                        if (returnToDetailId) {
                            setExpandedCriticalId(returnToDetailId);
                            setReturnToDetailId(null);
                        } else if (returnToWOId) {
                            setExpandedWOId(returnToWOId);
                            setReturnToWOId(null);
                        }
                    }
                    return res;
                }}
                activeCriticals={cm.criticals}
                operatorName={operator?.name}
            />

            {/* Detail Modals for Kanban View */}
            {expandedCriticalId && cm.criticals.find(c => c.id === expandedCriticalId) && (() => {
                const critical = cm.criticals.find(c => c.id === expandedCriticalId)!;
                return (
                    <CriticalDetailModal
                        critical={critical}
                        rowIndex={0}
                        onClose={() => setExpandedCriticalId(null)}
                        onEditMaintenance={(m) => setEditingMaintenance({ ...m, critical_equipment: null })}
                        onDeleteMaintenance={async (id) => { await cm.deleteMaintenance(id, operator?.name); }}
                        onAddMaintenance={(c) => {
                            setMaintenanceInitial(c ? {
                                critical_id: c.id,
                                item: c.item,
                                scope: c.scope,
                                foreman: c.foreman,
                                date: new Date().toISOString().split('T')[0],
                            } : { date: new Date().toISOString().split('T')[0] });
                            if (c?.id) { setReturnToDetailId(c.id); setExpandedCriticalId(null); }
                            setShowMaintenanceForm(true);
                        }}
                        onRefresh={cm.refetch}
                        fetchPhotos={cm.fetchPhotos}
                        deletePhoto={cm.deletePhoto}
                        operatorName={operator?.name}
                        addActivityNote={cm.addActivityNote}
                        onChangeMaintenanceStatus={async (id, newStatus, actor) => {
                            return await cm.moveMaintenanceStatus(id, newStatus, actor);
                        }}
                    />
                );
            })()}

            {expandedWOId && cm.workOrders.find(w => w.id === expandedWOId) && (() => {
                const wo = cm.workOrders.find(w => w.id === expandedWOId)!;
                return (
                    <WorkOrderDetailModal
                        workOrder={wo}
                        rowIndex={0}
                        onClose={() => setExpandedWOId(null)}
                        onEditPekerjaan={(m) => setEditingMaintenance({ ...m, critical_equipment: null })}
                        onDeletePekerjaan={async (id) => { await cm.deleteMaintenance(id, operator?.name); }}
                        onAddPekerjaan={(wData) => {
                            setMaintenanceInitial({
                                work_order_id: wData.id,
                                item: wData.item,
                                scope: wData.scope,
                                foreman: wData.foreman,
                                date: new Date().toISOString().split('T')[0],
                            });
                            setReturnToWOId(wData.id);
                            setExpandedWOId(null);
                            setShowMaintenanceForm(true);
                        }}
                        onRefresh={cm.refetch}
                        fetchPhotos={cm.fetchWOPhotos}
                        deletePhoto={cm.deletePhoto}
                        operatorName={operator?.name}
                        addActivityNote={cm.addWOActivityNote}
                        onChangePekerjaanStatus={async (id, newStatus, actor) => {
                            return await cm.moveMaintenanceStatus(id, newStatus, actor);
                        }}
                    />
                );
            })()}
        </div>
    );
}
