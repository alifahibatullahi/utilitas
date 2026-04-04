'use client';

import { useState, useEffect } from 'react';
import type { CriticalWithMaintenance, CriticalActivityLogRow, MaintenanceLogRow, HarScope } from '@/lib/supabase/types';
import { FOREMAN_OPTIONS } from '@/lib/constants';
import StatusBadge from './StatusBadge';
import ScopeBadge from './ScopeBadge';

const STORAGE_KEY = 'critical-starred-ids';
const COL_COUNT = 11;

interface CriticalTableViewProps {
    criticals: CriticalWithMaintenance[];
    onEditCritical?: (c: CriticalWithMaintenance) => void;
    onDeleteCritical?: (id: string) => Promise<void>;
    onAddCritical?: () => void;
    onEditMaintenance?: (m: MaintenanceLogRow) => void;
    onDeleteMaintenance?: (id: string) => Promise<void>;
    onAddMaintenance?: (critical: CriticalWithMaintenance) => void;
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

function getLastAction(logs: CriticalActivityLogRow[]): { description: string; created_at: string } | null {
    if (!logs || logs.length === 0) return null;
    return [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
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

// ─── Maintenance Badge ───
function MaintBadge({ logs }: { logs: MaintenanceLogRow[] }) {
    if (logs.length === 0) return <span className="text-gray-300 text-[11px]">—</span>;
    const open = logs.filter(m => m.status === 'OPEN').length;
    const ip   = logs.filter(m => m.status === 'IP').length;
    const ok   = logs.filter(m => m.status === 'OK').length;
    return (
        <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-bold text-gray-500">{logs.length}x</span>
            {open > 0 && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-600">{open} open</span>}
            {ip > 0   && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-600">{ip} IP</span>}
            {ok > 0   && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-600">{ok} OK</span>}
        </div>
    );
}

// ─── Expand Panel: Maintenance (single row) ───
const STATUS_DOT: Record<string, string> = {
    OPEN: 'bg-blue-400', IP: 'bg-amber-400', OK: 'bg-emerald-400',
};

function MaintenancePanelRow({ m, onEdit, onDelete }: {
    m: MaintenanceLogRow;
    onEdit?: (m: MaintenanceLogRow) => void;
    onDelete?: (id: string) => Promise<void>;
}) {
    const [confirmDel, setConfirmDel] = useState(false);
    const [deleting, setDeleting] = useState(false);

    async function handleDelete() {
        setDeleting(true);
        await onDelete?.(m.id);
        setDeleting(false);
    }

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 last:border-0 group hover:bg-gray-50/60">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[m.status] ?? 'bg-gray-300'}`} />
            <div className="flex-1 min-w-0">
                <span className="text-[11px] text-black line-clamp-1">{m.uraian}</span>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-black">{formatDate(m.date)}</span>
                    <ScopeBadge scope={m.scope} light />
                    <span className="text-[9px] font-bold text-black">{m.tipe}</span>
                </div>
            </div>
            <span className="text-[9px] font-bold text-black whitespace-nowrap">{m.status}</span>
            {/* Edit / Delete — visible on hover */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                    onClick={() => onEdit?.(m)}
                    className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Edit"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
                </button>
                {confirmDel ? (
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="w-4 h-4 flex items-center justify-center rounded bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
                            title="Konfirmasi hapus"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{deleting ? 'more_horiz' : 'check'}</span>
                        </button>
                        <button
                            onClick={() => setConfirmDel(false)}
                            className="w-4 h-4 flex items-center justify-center rounded bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
                            title="Batal"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setConfirmDel(true)}
                        className="p-0.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Hapus"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Expand Panel: Maintenance ───
function MaintenancePanel({ logs, onEdit, onDelete }: {
    logs: MaintenanceLogRow[];
    onEdit?: (m: MaintenanceLogRow) => void;
    onDelete?: (id: string) => Promise<void>;
}) {
    if (logs.length === 0) {
        return <p className="px-3 py-3 text-[11px] text-gray-400 italic">Belum ada maintenance</p>;
    }
    const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return (
        <div className="flex flex-col">
            {sorted.map((m) => (
                <MaintenancePanelRow key={m.id} m={m} onEdit={onEdit} onDelete={onDelete} />
            ))}
        </div>
    );
}

// ─── Expand Panel: Activity ───
function ActivityPanel({ logs }: { logs: CriticalActivityLogRow[] }) {
    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center py-8 text-gray-400">
                <span className="material-symbols-outlined text-3xl mb-1 text-gray-200">timeline</span>
                <p className="text-xs font-semibold">Belum ada aktivitas</p>
            </div>
        );
    }
    // kronologis: lama → baru
    const sorted = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return (
        <div className="flex flex-col">
            {sorted.map((log) => {
                const cfg = ACTION_CONFIG[log.action_type] ?? { icon: 'info', color: 'text-gray-400' };
                return (
                    <div key={log.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-50 last:border-0">
                        <span className={`material-symbols-outlined flex-shrink-0 ${cfg.color}`} style={{ fontSize: 13 }}>{cfg.icon}</span>
                        <span className="text-[11px] text-black flex-1 leading-snug">{log.description}</span>
                        <span className="text-[10px] text-black whitespace-nowrap flex-shrink-0">
                            {log.actor ? `${log.actor} · ` : ''}{timeAgo(log.created_at)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Expandable Row Pair ───
function CriticalRowPair({
    critical, starred, isEven, toggleStar, onEditCritical, onDeleteCritical,
    onEditMaintenance, onDeleteMaintenance, onAddMaintenance,
    expandedId, onToggleExpand,
}: {
    critical: CriticalWithMaintenance;
    starred: boolean;
    isEven: boolean;
    toggleStar: (id: string) => void;
    onEditCritical?: (c: CriticalWithMaintenance) => void;
    onDeleteCritical?: (id: string) => Promise<void>;
    onEditMaintenance?: (m: MaintenanceLogRow) => void;
    onDeleteMaintenance?: (id: string) => Promise<void>;
    onAddMaintenance?: (critical: CriticalWithMaintenance) => void;
    expandedId: string | null;
    onToggleExpand: (id: string) => void;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const isExpanded = expandedId === critical.id;
    const last = getLastAction(critical.critical_activity_logs);
    const rowBg = isExpanded ? 'bg-blue-50/40' : isEven ? 'bg-gray-50/30' : 'bg-white';

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
                <td className="px-3 py-2 whitespace-nowrap text-xs text-black">{formatDate(critical.date)}</td>
                {/* Item */}
                <td className="px-3 py-2 text-xs font-bold text-black whitespace-nowrap">{critical.item}</td>
                {/* Deskripsi */}
                <td className="px-3 py-2 text-xs text-black max-w-[200px]">
                    <span className="line-clamp-1">{critical.deskripsi}</span>
                </td>
                {/* Scope */}
                <td className="px-3 py-2"><ScopeBadge scope={critical.scope} light /></td>
                {/* Foreman */}
                <td className="px-3 py-2 text-xs text-black whitespace-nowrap">{getForemanLabel(critical.foreman)}</td>
                {/* Status */}
                <td className="px-3 py-2"><StatusBadge status={critical.status} light /></td>
                {/* Notif */}
                <td className="px-3 py-2 text-xs font-mono text-black whitespace-nowrap">
                    {critical.notif ?? <span className="text-gray-300">—</span>}
                </td>
                {/* Maintenance summary */}
                <td className="px-3 py-2">
                    <MaintBadge logs={critical.maintenance_logs} />
                </td>
                {/* Last Action */}
                <td className="px-3 py-2">
                    {last ? (
                        <div className="flex flex-col gap-0.5 max-w-[170px]">
                            <span className="text-xs text-black line-clamp-1 leading-tight">{last.description}</span>
                            <span className="text-[10px] text-gray-400">{timeAgo(last.created_at)}</span>
                        </div>
                    ) : (
                        <span className="text-gray-300 text-[11px]">—</span>
                    )}
                </td>
                {/* Actions */}
                <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                        {/* Detail */}
                        <button
                            onClick={() => onToggleExpand(critical.id)}
                            className={`flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-bold transition-colors border ${
                                isExpanded
                                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                            }`}
                            title="Detail maintenance & aktivitas"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                                {isExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                            Detail
                        </button>
                        {/* Edit */}
                        <button
                            onClick={() => onEditCritical?.(critical)}
                            className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                        </button>
                        {/* Delete / Confirm */}
                        {confirmDelete ? (
                            <div className="flex items-center gap-0.5">
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="w-5 h-5 flex items-center justify-center rounded bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
                                    title="Konfirmasi hapus"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{deleting ? 'more_horiz' : 'check'}</span>
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="w-5 h-5 flex items-center justify-center rounded bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
                                    title="Batal"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Hapus"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                            </button>
                        )}
                    </div>
                </td>
            </tr>

            {/* ── Expand Panel Row ── */}
            {isExpanded && (
                <tr className="border-b border-gray-200">
                    <td colSpan={COL_COUNT} className="px-0 py-0">
                        {/* Indented container — left padding mimics the first columns */}
                        <div className="pl-10 pr-3 py-2 bg-white">
                            <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                                <div className="grid grid-cols-2 divide-x divide-gray-200">
                                    {/* Maintenance */}
                                    <div className="max-h-44 overflow-y-auto light-scrollbar">
                                        <div className="flex items-center justify-between px-3 py-1 bg-emerald-50 border-b border-emerald-100 sticky top-0 z-10">
                                            <p className="text-[9px] font-extrabold text-emerald-700 uppercase tracking-wider">
                                                🔧 Maintenance ({critical.maintenance_logs.length})
                                            </p>
                                            <button
                                                onClick={() => onAddMaintenance?.(critical)}
                                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200 transition-colors"
                                                title="Tambah maintenance untuk critical ini"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>add</span>
                                                Tambah
                                            </button>
                                        </div>
                                        <MaintenancePanel
                                            logs={critical.maintenance_logs}
                                            onEdit={onEditMaintenance}
                                            onDelete={onDeleteMaintenance}
                                        />
                                    </div>
                                    {/* Activity */}
                                    <div className="max-h-44 overflow-y-auto light-scrollbar flex flex-col">
                                        <p className="px-3 py-1 text-[9px] font-extrabold text-blue-700 uppercase tracking-wider bg-blue-50 border-b border-blue-100 sticky top-0 z-10">
                                            📋 Aktivitas ({critical.critical_activity_logs.length})
                                        </p>
                                        <ActivityPanel logs={critical.critical_activity_logs} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ─── Shared Table Header ───
function TableHeader() {
    return (
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
                <th className="w-7 px-2 py-2.5" />
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider whitespace-nowrap">Tanggal</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Item</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Deskripsi</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Scope</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider whitespace-nowrap">Foreman</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider whitespace-nowrap">Notif/SAP</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider whitespace-nowrap">Maintenance</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider whitespace-nowrap">Last Action</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-extrabold text-gray-400 uppercase tracking-wider whitespace-nowrap">Detail / Edit</th>
            </tr>
        </thead>
    );
}

// ─── Render Table Body ───
function TableBody({
    items, starredIds, toggleStar, onEditCritical, onDeleteCritical,
    onEditMaintenance, onDeleteMaintenance, onAddMaintenance,
    expandedId, onToggleExpand,
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
}) {
    return (
        <>
            {items.map((c, idx) => (
                <CriticalRowPair
                    key={c.id}
                    critical={c}
                    starred={starredIds.has(c.id)}
                    isEven={idx % 2 === 1}
                    toggleStar={toggleStar}
                    onEditCritical={onEditCritical}
                    onDeleteCritical={onDeleteCritical}
                    onEditMaintenance={onEditMaintenance}
                    onDeleteMaintenance={onDeleteMaintenance}
                    onAddMaintenance={onAddMaintenance}
                    expandedId={expandedId}
                    onToggleExpand={onToggleExpand}
                />
            ))}
        </>
    );
}

// ─── Main Export ───
export default function CriticalTableView({ criticals, onEditCritical, onDeleteCritical, onAddCritical, onEditMaintenance, onDeleteMaintenance, onAddMaintenance }: CriticalTableViewProps) {
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
                                        onEditMaintenance={onEditMaintenance}
                                        onDeleteMaintenance={onDeleteMaintenance}
                                        onAddMaintenance={onAddMaintenance}
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
                                    onEditMaintenance={onEditMaintenance}
                                    onDeleteMaintenance={onDeleteMaintenance}
                                    onAddMaintenance={onAddMaintenance}
                                    expandedId={expandedId}
                                    onToggleExpand={handleToggleExpand}
                                />
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}
