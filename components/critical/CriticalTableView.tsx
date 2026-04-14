'use client';

import { useState, useEffect } from 'react';
import type { CriticalWithMaintenance, CriticalActivityLogRow, MaintenanceLogRow, HarScope, PhotoRow } from '@/lib/supabase/types';
import { FOREMAN_OPTIONS } from '@/lib/constants';
import StatusBadge from './StatusBadge';
import ScopeBadge from './ScopeBadge';
import CriticalDetailModal from './CriticalDetailModal';

const STORAGE_KEY = 'critical-starred-ids';
const COL_COUNT = 9;

interface CriticalTableViewProps {
    criticals: CriticalWithMaintenance[];
    onEditCritical?: (c: CriticalWithMaintenance) => void;
    onDeleteCritical?: (id: string) => Promise<void>;
    onAddCritical?: () => void;
    onEditMaintenance?: (m: MaintenanceLogRow) => void;
    onDeleteMaintenance?: (id: string) => Promise<void>;
    onAddMaintenance?: (critical: CriticalWithMaintenance) => void;
    fetchPhotos?: (type: 'critical', id: string) => Promise<PhotoRow[]>;
    deletePhoto?: (id: string) => Promise<{ error: string | null }>;
    operatorName?: string;
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

// No getLastAction anymore here

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
    critical, starred, isEven, toggleStar, onEditCritical, onDeleteCritical,
    onEditMaintenance, onDeleteMaintenance, onAddMaintenance,
    expandedId, onToggleExpand, fetchPhotos, deletePhoto, operatorName,
}: {
    critical: CriticalWithMaintenance;
    starred: boolean;
    isEven: boolean;
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
            <tr className={`border-b border-gray-100 transition-colors hover:bg-blue-50/20 ${rowBg}`}>
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
                <td className="px-4 py-4 whitespace-nowrap text-base font-bold text-black">{formatDate(critical.date)}</td>
                {/* Item */}
                <td className="px-4 py-4 text-base font-black text-black whitespace-nowrap">{critical.item}</td>
                {/* Deskripsi */}
                <td className="px-4 py-4 text-base font-medium text-black max-w-[200px]">
                    <span className="line-clamp-2">{critical.deskripsi}</span>
                </td>
                {/* Scope */}
                <td className="px-4 py-4"><ScopeBadge scope={critical.scope} light /></td>
                {/* Foreman */}
                <td className="px-4 py-4 text-base font-bold text-black whitespace-nowrap">{getForemanLabel(critical.foreman)}</td>
                {/* Status */}
                <td className="px-4 py-4"><StatusBadge status={critical.status} light /></td>
                {/* Notif */}
                <td className="px-4 py-4 text-base font-mono font-bold text-black whitespace-nowrap">
                    {critical.notif ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-4 text-center">
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
                <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest">Status</th>
                <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest whitespace-nowrap">Notif/SAP</th>
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
    onAddMaintenance?: (critical: CriticalWithMaintenance) => void;
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
export default function CriticalTableView({ criticals, onEditCritical, onDeleteCritical, onAddCritical, onEditMaintenance, onDeleteMaintenance, onAddMaintenance, fetchPhotos, deletePhoto, operatorName }: CriticalTableViewProps) {
    const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<TableStatusTab>('OPEN');
    const [expandedId, setExpandedId] = useState<string | null>(null);

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
        setExpandedId(prev => prev === id ? null : id);
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

    const tabCounts    = getTabCounts(criticals);
    const starredItems = criticals.filter(c => starredIds.has(c.id));

    const filteredItems = filterByTab(criticals, activeTab).filter(c => {
        if (filterItem && !c.item.toLowerCase().includes(filterItem.toLowerCase())) return false;
        if (filterScope && c.scope !== filterScope) return false;
        if (filterDateFrom && c.date < filterDateFrom) return false;
        if (filterDateTo   && c.date > filterDateTo)   return false;
        return true;
    });

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

            {/* ── Main Table ── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {/* Status tabs */}
                <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-100">
                    {STATUS_TABS.map(tab => {
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => { setActiveTab(tab.key); setExpandedId(null); }}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-bold transition-all border-b-2 -mb-px ${
                                    isActive ? 'border-blue-500 text-blue-600 bg-blue-50/60' : 'border-transparent text-black hover:text-black hover:bg-gray-50'
                                }`}
                            >
                                {tab.label}
                                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold ${
                                    isActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-black'
                                }`}>
                                    {tabCounts[tab.key]}
                                </span>
                            </button>
                        );
                    })}
                    <div className="ml-auto pb-2">
                        <button
                            onClick={onAddCritical}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                            + Tambah Critical
                        </button>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-gray-50/60 border-b border-gray-100">
                    {/* Item search */}
                    <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-sm min-w-[160px]">
                        <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 14 }}>search</span>
                        <input
                            type="text"
                            placeholder="Cari item..."
                            value={filterItem}
                            onChange={e => { setFilterItem(e.target.value); setExpandedId(null); }}
                            className="text-xs text-black outline-none bg-transparent w-full placeholder:text-gray-400"
                        />
                        {filterItem && (
                            <button onClick={() => setFilterItem('')} className="text-gray-300 hover:text-gray-500">
                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                            </button>
                        )}
                    </div>
                    {/* Status */}
                    <select
                        value={activeTab}
                        onChange={e => { setActiveTab(e.target.value as TableStatusTab); setExpandedId(null); }}
                        className="text-xs text-black bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none shadow-sm cursor-pointer"
                    >
                        {STATUS_TABS.map(t => (
                            <option key={t.key} value={t.key}>{t.label} ({tabCounts[t.key]})</option>
                        ))}
                    </select>
                    {/* Scope */}
                    <select
                        value={filterScope}
                        onChange={e => { setFilterScope(e.target.value as HarScope | ''); setExpandedId(null); }}
                        className="text-xs text-black bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none shadow-sm cursor-pointer"
                    >
                        <option value="">Semua Scope</option>
                        <option value="mekanik">Mekanik</option>
                        <option value="listrik">Listrik</option>
                        <option value="instrumen">Instrumen</option>
                        <option value="sipil">Sipil</option>
                    </select>
                    {/* Date range */}
                    <div className="flex items-center gap-1.5">
                        <input
                            type="date"
                            value={filterDateFrom}
                            onChange={e => { setFilterDateFrom(e.target.value); setExpandedId(null); }}
                            className="text-xs text-black bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none shadow-sm cursor-pointer"
                            title="Dari tanggal"
                        />
                        <span className="text-xs text-gray-400">–</span>
                        <input
                            type="date"
                            value={filterDateTo}
                            onChange={e => { setFilterDateTo(e.target.value); setExpandedId(null); }}
                            className="text-xs text-black bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none shadow-sm cursor-pointer"
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
                        {filteredItems.length} item
                    </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto light-scrollbar" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                    <table className="w-full min-w-[960px] text-xs border-collapse">
                        <TableHeader />
                        <tbody>
                            {filteredItems.length === 0 ? (
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
                                <TableBody
                                    items={filteredItems}
                                    starredIds={starredIds}
                                    toggleStar={toggleStar}
                                    onEditCritical={onEditCritical}
                                    onDeleteCritical={onDeleteCritical}
                                    expandedId={expandedId}
                                    onToggleExpand={handleToggleExpand}
                                />
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Optional Full Detail Modal popup */}
                {expandedId && criticals.find(c => c.id === expandedId) && (
                    <CriticalDetailModal
                        critical={criticals.find(c => c.id === expandedId)!}
                        onClose={() => setExpandedId(null)}
                        onEditMaintenance={onEditMaintenance}
                        onDeleteMaintenance={onDeleteMaintenance}
                        onAddMaintenance={onAddMaintenance}
                        fetchPhotos={fetchPhotos}
                        deletePhoto={deletePhoto}
                        operatorName={operatorName}
                    />
                )}

            </div>
        </div>
    );
}
