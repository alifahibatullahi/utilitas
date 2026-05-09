'use client';

import { useState, useEffect, useRef } from 'react';
import type { CriticalWithMaintenance, CriticalActivityLogRow, MaintenanceLogRow, HarScope, PhotoRow, MaintenanceType, WorkOrderWithPekerjaan } from '@/lib/supabase/types';
import { FOREMAN_OPTIONS } from '@/lib/constants';
import StatusBadge from './StatusBadge';
import ScopeBadge from './ScopeBadge';
import CriticalDetailModal from './CriticalDetailModal';
import WorkOrderDetailModal from './WorkOrderDetailModal';
import EditableCombobox, { type ComboboxItem } from './EditableCombobox';
import MasterDataFormModal from './MasterDataFormModal';
import { useEquipmentItems } from '@/hooks/useMasterData';

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
    onRefresh?: () => Promise<void>;
    fetchPhotos?: (type: 'critical', id: string) => Promise<PhotoRow[]>;
    deletePhoto?: (id: string) => Promise<{ error: string | null }>;
    operatorName?: string;
    expandedId?: string | null;
    onSetExpandedId?: (id: string | null) => void;
    expandedWOId?: string | null;
    onSetExpandedWOId?: (id: string | null) => void;
    onChangeCriticalStatus?: (id: string, newStatus: 'OPEN' | 'CLOSED') => Promise<void>;
    onChangeWorkOrderStatus?: (id: string, newStatus: 'OPEN' | 'IP' | 'OK') => Promise<void>;
    addActivityNote?: (criticalId: string, note: string, actor?: string | null) => Promise<{ error: string | null }>;
    addWOActivityNote?: (workOrderId: string, note: string, actor?: string | null) => Promise<{ error: string | null }>;
    fetchWOPhotos?: (workOrderId: string) => Promise<PhotoRow[]>;
}

type TableStatusTab = 'ALL' | 'OPEN' | 'CLOSED';

const STATUS_TABS: { key: TableStatusTab; label: string }[] = [
    { key: 'ALL', label: 'Semua' },
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

// ─── Clickable Status Dropdown ───
function ClickableStatusDropdown({
    currentStatus,
    options,
    onChange,
    label,
}: {
    currentStatus: string;
    options: { value: string; label: string; color: string }[];
    onChange: (newStatus: string) => Promise<void> | void;
    label: string;
}) {
    const [open, setOpen] = useState(false);
    const [updating, setUpdating] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const current = options.find(o => o.value === currentStatus);

    async function handleSelect(value: string) {
        if (value === currentStatus) { setOpen(false); return; }
        setUpdating(true);
        try { await onChange(value); }
        finally { setUpdating(false); setOpen(false); }
    }

    return (
        <div ref={ref} className="relative inline-block">
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                disabled={updating}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-extrabold uppercase tracking-wide shadow-sm transition-all cursor-pointer hover:opacity-80 disabled:opacity-50 ${current?.color ?? 'bg-gray-200 text-gray-700'}`}
                title={`Klik untuk ubah status (${label})`}
            >
                {updating ? (
                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
                ) : null}
                {current?.label ?? currentStatus}
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
            </button>
            {open && (
                <div className="absolute z-50 left-0 mt-1 min-w-[160px] bg-white border-2 border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest border-b border-gray-100 bg-gray-50">
                        Ubah Status
                    </div>
                    {options.map(opt => {
                        const active = opt.value === currentStatus;
                        return (
                            <button
                                key={opt.value}
                                onClick={(e) => { e.stopPropagation(); handleSelect(opt.value); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors text-left ${active ? `${opt.color}` : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${opt.color.split(' ')[0]}`} />
                                {opt.label}
                                {active && <span className="ml-auto text-[10px] text-gray-400 normal-case">saat ini</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const CRITICAL_STATUS_OPTIONS = [
    { value: 'OPEN',   label: 'Open',   color: 'bg-rose-500 text-white' },
    { value: 'CLOSED', label: 'Closed', color: 'bg-slate-600 text-white' },
];

const WO_STATUS_OPTIONS = [
    { value: 'OPEN',   label: 'Open',   color: 'bg-rose-500 text-white' },
    { value: 'OK',     label: 'Closed', color: 'bg-slate-600 text-white' },
];

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
    if (tab === 'ALL') return criticals;
    return criticals.filter(c => c.status === tab);
}

function getTabCounts(criticals: CriticalWithMaintenance[]): Record<TableStatusTab, number> {
    return {
        ALL:    criticals.length,
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
    onChangeStatus, displayItem
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
    onChangeStatus?: (id: string, newStatus: 'OPEN' | 'CLOSED') => Promise<void>;
    displayItem: string;
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
                        className={`p-1 rounded transition-all hover:scale-110 active:scale-95 ${starred ? 'text-amber-400 hover:text-amber-500 drop-shadow-sm' : 'text-gray-200 hover:text-amber-300'}`}
                        title={starred ? 'Hapus starred' : 'Tambah starred'}
                    >
                        <span className="material-symbols-outlined block" style={{ fontSize: 26, fontVariationSettings: starred ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                    </button>
                </td>
                {/* Tanggal */}
                <td className="px-5 py-5 whitespace-nowrap text-lg font-bold text-black">{formatDate(critical.date)}</td>
                {/* Item */}
                <td className="px-5 py-5 text-lg font-black text-black whitespace-nowrap">{displayItem}</td>
                {/* Deskripsi */}
                <td className="px-5 py-5 text-lg font-medium text-black max-w-3xl leading-relaxed">
                    <span className="line-clamp-3 whitespace-pre-wrap">{critical.deskripsi}</span>
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
                    <div className="flex flex-col gap-1 items-start">
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Critical</span>
                        {onChangeStatus ? (
                            <ClickableStatusDropdown
                                currentStatus={critical.status}
                                options={CRITICAL_STATUS_OPTIONS}
                                onChange={(s) => onChangeStatus(critical.id, s as 'OPEN' | 'CLOSED')}
                                label="Critical"
                            />
                        ) : (
                            <StatusBadge status={critical.status} solid className="px-3 py-1 text-sm shadow-sm" />
                        )}
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
    wo, isEven, onEdit, onDelete, onToggleExpand, onChangeStatus, displayItem
}: {
    wo: WorkOrderWithPekerjaan;
    isEven: boolean;
    onEdit?: (wo: WorkOrderWithPekerjaan) => void;
    onDelete?: (id: string) => Promise<void>;
    onToggleExpand: (id: string) => void;
    onChangeStatus?: (id: string, newStatus: 'OPEN' | 'IP' | 'OK') => Promise<void>;
    displayItem: string;
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
            <td className="px-5 py-4 text-base font-black text-black whitespace-nowrap">{displayItem}</td>
            {/* Deskripsi */}
            <td className="px-5 py-4 text-base font-medium text-black max-w-3xl leading-relaxed">
                <span className="line-clamp-3 whitespace-pre-wrap">{wo.deskripsi}</span>
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
                <div className="flex flex-col gap-1 items-start">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${tipeColor}`}>{isPreventif ? 'Preventif' : 'Modifikasi'}</span>
                    {onChangeStatus ? (
                        <ClickableStatusDropdown
                            currentStatus={wo.status}
                            options={WO_STATUS_OPTIONS}
                            onChange={(s) => onChangeStatus(wo.id, s as 'OPEN' | 'IP' | 'OK')}
                            label="Pekerjaan"
                        />
                    ) : (
                        <StatusBadge status={wo.status} solid className="px-3 py-1 text-sm shadow-sm" />
                    )}
                </div>
            </td>
            {/* Actions */}
            <td className="px-5 py-4 text-center">
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => onToggleExpand(wo.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/20 hover:from-blue-600 hover:to-blue-700 transition-all"
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
function ItemSearchCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const { items, createItem, updateItem } = useEquipmentItems();
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const comboboxItems: ComboboxItem[] = items.map(it => ({
        id: it.id, value: `${it.no_item} - ${it.deskripsi}`, primary: it.deskripsi, secondary: it.no_item,
    }));

    const editing = editingId ? items.find(i => i.id === editingId) : null;
    const initialValues = editing ? { no_item: editing.no_item, deskripsi: editing.deskripsi } : undefined;

    return (
        <div className="w-[420px]">
            <EditableCombobox
                value={value}
                onChange={onChange}
                items={comboboxItems}
                light={true}
                placeholder="Cari item..."
                onAdd={() => { setEditingId(null); setFormOpen(true); }}
                onEdit={(id) => { setEditingId(id); setFormOpen(true); }}
                addLabel="+ Tambahkan item baru"
            />
            <MasterDataFormModal
                open={formOpen}
                title={editing ? `Edit Item — ${editing.no_item}` : 'Tambah Item Baru'}
                fields={[
                    { key: 'no_item', label: 'No Item', placeholder: 'cth: 20 P-09.05 D', required: true },
                    { key: 'deskripsi', label: 'Deskripsi', placeholder: 'cth: Dosing Pump D', required: true },
                ]}
                initial={initialValues}
                onClose={() => { setFormOpen(false); setEditingId(null); }}
                onSubmit={async (data) => {
                    if (editingId) return updateItem(editingId, { no_item: data.no_item, deskripsi: data.deskripsi });
                    return createItem({ no_item: data.no_item, deskripsi: data.deskripsi });
                }}
            />
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
    onChangeStatus,
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
    onChangeStatus?: (id: string, newStatus: 'OPEN' | 'CLOSED') => Promise<void>;
    getDisplayItem: (item: string) => string;
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
                    onChangeStatus={onChangeStatus}
                    displayItem={getDisplayItem(c.item)}
                />
            ))}
        </>
    );
}

// ─── Main Export ───
export default function CriticalTableView({ criticals, workOrders = [], onEditCritical, onDeleteCritical, onAddCritical, onEditMaintenance, onDeleteMaintenance, onAddMaintenance, onEditWorkOrder, onDeleteWorkOrder, onAddWorkOrder, onAddPekerjaanToWO, onRefresh, fetchPhotos, deletePhoto, operatorName, expandedId: expandedIdProp, onSetExpandedId, expandedWOId: expandedWOIdProp, onSetExpandedWOId, onChangeCriticalStatus, onChangeWorkOrderStatus, addActivityNote, addWOActivityNote, fetchWOPhotos }: CriticalTableViewProps) {
    const { items: equipmentItems } = useEquipmentItems();
    
    function getDisplayItem(rawItem: string) {
        if (!rawItem) return '-';
        if (rawItem.includes(' - ')) return rawItem;
        const found = equipmentItems.find(it => it.deskripsi === rawItem);
        if (found && found.no_item) return `${found.no_item} - ${found.deskripsi}`;
        return rawItem;
    }

    const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<TableStatusTab>('ALL');
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

    const [currentPage, setCurrentPage]       = useState(1);
    const ITEMS_PER_PAGE = 15;

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
        setCurrentPage(1);
    }

    const tabCounts = {
        ALL:    criticals.length + workOrders.length,
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
        // ALL => no status filter
        if (filterItem && !w.item.toLowerCase().includes(filterItem.toLowerCase())) return false;
        if (filterScope && w.scope !== filterScope) return false;
        if (filterDateFrom && w.date < filterDateFrom) return false;
        if (filterDateTo   && w.date > filterDateTo)   return false;
        return true;
    });

    const combinedFilteredItems = [
        ...filteredCriticals.map(c => ({ ...c, _type: 'critical' as const })),
        ...filteredWorkOrders.map(w => ({ ...w, _type: 'wo' as const }))
    ].sort((a, b) => {
        // status: OPEN/IP di atas, CLOSED/OK di bawah
        const aClosed = a._type === 'critical' ? a.status === 'CLOSED' : a.status === 'OK';
        const bClosed = b._type === 'critical' ? b.status === 'CLOSED' : b.status === 'OK';
        if (aClosed !== bClosed) return aClosed ? 1 : -1;
        // tanggal terbaru di atas
        return (b.date || '').localeCompare(a.date || '');
    });
    const totalPages = Math.max(1, Math.ceil(combinedFilteredItems.length / ITEMS_PER_PAGE));
    const paginatedItems = combinedFilteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const allFilteredItems = combinedFilteredItems.length;

    return (
        <div className="flex flex-col gap-4">
            {/* ── Starred Section ── */}
            {starredItems.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-amber-400 drop-shadow-sm" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest mt-0.5">Starred</span>
                        <span className="text-[10px] font-bold text-gray-400 mt-0.5">({starredItems.length})</span>
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
                                        onChangeStatus={onChangeCriticalStatus}
                                        getDisplayItem={getDisplayItem}
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
                    onClick={onAddCritical}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-50 text-rose-600 border-2 border-rose-200 text-sm font-black hover:bg-rose-100 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>warning</span>
                    + Tambah Critical
                </button>
                <button
                    onClick={onAddWorkOrder}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 border-2 border-emerald-200 text-sm font-black hover:bg-emerald-100 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>event_available</span>
                    + Preventif / Modifikasi
                </button>
            </div>

            {/* ── Main Table ── */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
                    {/* Item search combobox */}
                    <ItemSearchCombobox
                        value={filterItem}
                        onChange={val => { setFilterItem(val); setExpandedId(null); setCurrentPage(1); }}
                    />
                    {/* Status Tabs */}
                    <div className="flex bg-gray-100 rounded-xl p-1 gap-1 border border-gray-200 shadow-inner">
                        {STATUS_TABS.map(t => (
                            <button
                                key={t.key}
                                onClick={() => { setActiveTab(t.key); setExpandedId(null); setCurrentPage(1); }}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                                    activeTab === t.key
                                        ? `bg-white shadow-sm border border-gray-200/50 ${
                                            t.key === 'OPEN' ? 'text-amber-600' :
                                            t.key === 'CLOSED' ? 'text-emerald-600' :
                                            'text-blue-600'
                                          }`
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {t.label} ({tabCounts[t.key]})
                            </button>
                        ))}
                    </div>
                    {/* Scope */}
                    <select
                        value={filterScope}
                        onChange={e => { setFilterScope(e.target.value as HarScope | ''); setExpandedId(null); setCurrentPage(1); }}
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
                            onChange={e => { setFilterDateFrom(e.target.value); setExpandedId(null); setCurrentPage(1); }}
                            className="text-sm font-bold text-black bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none shadow-sm cursor-pointer"
                            title="Dari tanggal"
                        />
                        <span className="text-sm font-bold text-gray-400">–</span>
                        <input
                            type="date"
                            value={filterDateTo}
                            onChange={e => { setFilterDateTo(e.target.value); setExpandedId(null); setCurrentPage(1); }}
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
                <div className="overflow-x-auto light-scrollbar">
                    <table className="w-full min-w-[1500px] text-xs border-collapse">
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
                                    {paginatedItems.map((item, idx) => {
                                        const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx;
                                        if (item._type === 'critical') {
                                            return (
                                                <CriticalRow
                                                    key={`crit-${item.id}`}
                                                    critical={item as any}
                                                    starred={starredIds.has(item.id)}
                                                    isEven={globalIdx % 2 === 1}
                                                    rowIndex={globalIdx + 1}
                                                    toggleStar={toggleStar}
                                                    onEditCritical={onEditCritical}
                                                    onDeleteCritical={onDeleteCritical}
                                                    expandedId={expandedId}
                                                    onToggleExpand={handleToggleExpand}
                                                    onChangeStatus={onChangeCriticalStatus}
                                                    displayItem={getDisplayItem((item as any).item)}
                                                />
                                            );
                                        } else {
                                            return (
                                                <WorkOrderRow
                                                    key={`wo-${item.id}`}
                                                    wo={item as any}
                                                    isEven={globalIdx % 2 === 1}
                                                    onEdit={onEditWorkOrder}
                                                    onDelete={onDeleteWorkOrder}
                                                    onToggleExpand={id => setExpandedWOId(expandedWOId === id ? null : id)}
                                                    onChangeStatus={onChangeWorkOrderStatus}
                                                    displayItem={getDisplayItem((item as any).item)}
                                                />
                                            );
                                        }
                                    })}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-100">
                        <span className="text-xs text-gray-500 font-medium">
                            Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, combinedFilteredItems.length)} dari {combinedFilteredItems.length} item
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                            </button>
                            <span className="text-xs font-bold text-gray-700 mx-2">
                                Halaman {currentPage} dari {totalPages}
                            </span>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}

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
                            onRefresh={onRefresh}
                            fetchPhotos={fetchPhotos}
                            deletePhoto={deletePhoto}
                            operatorName={operatorName}
                            addActivityNote={addActivityNote}
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
                            onRefresh={onRefresh}
                            fetchPhotos={fetchWOPhotos}
                            deletePhoto={deletePhoto}
                            operatorName={operatorName}
                            addActivityNote={addWOActivityNote}
                        />
                    );
                })()}

            </div>
        </div>
    );
}
