'use client';

import { useState, useEffect, useRef } from 'react';
import type { CriticalWithMaintenance, CriticalActivityLogRow, MaintenanceLogRow, HarScope, PhotoRow, MaintenanceType, WorkOrderWithPekerjaan } from '@/lib/supabase/types';
import { FOREMAN_OPTIONS } from '@/lib/constants';
import StatusBadge from './StatusBadge';
import ScopeBadge from './ScopeBadge';
import CriticalDetailModal from './CriticalDetailModal';
import WorkOrderDetailModal from './WorkOrderDetailModal';

const STORAGE_KEY = 'critical-starred-ids';
const COL_COUNT = 9;

interface CriticalTableViewProps {
    criticals: CriticalWithMaintenance[];
    workOrders?: WorkOrderWithPekerjaan[];
    onEditCritical?: (c: CriticalWithMaintenance) => void;
    onDeleteCritical?: (id: string) => Promise<void>;
    onAddCritical?: () => void;
    onEditMaintenance?: (m: MaintenanceLogRow) => void;
    onDeleteMaintenance?: (id: string) => Promise<void>;
    onAddMaintenance?: (critical?: CriticalWithMaintenance) => void;
    onEditWorkOrder?: (wo: WorkOrderWithPekerjaan) => void;
    onDeleteWorkOrder?: (id: string) => Promise<void>;
    onAddWorkOrder?: () => void;
    onAddPekerjaanToWO?: (wo: WorkOrderWithPekerjaan) => void;
    fetchPhotos?: (type: 'critical', id: string) => Promise<PhotoRow[]>;
    deletePhoto?: (id: string) => Promise<{ error: string | null }>;
    operatorName?: string;
    expandedId?: string | null;
    onSetExpandedId?: (id: string | null) => void;
    expandedWOId?: string | null;
    onSetExpandedWOId?: (id: string | null) => void;
}

type TableStatusTab = 'OPEN' | 'CLOSED';

const STATUS_TABS: { key: TableStatusTab; label: string }[] = [
    { key: 'OPEN', label: 'Open' },
    { key: 'CLOSED', label: 'Closed' },
];

const ACTION_CONFIG: Record<string, { icon: string; color: string }> = {
    created:              { icon: 'flag',                    color: 'text-rose-500' },
    status_changed:       { icon: 'published_with_changes',  color: 'text-amber-500' },
    note:                 { icon: 'chat_bubble',             color: 'text-blue-500' },
    maintenance_added:    { icon: 'build_circle',            color: 'text-emerald-500' },
    maintenance_updated:  { icon: 'handyman',                color: 'text-purple-500' },
    maintenance_deleted:  { icon: 'remove_circle',           color: 'text-gray-400' },
};

// ─── Helpers ───

function getForemanLabel(val: string) {
    return FOREMAN_OPTIONS.find(f => f.value === val)?.label ?? val;
}

function formatDate(d: string) {
    if (!d) return '-';
    return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'baru saja';
    if (mins < 60) return `${mins} mnt lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} jam lalu`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} hari lalu`;
    return `${Math.floor(days / 30)} bln lalu`;
}

function getTipeLabel(tipe: MaintenanceType): string {
    if (tipe === 'preventif') return 'Preventif';
    if (tipe === 'modifikasi') return 'Modifikasi';
    return 'Maintenance';
}

function filterByTab(criticals: CriticalWithMaintenance[], tab: TableStatusTab) {
    return criticals.filter(c => c.status === tab);
}

function getTabCounts(criticals: CriticalWithMaintenance[]): Record<TableStatusTab, number> {
    return {
        OPEN:   criticals.filter(c => c.status === 'OPEN').length,
        CLOSED: criticals.filter(c => c.status === 'CLOSED').length,
    };
}

// Expanded components moved to CriticalDetailModal

// ─── Critical Row ───
function CriticalRow({
    critical, starred, isEven, rowIndex, toggleStar, onEditCritical, onDeleteCritical,
    onEditMaintenance, onDeleteMaintenance, onAddMaintenance,
    expandedId, onToggleExpand, fetchPhotos, deletePhoto, operatorName,
}: {
    critical: CriticalWithMaintenance;
    starred: boolean;
    isEven: boolean;
    rowIndex: number;
    toggleStar: (id: string) => void;
    onEditCritical?: (c: CriticalWithMaintenance) => void;
    onDeleteCritical?: (id: string) => Promise<void>;
    onEditMaintenance?: (m: MaintenanceLogRow) => void;
    onDeleteMaintenance?: (id: string) => Promise<void>;
    onAddMaintenance?: (criticalId: string) => void;
    expandedId: string | null;
    onToggleExpand: (id: string) => void;
    fetchPhotos?: (maintenanceId: string) => Promise<PhotoRow[]>;
    deletePhoto?: (photoId: string) => Promise<void>;
    operatorName?: string;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const isExpanded = expandedId === critical.id;
    const rowBg = isEven ? 'bg-gray-50/40' : 'bg-white';

    async function handleDelete() {
        setDeleting(true);
        await onDeleteCritical?.(critical.id);
        setDeleting(false);
        setConfirmDelete(false);
    }

    return (
        <>
            {/* ── Data Row ── */}
            <tr className={`border-b border-gray-100 transition-colors hover:bg-blue-50 ${rowBg}`}>
                {/* Star */}
                <td className="px-2 py-2 text-center">
                    <button
                        onClick={() => toggleStar(critical.id)}
                        className={`p-0.5 rounded transition-colors ${starred ? 'text-amber-400 hover:text-amber-500' : 'text-gray-200 hover:text-amber-300'}`}
                        title={starred ? 'Hapus starred' : 'Tambah starred'}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: starred ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                    </button>
                </td>
                {/* Tanggal */}
                <td className="px-5 py-5 whitespace-nowrap text-lg font-bold text-black">{formatDate(critical.date)}</td>
                {/* Item */}
                <td className="px-5 py-5 text-lg font-black text-black whitespace-nowrap">{critical.item}</td>
                {/* Deskripsi */}
                <td className="px-5 py-5 text-lg font-medium text-black max-w-[250px] leading-relaxed">
                    <span className="line-clamp-2">{critical.deskripsi}</span>
                </td>
                {/* Scope */}
                <td className="px-5 py-5">
                    <div className="flex flex-wrap gap-2">
                        {Array.from(new Set([
                            critical.scope,
                            ...(critical.maintenance_logs?.map(m => m.scope) || [])
                        ])).map(s => (
                            <ScopeBadge key={s} scope={s} solid className="px-3 py-1.5 text-sm shadow-sm" />
                        ))}
                    </div>
                </td>
                {/* Foreman */}
                <td className="px-5 py-5 text-lg font-bold text-black whitespace-nowrap">{getForemanLabel(critical.foreman)}</td>
                {/* Notif */}
                <td className="px-5 py-5 text-lg font-mono font-bold text-black whitespace-nowrap">
                    {critical.notif ?? <span className="text-gray-300">—</span>}
                </td>
                {/* Status */}
                <td className="px-5 py-5 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Critical</span>
                        <StatusBadge status={critical.status} solid className="px-3 py-1 text-sm shadow-sm" />
                    </div>
                </td>
                <td className="px-5 py-5 text-center">
                    <div className="flex items-center justify-center gap-2">
                        {/* Detail */}
                        <button
                            onClick={() => onToggleExpand(critical.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/20 hover:shadow-md hover:from-blue-600 hover:to-blue-700"
                            title="Detail maintenance & aktivitas"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                                open_in_new
                            </span>
                            Detail
                        </button>
                        {/* Edit */}
                        <button
                            onClick={() => onEditCritical?.(critical)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                            title="Edit"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>edit</span>
                        </button>
                        {/* Delete / Confirm */}
                        {confirmDelete ? (
                            <div className="flex items-center gap-1 z-10 relative">
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-sm disabled:opacity-50 transition-all font-bold"
                                    title="Konfirmasi hapus"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{deleting ? 'more_horiz' : 'check'}</span>
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 shadow-sm transition-all"
                                    title="Batal"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                title="Hapus"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>delete</span>
                            </button>
                        )}
                    </div>
                </td>
            </tr>
        </>
    );
}

// ─── Work Order Row ───
function WorkOrderRow({
    wo, isEven, onEdit, onDelete, onToggleExpand,
}: {
    wo: WorkOrderWithPekerjaan;
    isEven: boolean;
    onEdit?: (wo: WorkOrderWithPekerjaan) => void;
    onDelete?: (id: string) => Promise<void>;
    onToggleExpand: (id: string) => void;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const rowBg = isEven ? 'bg-gray-50/40' : 'bg-white';
    const isPreventif = wo.tipe === 'preventif';
    const tipeColor = isPreventif ? 'text-emerald-600' : 'text-violet-600';

    async function handleDelete() {
        setDeleting(true);
        await onDelete?.(wo.id);
        setDeleting(false);
        setConfirmDelete(false);
    }

    return (
        <tr className={`border-b border-gray-100 transition-colors hover:bg-slate-50 ${rowBg}`}>
            {/* Star placeholder */}
            <td className="px-2 py-2" />
            {/* Tanggal */}
            <td className="px-5 py-4 whitespace-nowrap text-base font-bold text-black">{formatDate(wo.date)}</td>
            {/* Item */}
            <td className="px-5 py-4 text-base font-black text-black whitespace-nowrap">{wo.item}</td>
            {/* Deskripsi */}
            <td className="px-5 py-4 text-base font-medium text-black max-w-[250px] leading-relaxed">
                <span className="line-clamp-2">{wo.deskripsi}</span>
            </td>
            {/* Scope */}
            <td className="px-5 py-4">
                <ScopeBadge scope={wo.scope} solid className="px-3 py-1.5 text-sm shadow-sm" />
            </td>
            {/* Foreman */}
            <td className="px-5 py-4 text-base font-bold text-black whitespace-nowrap">{getForemanLabel(wo.foreman)}</td>
            {/* Notif */}
            <td className="px-5 py-4 text-base font-mono font-bold text-black whitespace-nowrap">
                {wo.notif ?? <span className="text-gray-300">—</span>}
            </td>
            {/* Status dengan tipe */}
            <td className="px-5 py-4 whitespace-nowrap">
                <div className="flex flex-col gap-0.5">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${tipeColor}`}>{isPreventif ? 'Preventif' : 'Modifikasi'}</span>
                    <StatusBadge status={wo.status} solid className="px-3 py-1 text-sm shadow-sm" />
                </div>
            </td>
            {/* Actions */}
            <td className="px-5 py-4 text-center">
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => onToggleExpand(wo.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-sm hover:from-slate-600 hover:to-slate-700 transition-all"
                        title="Detail pekerjaan"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
                        Detail
                    </button>
                    <button onClick={() => onEdit?.(wo)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>edit</span>
                    </button>
                    {confirmDelete ? (
                        <div className="flex items-center gap-1">
                            <button onClick={handleDelete} disabled={deleting}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-sm disabled:opacity-50 transition-all">
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{deleting ? 'more_horiz' : 'check'}</span>
                            </button>
                            <button onClick={() => setConfirmDelete(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 shadow-sm transition-all">
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setConfirmDelete(true)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm">
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>delete</span>
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}

// ─── Item Search Combobox ───
function ItemSearchCombobox({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: string[] }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const filtered = value
        ? items.filter(i => i.toLowerCase().includes(value.toLowerCase()))
        : items.slice(0, 8);

    return (
        <div ref={ref} className="relative min-w-[220px]">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 16 }}>search</span>
                <input
                    type="text"
                    placeholder="Cari item..."
                    value={value}
                    onChange={e => { onChange(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    className="text-sm text-black outline-none bg-transparent w-full placeholder:text-gray-400"
                />
                {value && (
                    <button onClick={() => { onChange(''); setOpen(false); }} className="text-gray-300 hover:text-gray-500">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                )}
            </div>
            {open && filtered.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full max-h-52 overflow-y-auto light-scrollbar rounded-lg border border-gray-200 bg-white shadow-xl">
                    {filtered.map(item => (
                        <button
                            key={item}
                            type="button"
                            onClick={() => { onChange(item); setOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm font-medium text-gray-800 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                            {item}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Shared Table Header ───
function TableHeader() {
    return (
        <thead className="bg-[#EAEFF5] border-b border-[#D8E2ED] sticky top-0 z-10 shadow-sm">
            <tr>
                <th className="w-7 px-4 py-4" />
                <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest whitespace-nowrap">Tanggal</th>
                <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest">Item</th>
                <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest">Deskripsi</th>
                <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest">Scope</th>
                <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest whitespace-nowrap">Foreman</th>
                <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest whitespace-nowrap">Notif/SAP</th>
                <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest">Status</th>
                <th className="px-4 py-4 text-center text-xs font-black text-black uppercase tracking-widest whitespace-nowrap">Detail / Actions</th>
            </tr>
        </thead>
    );
}

// ─── Render Table Body ───
function TableBody({
    items, starredIds, toggleStar, onEditCritical, onDeleteCritical,
    onEditMaintenance, onDeleteMaintenance, onAddMaintenance,
    expandedId, onToggleExpand, fetchPhotos, deletePhoto, operatorName,
}: {
    items: CriticalWithMaintenance[];
    starredIds: Set<string>;
    toggleStar: (id: string) => void;
    onEditCritical?: (c: CriticalWithMaintenance) => void;
    onDeleteCritical?: (id: string) => Promise<void>;
    onEditMaintenance?: (m: MaintenanceLogRow) => void;
    onDeleteMaintenance?: (id: string) => Promise<void>;
    onAddMaintenance?: (critical?: CriticalWithMaintenance) => void;
    expandedId: string | null;
    onToggleExpand: (id: string) => void;
    fetchPhotos?: (type: 'critical', id: string) => Promise<PhotoRow[]>;
    deletePhoto?: (id: string) => Promise<{ error: string | null }>;
    operatorName?: string;
}) {
    return (
        <>
            {items.map((c, idx) => (
                <CriticalRow
                    key={c.id}
                    critical={c}
                    starred={starredIds.has(c.id)}
                    isEven={idx % 2 === 1}
                    rowIndex={idx + 1}
                    toggleStar={toggleStar}
                    onEditCritical={onEditCritical}
                    onDeleteCritical={onDeleteCritical}
                    expandedId={expandedId}
                    onToggleExpand={onToggleExpand}
                />
            ))}
        </>
    );
}

// ─── Main Export ───
export default function CriticalTableView({ criticals, workOrders = [], onEditCritical, onDeleteCritical, onAddCritical, onEditMaintenance, onDeleteMaintenance, onAddMaintenance, onEditWorkOrder, onDeleteWorkOrder, onAddWorkOrder, onAddPekerjaanToWO, fetchPhotos, deletePhoto, operatorName, expandedId: expandedIdProp, onSetExpandedId, expandedWOId: expandedWOIdProp, onSetExpandedWOId }: CriticalTableViewProps) {
    const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<TableStatusTab>('OPEN');
    const [expandedIdLocal, setExpandedIdLocal] = useState<string | null>(null);

    const expandedId = expandedIdProp !== undefined ? expandedIdProp : expandedIdLocal;
    function setExpandedId(id: string | null) {
        if (onSetExpandedId) onSetExpandedId(id);
        else setExpandedIdLocal(id);
    }

    const [expandedWOIdLocal, setExpandedWOIdLocal] = useState<string | null>(null);
    const expandedWOId = expandedWOIdProp !== undefined ? expandedWOIdProp : expandedWOIdLocal;
    function setExpandedWOId(id: string | null) {
        if (onSetExpandedWOId) onSetExpandedWOId(id);
        else setExpandedWOIdLocal(id);
    }

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setStarredIds(new Set(JSON.parse(raw) as string[]));
        } catch { /* ignore */ }
    }, []);

    function toggleStar(id: string) {
        setStarredIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* quota */ }
            return next;
        });
    }

    function handleToggleExpand(id: string) {
        setExpandedId(expandedId === id ? null : id);
    }

    const [filterItem, setFilterItem]         = useState('');
    const [filterScope, setFilterScope]       = useState<HarScope | ''>('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo]     = useState('');

    const hasActiveFilter = filterItem || filterScope || filterDateFrom || filterDateTo;

    function clearFilters() {
        setFilterItem('');
        setFilterScope('');
        setFilterDateFrom('');
        setFilterDateTo('');
    }

    const tabCounts = {
        OPEN:   criticals.filter(c => c.status === 'OPEN').length + workOrders.filter(w => w.status !== 'OK').length,
        CLOSED: criticals.filter(c => c.status === 'CLOSED').length + workOrders.filter(w => w.status === 'OK').length,
    };
    const starredItems = criticals.filter(c => starredIds.has(c.id));

    const filteredCriticals = filterByTab(criticals, activeTab).filter(c => {
        if (filterItem && !c.item.toLowerCase().includes(filterItem.toLowerCase())) return false;
        if (filterScope && c.scope !== filterScope) return false;
        if (filterDateFrom && c.date < filterDateFrom) return false;
        if (filterDateTo   && c.date > filterDateTo)   return false;
        return true;
    });

    const filteredWorkOrders = workOrders.filter(w => {
        if (activeTab === 'OPEN' && w.status === 'OK') return false;
        if (activeTab === 'CLOSED' && w.status !== 'OK') return false;
        if (filterItem && !w.item.toLowerCase().includes(filterItem.toLowerCase())) return false;
        if (filterScope && w.scope !== filterScope) return false;
        if (filterDateFrom && w.date < filterDateFrom) return false;
        if (filterDateTo   && w.date > filterDateTo)   return false;
        return true;
    });

    const allFilteredItems = filteredCriticals.length + filteredWorkOrders.length;

    return (
        <div className="flex flex-col gap-4">
            {/* ── Starred Section ── */}
            {starredItems.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-amber-400" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest">Starred</span>
                        <span className="text-[10px] font-bold text-gray-400">({starredItems.length})</span>
                    </div>
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto light-scrollbar">
                            <table className="w-full min-w-[960px] text-xs border-collapse">
                                <TableHeader />
                                <tbody>
                                    <TableBody
                                        items={starredItems}
                                        starredIds={starredIds}
                                        toggleStar={toggleStar}
                                        onEditCritical={onEditCritical}
                                        onDeleteCritical={onDeleteCritical}
                                        expandedId={expandedId}
                                        onToggleExpand={handleToggleExpand}
                                    />
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Action Buttons ── */}
            <div className="flex items-center justify-center gap-3 py-2 flex-wrap">
                <button
                    onClick={() => onAddMaintenance?.()}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-50 text-blue-600 border-2 border-blue-200 text-sm font-black hover:bg-blue-100 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>build</span>
                    + Maintenance (Critical)
                </button>
                <button
                    onClick={onAddWorkOrder}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 border-2 border-emerald-200 text-sm font-black hover:bg-emerald-100 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>event_available</span>
                    + Preventif / Modifikasi
                </button>
                <button
                    onClick={onAddCritical}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-50 text-rose-600 border-2 border-rose-200 text-sm font-black hover:bg-rose-100 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>warning</span>
                    + Tambah Critical
                </button>
            </div>

            {/* ── Main Table ── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
                    {/* Item search combobox */}
                    <ItemSearchCombobox
                        value={filterItem}
                        onChange={val => { setFilterItem(val); setExpandedId(null); }}
                        items={[...new Set([...criticals.map(c => c.item), ...workOrders.map(w => w.item)])].sort()}
                    />
                    {/* Status */}
                    <select
                        value={activeTab}
                        onChange={e => { setActiveTab(e.target.value as TableStatusTab); setExpandedId(null); }}
                        className="text-sm font-bold text-black bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none shadow-sm cursor-pointer"
                    >
                        {STATUS_TABS.map(t => (
                            <option key={t.key} value={t.key}>{t.label} ({tabCounts[t.key]})</option>
                        ))}
                    </select>
                    {/* Scope */}
                    <select
                        value={filterScope}
                        onChange={e => { setFilterScope(e.target.value as HarScope | ''); setExpandedId(null); }}
                        className="text-sm font-bold text-black bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none shadow-sm cursor-pointer"
                    >
                        <option value="">Semua Scope</option>
                        <option value="mekanik">Mekanik</option>
                        <option value="listrik">Listrik</option>
                        <option value="instrumen">Instrumen</option>
                        <option value="sipil">Sipil</option>
                    </select>
                    {/* Date range */}
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={filterDateFrom}
                            onChange={e => { setFilterDateFrom(e.target.value); setExpandedId(null); }}
                            className="text-sm font-bold text-black bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none shadow-sm cursor-pointer"
                            title="Dari tanggal"
                        />
                        <span className="text-sm font-bold text-gray-400">–</span>
                        <input
                            type="date"
                            value={filterDateTo}
                            onChange={e => { setFilterDateTo(e.target.value); setExpandedId(null); }}
                            className="text-sm font-bold text-black bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none shadow-sm cursor-pointer"
                            title="Sampai tanggal"
                        />
                    </div>
                    {/* Clear */}
                    {hasActiveFilter && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100 transition-colors"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>filter_list_off</span>
                            Reset
                        </button>
                    )}
                    <span className="ml-auto text-[10px] text-black font-semibold">
                        {allFilteredItems} item
                    </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto light-scrollbar" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                    <table className="w-full min-w-[960px] text-xs border-collapse">
                        <TableHeader />
                        <tbody>
                            {allFilteredItems === 0 ? (
                                <tr>
                                    <td colSpan={COL_COUNT} className="py-16 text-center">
                                        <span className="material-symbols-outlined text-gray-200 block mb-2" style={{ fontSize: 40 }}>search_off</span>
                                        <p className="text-sm font-bold text-black">Tidak ada data untuk tab ini</p>
                                        {activeTab === 'OPEN' && (
                                            <button
                                                onClick={onAddCritical}
                                                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100 transition-colors"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                                                Tambah Critical Baru
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    <TableBody
                                        items={filteredCriticals}
                                        starredIds={starredIds}
                                        toggleStar={toggleStar}
                                        onEditCritical={onEditCritical}
                                        onDeleteCritical={onDeleteCritical}
                                        expandedId={expandedId}
                                        onToggleExpand={handleToggleExpand}
                                    />
                                    {filteredWorkOrders.map((wo, idx) => (
                                        <WorkOrderRow
                                            key={wo.id}
                                            wo={wo}
                                            isEven={(filteredCriticals.length + idx) % 2 === 1}
                                            onEdit={onEditWorkOrder}
                                            onDelete={onDeleteWorkOrder}
                                            onToggleExpand={id => setExpandedWOId(expandedWOId === id ? null : id)}
                                        />
                                    ))}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Optional Full Detail Modal popup */}
                {expandedId && criticals.find(c => c.id === expandedId) && (() => {
                    const idx = criticals.findIndex(c => c.id === expandedId);
                    return (
                        <CriticalDetailModal
                            critical={criticals[idx]}
                            rowIndex={idx + 1}
                            onClose={() => setExpandedId(null)}
                            onEditMaintenance={onEditMaintenance}
                            onDeleteMaintenance={onDeleteMaintenance}
                            onAddMaintenance={onAddMaintenance}
                            fetchPhotos={fetchPhotos}
                            deletePhoto={deletePhoto}
                            operatorName={operatorName}
                        />
                    );
                })()}

                {expandedWOId && workOrders.find(w => w.id === expandedWOId) && (() => {
                    const idx = workOrders.findIndex(w => w.id === expandedWOId);
                    return (
                        <WorkOrderDetailModal
                            workOrder={workOrders[idx]}
                            rowIndex={filteredCriticals.length + idx + 1}
                            onClose={() => setExpandedWOId(null)}
                            onEditPekerjaan={onEditMaintenance}
                            onDeletePekerjaan={onDeleteMaintenance}
                            onAddPekerjaan={onAddPekerjaanToWO}
                            operatorName={operatorName}
                        />
                    );
                })()}

            </div>
        </div>
    );
}
