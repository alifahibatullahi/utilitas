'use client';

import { useState, useRef, useEffect } from 'react';
import type { CriticalWithMaintenance, MaintenanceWithCritical } from '@/lib/supabase/types';
import type { CriticalMaintenanceFilters } from '@/hooks/useCriticalMaintenance';
import { FOREMAN_OPTIONS } from '@/lib/constants';
import StatusBadge from './StatusBadge';
import ScopeBadge from './ScopeBadge';
import FilterBar from './FilterBar';
import ActivityTimeline from './ActivityTimeline';
import CloseCriticalModal from './CloseCriticalModal';

interface HistoryViewProps {
    criticals: CriticalWithMaintenance[];
    filterCriticals: (f: CriticalMaintenanceFilters) => CriticalWithMaintenance[];
    loading: boolean;
    addActivityNote: (criticalId: string, note: string, actor?: string | null) => Promise<{ error: string | null }>;
    operatorName?: string | null;
    onAddCritical?: () => void;
    onAddMaintenance?: (fromCritical?: CriticalWithMaintenance) => void;
    onEditCritical?: (c: CriticalWithMaintenance) => void;
    onDeleteCritical?: (id: string) => Promise<void>;
    onEditMaintenance?: (m: MaintenanceWithCritical) => void;
    onUpdateMaintenance?: (id: string, data: Partial<MaintenanceWithCritical>) => Promise<void>;
    onDeleteMaintenance?: (id: string) => Promise<void>;
    onCloseCritical?: (id: string, actor: string) => Promise<{ error: string | null }>;
}

function getForemanLabel(val: string) {
    return FOREMAN_OPTIONS.find(f => f.value === val)?.label ?? val;
}

function formatDate(d: string) {
    if (!d) return '-';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HistoryView({
    criticals, filterCriticals, loading,
    addActivityNote, operatorName, onAddCritical, onAddMaintenance,
    onEditCritical, onDeleteCritical, onEditMaintenance, onUpdateMaintenance, onDeleteMaintenance,
    onCloseCritical,
}: HistoryViewProps) {
    const [filters, setFilters] = useState<CriticalMaintenanceFilters>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const filteredCriticals = filterCriticals(filters);

    const filterNode = (
        <div className="mb-4">
            <FilterBar filters={filters} onChange={setFilters} />
        </div>
    );

    return (
        <div className="w-full">
            {loading ? (
                <div className="space-y-4">
                    {filterNode}
                    <div className="text-center py-12 text-gray-400">
                        <span className="material-symbols-outlined animate-spin text-3xl text-blue-400">progress_activity</span>
                        <p className="mt-2 text-sm font-medium">Memuat data...</p>
                    </div>
                </div>
            ) : (
                <CriticalList
                    items={filteredCriticals}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    addActivityNote={addActivityNote}
                    operatorName={operatorName}
                    onAddCritical={onAddCritical}
                    onAddMaintenance={onAddMaintenance}
                    onEditCritical={onEditCritical}
                    onDeleteCritical={onDeleteCritical}
                    onEditMaintenance={onEditMaintenance}
                    onUpdateMaintenance={onUpdateMaintenance}
                    onDeleteMaintenance={onDeleteMaintenance}
                    onCloseCritical={onCloseCritical}
                    headerNode={filterNode}
                />
            )}
        </div>
    );
}

// ─── Status Dropdown for critical card ───
function StatusDropdown({
    critical,
    onClose: onDismiss,
    onRequestCloseCritical,
}: {
    critical: CriticalWithMaintenance;
    onClose: () => void;
    onRequestCloseCritical?: (c: CriticalWithMaintenance) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onDismiss]);

    const isClosed = critical.status === 'CLOSED';

    return (
        <div
            ref={ref}
            className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[160px] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
            <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Ubah Status</p>
            </div>
            {/* OPEN option */}
            <button
                onClick={() => { onDismiss(); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold transition-colors text-left
                    ${!isClosed ? 'bg-rose-50 text-rose-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
                Open
                {!isClosed && <span className="ml-auto text-[10px] text-gray-400">saat ini</span>}
            </button>
            {/* CLOSED option */}
            <button
                onClick={() => { onDismiss(); onRequestCloseCritical?.(critical); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold transition-colors text-left
                    ${isClosed ? 'bg-slate-100 text-slate-700' : 'text-gray-600 hover:bg-slate-50'}`}
            >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                Closed
                {isClosed && <span className="ml-auto text-[10px] text-gray-400">saat ini</span>}
            </button>
        </div>
    );
}

// ─── Status Dropdown for Maintenance card ───
function MaintenanceStatusDropdown({
    maint,
    onClose: onDismiss,
    onUpdateMaintenance,
}: {
    maint: MaintenanceWithCritical;
    onClose: () => void;
    onUpdateMaintenance?: (id: string, data: Partial<MaintenanceWithCritical>) => Promise<void>;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onDismiss]);

    const handleUpdate = async (status: 'OPEN' | 'IP' | 'OK') => {
        if (maint.status !== status) {
            await onUpdateMaintenance?.(maint.id, { status } as Partial<MaintenanceWithCritical>);
        }
        onDismiss();
    };

    return (
        <div
            ref={ref}
            className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[140px] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
            <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Ubah Status</p>
            </div>
            <button
                onClick={() => handleUpdate('OPEN')}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold transition-colors text-left ${maint.status === 'OPEN' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/30" /> OPEN
            </button>
            <button
                onClick={() => handleUpdate('IP')}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold transition-colors text-left ${maint.status === 'IP' ? 'bg-amber-50 text-amber-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/30" /> In Progress
            </button>
            <button
                onClick={() => handleUpdate('OK')}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold transition-colors text-left ${maint.status === 'OK' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30" /> OK
            </button>
        </div>
    );
}

function CriticalList({
    items, selectedId, onSelect, addActivityNote, operatorName,
    onAddCritical, onAddMaintenance,
    onEditCritical, onDeleteCritical, onEditMaintenance, onUpdateMaintenance, onDeleteMaintenance,
    onCloseCritical,
    headerNode
}: {
    items: CriticalWithMaintenance[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    addActivityNote: (criticalId: string, note: string, actor?: string | null) => Promise<{ error: string | null }>;
    operatorName?: string | null;
    onAddCritical?: () => void;
    onAddMaintenance?: (fromCritical?: CriticalWithMaintenance) => void;
    onEditCritical?: (c: CriticalWithMaintenance) => void;
    onDeleteCritical?: (id: string) => Promise<void>;
    onEditMaintenance?: (m: MaintenanceWithCritical) => void;
    onUpdateMaintenance?: (id: string, data: Partial<MaintenanceWithCritical>) => Promise<void>;
    onDeleteMaintenance?: (id: string) => Promise<void>;
    onCloseCritical?: (id: string, actor: string) => Promise<{ error: string | null }>;
    headerNode: React.ReactNode;
}) {
    const [detailTab, setDetailTab] = useState<'maintenance' | 'activity'>('maintenance');
    const [confirmDeleteCriticalId, setConfirmDeleteCriticalId] = useState<string | null>(null);
    const [confirmDeleteMaintId, setConfirmDeleteMaintId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [openStatusDropdownId, setOpenStatusDropdownId] = useState<string | null>(null);
    const [openMaintStatusDropdownId, setOpenMaintStatusDropdownId] = useState<string | null>(null);
    const [closingCritical, setClosingCritical] = useState<CriticalWithMaintenance | null>(null);

    if (items.length === 0) {
        return (
            <div>
                {headerNode}
                <EmptyState text="Tidak ada data critical" onAdd={onAddCritical} />
            </div>
        );
    }

    const sortedItems = [
        ...items.filter(c => c.status === 'OPEN'),
        ...items.filter(c => c.status !== 'OPEN'),
    ];
    const firstClosedIdx = sortedItems.findIndex(c => c.status !== 'OPEN');

    const selectedCritical = items.find(c => c.id === selectedId);

    const handleDeleteCritical = async (id: string) => {
        setDeleting(true);
        await onDeleteCritical?.(id);
        setConfirmDeleteCriticalId(null);
        setDeleting(false);
        if (selectedId === id) onSelect(null);
    };

    const handleDeleteMaint = async (id: string) => {
        setDeleting(true);
        await onDeleteMaintenance?.(id);
        setConfirmDeleteMaintId(null);
        setDeleting(false);
    };

    return (
        <>
        {closingCritical && (
            <CloseCriticalModal
                open={true}
                critical={closingCritical}
                operatorName={operatorName}
                onClose={() => setClosingCritical(null)}
                onConfirm={async (actor) => {
                    const res = await onCloseCritical?.(closingCritical.id, actor) ?? { error: null };
                    if (!res.error) setClosingCritical(null);
                    return res;
                }}
            />
        )}
        <div className="flex flex-col xl:flex-row gap-6 items-start">
            {/* Left Pane: Critical List */}
            <div className="w-full xl:w-[45%] flex flex-col flex-shrink-0">
                {headerNode}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-extrabold text-gray-800 text-base">List Critical</h3>
                    <button
                        onClick={onAddCritical}
                        className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100 transition-colors shadow-sm cursor-pointer"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                        + Tambah Critical
                    </button>
                </div>
                <div className="space-y-1.5">
                    {sortedItems.map((c, idx) => {
                        const isSelected = selectedId === c.id;
                        const isConfirmDelete = confirmDeleteCriticalId === c.id;
                        const isStatusOpen = openStatusDropdownId === c.id;
                        return (
                            <div key={c.id}>
                            {idx === firstClosedIdx && firstClosedIdx > 0 && (
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="flex-1 h-px bg-rose-300" />
                                    <span className="text-[10px] font-extrabold text-gray-700 uppercase tracking-widest">Closed</span>
                                    <div className="flex-1 h-px bg-rose-300" />
                                </div>
                            )}
                            <div
                                key={`card-${c.id}`}
                                className={`w-full text-left bg-white border rounded-lg shadow-sm transition-all overflow-visible relative group
                                    ${isSelected ? 'border-blue-500 ring-1 ring-blue-500' : c.status === 'OPEN' ? 'border-rose-400 hover:bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}
                            >
                                {/* Top-Right Actions */}
                                <div className="absolute top-2 right-2 flex items-center gap-1 z-10 transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                                    {isConfirmDelete ? (
                                        <div className="flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded-lg border border-rose-200 shadow-sm animate-in fade-in zoom-in duration-200">
                                            <span className="text-[10px] font-extrabold text-rose-600 mx-1 uppercase tracking-widest">Hapus?</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteCritical(c.id); }}
                                                disabled={deleting}
                                                className="w-5 h-5 rounded flex items-center justify-center bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 cursor-pointer shadow-sm"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{deleting ? 'more_horiz' : 'check'}</span>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteCriticalId(null); }}
                                                className="w-5 h-5 rounded flex items-center justify-center bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 cursor-pointer shadow-sm"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-0.5 bg-white/90 backdrop-blur-sm px-1 py-0.5 rounded-lg shadow-sm border border-gray-100">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEditCritical?.(c); }}
                                                className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                                title="Edit critical"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                                            </button>
                                            <div className="w-px h-3.5 bg-gray-200 mx-0.5"></div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteCriticalId(c.id); }}
                                                className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                title="Hapus critical"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Card body — clickable for select */}
                                <button
                                    onClick={() => onSelect(isSelected ? null : c.id)}
                                    className="w-full text-left px-3 pt-2.5 pb-2.5 cursor-pointer"
                                >
                                    <div className="flex items-center gap-1.5 flex-wrap pr-16">
                                        <span className={`text-sm font-extrabold ${isSelected ? 'text-blue-700' : 'text-black'}`}>{c.item}</span>
                                        {/* Clickable status badge */}
                                        <div className="relative" onClick={e => { e.stopPropagation(); setOpenStatusDropdownId(isStatusOpen ? null : c.id); }}>
                                            <span className="cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-0.5">
                                                <StatusBadge status={c.status} light={true} />
                                                <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 12 }}>expand_more</span>
                                            </span>
                                            {isStatusOpen && (
                                                <StatusDropdown
                                                    critical={c}
                                                    onClose={() => setOpenStatusDropdownId(null)}
                                                    onRequestCloseCritical={(crit) => setClosingCritical(crit)}
                                                />
                                            )}
                                        </div>
                                        <ScopeBadge scope={c.scope} light={true} />
                                    </div>
                                    <p className={`text-xs mt-0.5 line-clamp-1 ${isSelected ? 'text-gray-700' : 'text-gray-500'}`}>{c.deskripsi}</p>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
                                        {c.notif ? (
                                            <span className="text-[10px] font-bold text-blue-700 flex items-center gap-0.5">
                                                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>integration_instructions</span>{c.notif}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-0.5">
                                                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>error</span>No notif
                                            </span>
                                        )}
                                        <span className="text-[10px] text-gray-400">{c.reported_by || '-'}</span>
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0 rounded-full border border-blue-100 ml-auto">
                                            {c.maintenance_logs.length} maint
                                        </span>
                                        <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>person</span>
                                            {getForemanLabel(c.foreman)}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                            {formatDate(c.date)}
                                        </span>
                                    </div>
                                </button>
                            </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right Pane: Detail View */}
            <div className="w-full xl:w-[55%] sticky top-24">
                {selectedCritical ? (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-md flex flex-col overflow-hidden transition-all animate-in fade-in" style={{ height: 'calc(100vh - 96px)' }}>
                        {/* Detail Header */}
                        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                            <div className="flex flex-col gap-1.5 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                    <h2 className="text-lg font-black text-black leading-tight flex-shrink-0">{selectedCritical.item}</h2>
                                    <span className="text-[10px] font-mono font-bold bg-white text-gray-800 px-1.5 py-0.5 rounded border border-gray-300 shadow-sm flex-shrink-0">
                                        #CR-{selectedCritical.id.slice(0, 6).toUpperCase()}
                                    </span>
                                    <div className="w-px h-3.5 bg-gray-300 mx-0.5 hidden sm:block flex-shrink-0" />
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] flex-shrink-0">
                                        <StatusBadge status={selectedCritical.status} light={true} />
                                        <ScopeBadge scope={selectedCritical.scope} light={true} />
                                        <span className="flex items-center gap-0.5 font-bold text-gray-700 bg-white border border-gray-200 px-1.5 py-0.5 rounded shadow-sm">
                                            <span className="material-symbols-outlined text-[12px] text-gray-500">person</span>
                                            {getForemanLabel(selectedCritical.foreman)}
                                        </span>
                                        <span className="flex items-center gap-0.5 font-bold text-gray-700 bg-white border border-gray-200 px-1.5 py-0.5 rounded shadow-sm">
                                            <span className="material-symbols-outlined text-[12px] text-gray-500">calendar_today</span>
                                            {formatDate(selectedCritical.date)}
                                        </span>
                                        {selectedCritical.notif && (
                                            <span className="flex items-center gap-0.5 font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded shadow-sm">
                                                <span className="material-symbols-outlined text-[12px] text-blue-500">integration_instructions</span>
                                                SA: {selectedCritical.notif}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-sm font-bold text-gray-700 leading-snug line-clamp-1">{selectedCritical.deskripsi}</p>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex justify-between items-center border-b border-gray-200 bg-white px-4 py-1.5 flex-shrink-0">
                            <div className="flex bg-gray-100/80 p-1 rounded-xl border border-gray-200/60 shadow-inner">
                                <button
                                    onClick={() => setDetailTab('maintenance')}
                                    className={`px-4 py-1.5 flex items-center gap-1.5 rounded-lg text-sm font-bold transition-all ${detailTab === 'maintenance' ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>task</span>
                                    Info & Tasks ({selectedCritical.maintenance_logs.length})
                                </button>
                                <button
                                    onClick={() => setDetailTab('activity')}
                                    className={`px-4 py-1.5 flex items-center gap-1.5 rounded-lg text-sm font-bold transition-all ${detailTab === 'activity' ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>history</span>
                                    Activity ({selectedCritical.critical_activity_logs?.length ?? 0})
                                </button>
                            </div>
                            {detailTab === 'maintenance' && (
                                <button
                                    onClick={() => onAddMaintenance?.(selectedCritical)}
                                    className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold hover:bg-emerald-100 transition-colors shadow-sm cursor-pointer"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>build</span>
                                    + Tambah Maintenance
                                </button>
                            )}
                        </div>

                        {/* Detail Body */}
                        <div className="flex-1 overflow-y-auto light-scrollbar bg-gray-50/50">
                            {detailTab === 'maintenance' ? (
                                <div className="p-4">
                                    {selectedCritical.maintenance_logs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                                                <span className="material-symbols-outlined text-3xl text-gray-300">task</span>
                                            </div>
                                            <p className="text-base font-bold text-gray-500">Belum ada Tasks</p>
                                            <p className="text-xs font-medium text-gray-400 mt-1">Gunakan tombol "Tambah Maintenance" dan tautkan ke Critical ini.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {(() => {
                                                // Sort maintenance chronologically
                                                const sortedMaintenances = [...selectedCritical.maintenance_logs].sort(
                                                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                                                );

                                                const handleOrderSwap = async (idx1: number, idx2: number) => {
                                                    const m1 = sortedMaintenances[idx1];
                                                    const m2 = sortedMaintenances[idx2];
                                                    // swap created_at purely for visual chronological order inside DB
                                                    await onUpdateMaintenance?.(m1.id, { created_at: m2.created_at } as any);
                                                    await onUpdateMaintenance?.(m2.id, { created_at: m1.created_at } as any);
                                                };

                                                return sortedMaintenances.map((m, idx) => {
                                                    const isConfirmDeleteM = confirmDeleteMaintId === m.id;
                                                    const isMaintStatusOpen = openMaintStatusDropdownId === m.id;
                                                    const mFull = m as unknown as MaintenanceWithCritical;
                                                    
                                                    // Background color logic based on status
                                                    const bgClass = m.status === 'OPEN' ? 'bg-white'
                                                                  : m.status === 'IP' ? 'bg-amber-100'
                                                                  : 'bg-emerald-100';

                                                    return (
                                                        <div key={m.id} className={`${bgClass} border border-gray-900/20 rounded-xl shadow-sm hover:shadow-md transition-all p-3.5 relative group flex gap-3`}>
                                                            
                                                            {/* Custom Reorder Buttons Left */}
                                                            <div className="flex flex-col gap-0.5 justify-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0">
                                                                <button
                                                                    disabled={idx === 0}
                                                                    onClick={() => handleOrderSwap(idx, idx - 1)}
                                                                    className="w-5 h-5 flex items-center justify-center rounded bg-white text-gray-900 border border-gray-400 hover:text-blue-600 hover:border-blue-300 disabled:opacity-25 disabled:hover:text-gray-900 disabled:hover:border-gray-400 transition-all cursor-pointer shadow-sm"
                                                                    title="Naikkan urutan"
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>keyboard_arrow_up</span>
                                                                </button>
                                                                <button
                                                                    disabled={idx === sortedMaintenances.length - 1}
                                                                    onClick={() => handleOrderSwap(idx, idx + 1)}
                                                                    className="w-5 h-5 flex items-center justify-center rounded bg-white text-gray-900 border border-gray-400 hover:text-blue-600 hover:border-blue-300 disabled:opacity-25 disabled:hover:text-gray-900 disabled:hover:border-gray-400 transition-all cursor-pointer shadow-sm"
                                                                    title="Turunkan urutan"
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>keyboard_arrow_down</span>
                                                                </button>
                                                            </div>

                                                            {/* Main Content */}
                                                            <div className="flex-1 min-w-0 flex flex-col pt-0.5">
                                                                {/* Top-Right Actions (Delete/Edit) */}
                                                                <div className="absolute top-3 right-3 flex items-center gap-1 z-10 transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                                                                    {isConfirmDeleteM ? (
                                                                        <div className="flex items-center gap-1 bg-rose-50 px-1.5 py-1 rounded-lg border border-rose-200 shadow-sm animate-in fade-in zoom-in duration-200">
                                                                            <span className="text-[10px] font-extrabold text-rose-600 mx-1 uppercase tracking-widest">Hapus?</span>
                                                                            <button
                                                                                onClick={() => handleDeleteMaint(m.id)}
                                                                                disabled={deleting}
                                                                                className="w-5 h-5 rounded flex items-center justify-center bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 cursor-pointer shadow-sm"
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{deleting ? 'more_horiz' : 'check'}</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setConfirmDeleteMaintId(null)}
                                                                                className="w-5 h-5 rounded flex items-center justify-center bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 cursor-pointer shadow-sm"
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-0.5 bg-white/90 backdrop-blur-sm px-1 py-0.5 rounded-lg shadow-sm border border-gray-300">
                                                                            <button
                                                                                onClick={() => onEditMaintenance?.(mFull)}
                                                                                className="w-6 h-6 flex items-center justify-center rounded text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                                                                title="Edit"
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setConfirmDeleteMaintId(m.id)}
                                                                                className="w-6 h-6 flex items-center justify-center rounded text-gray-700 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                                                title="Hapus"
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Header: Status, Scope, Notif */}
                                                                <div className="flex items-center gap-2 flex-wrap mb-2 pr-16 relative">
                                                                    <div className="relative">
                                                                        <span
                                                                            className="cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-0.5"
                                                                            onClick={e => { e.stopPropagation(); setOpenMaintStatusDropdownId(isMaintStatusOpen ? null : m.id); }}
                                                                        >
                                                                            <StatusBadge status={m.status} light={false} />
                                                                            <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 13 }}>expand_more</span>
                                                                        </span>
                                                                        {isMaintStatusOpen && (
                                                                            <MaintenanceStatusDropdown
                                                                                maint={mFull}
                                                                                onClose={() => setOpenMaintStatusDropdownId(null)}
                                                                                onUpdateMaintenance={onUpdateMaintenance}
                                                                            />
                                                                        )}
                                                                    </div>

                                                                    <ScopeBadge scope={m.scope} light={false} />

                                                                    {m.notif ? (
                                                                        <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded shadow-sm border border-blue-200">
                                                                            Notif : {m.notif}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded shadow-sm border border-rose-200">
                                                                            Belum ada Notif
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Uraian */}
                                                                <span className="text-sm font-extrabold text-gray-900 break-words block mb-2 leading-snug">
                                                                    <span className="text-gray-400 font-bold mr-1">{idx + 1}.</span>
                                                                    <span className="text-gray-500 font-bold mr-1">Uraian Pekerjaan :</span>
                                                                    {m.uraian}
                                                                </span>

                                                                {/* Footer */}
                                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 pt-1.5 border-t border-gray-200/50 text-[9px] font-semibold text-gray-700">
                                                                    <span className="flex items-center gap-0.5">
                                                                        <span className="material-symbols-outlined text-[11px]">person</span>
                                                                        {m.reported_by || '-'}
                                                                    </span>
                                                                    <span className="flex items-center gap-0.5">
                                                                        <span className="material-symbols-outlined text-[11px]">calendar_today</span>
                                                                        {formatDate(m.date)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <ActivityTimeline
                                    logs={selectedCritical.critical_activity_logs ?? []}
                                    criticalId={selectedCritical.id}
                                    onAddNote={addActivityNote}
                                    operatorName={operatorName}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center bg-gray-50/50 border border-gray-200 border-dashed rounded-xl h-[calc(100vh-96px)]">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
                            <span className="material-symbols-outlined text-[40px] text-gray-300">list_alt</span>
                        </div>
                        <h3 className="text-lg font-extrabold text-gray-400">Pilih Tiket Insiden</h3>
                        <p className="text-sm font-semibold text-gray-400 mt-1 max-w-[250px] text-center leading-relaxed">Pilih salah satu tiket Critical dari daftar di sisi kiri untuk melihat detail dan tugas.</p>
                    </div>
                )}
            </div>
        </div>
        </>
    );
}

function EmptyState({ text, onAdd }: { text: string; onAdd?: () => void }) {
    return (
        <div className="text-center py-20 bg-gray-50/50 border border-gray-200 rounded-xl border-dashed flex flex-col items-center">
            <span className="material-symbols-outlined text-5xl text-gray-300">inbox</span>
            <p className="mt-3 text-sm font-bold text-gray-400">{text}</p>
            {onAdd && (
                <button
                    onClick={onAdd}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100 transition-colors shadow-sm cursor-pointer"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                    + Tambah Critical
                </button>
            )}
        </div>
    );
}
