'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import type { MaintenanceWithCritical, WorkOrderWithPekerjaan, MaintenanceStatus, MaintenanceType } from '@/lib/supabase/types';
import ScopeBadge from './ScopeBadge';
import ClickableStatusDropdown from './ClickableStatusDropdown';

const TIPE_LABEL: Record<MaintenanceType, string> = {
    corrective: 'Corrective',
    preventif: 'Preventif',
    modifikasi: 'Modifikasi',
};

const TIPE_BADGE: Record<MaintenanceType, string> = {
    corrective: 'bg-rose-100 text-rose-700 border-rose-300',
    preventif: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    modifikasi: 'bg-violet-100 text-violet-700 border-violet-300',
};

const STATUS_OPTIONS = [
    { value: 'OPEN', label: 'OPEN', color: 'bg-rose-500 text-white' },
    { value: 'IP', label: 'IN PROGRESS', color: 'bg-amber-500 text-white' },
    { value: 'OK', label: 'SELESAI', color: 'bg-slate-600 text-white' },
];

interface MaintenanceTableViewProps {
    maintenances: MaintenanceWithCritical[];
    workOrders: WorkOrderWithPekerjaan[];
    onEdit: (m: MaintenanceWithCritical) => void;
    onDelete: (id: string) => Promise<void> | void;
    onChangeStatus: (id: string, newStatus: MaintenanceStatus) => Promise<unknown> | unknown;
    onToggleExpand: (id: string, type: 'critical' | 'wo') => void;
}

export default function MaintenanceTableView({ maintenances, workOrders, onEdit, onDelete, onChangeStatus, onToggleExpand }: MaintenanceTableViewProps) {
    const [search, setSearch] = useState('');
    const [filterTipe, setFilterTipe] = useState<MaintenanceType | 'all'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'done'>('all');
    const [filterScope, setFilterScope] = useState<string>('all');
    const [filterForeman, setFilterForeman] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');

    const woById = useMemo(() => {
        const map: Record<string, WorkOrderWithPekerjaan> = {};
        for (const wo of workOrders) map[wo.id] = wo;
        return map;
    }, [workOrders]);

    const scopes = useMemo(() => Array.from(new Set(maintenances.map(m => m.scope))).sort(), [maintenances]);
    const foremen = useMemo(() => Array.from(new Set(maintenances.map(m => m.foreman))).sort(), [maintenances]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return maintenances
            .filter(m => m.keterangan !== 'IS_NOTE' && m.item !== 'NOTE')
            .filter(m => filterTipe === 'all' || m.tipe === filterTipe)
            .filter(m => filterStatus === 'all' || (filterStatus === 'active' ? m.status !== 'OK' : m.status === 'OK'))
            .filter(m => filterScope === 'all' || m.scope === filterScope)
            .filter(m => filterForeman === 'all' || m.foreman === filterForeman)
            .filter(m => !dateFrom || m.date >= dateFrom)
            .filter(m => !dateTo || m.date <= dateTo)
            .filter(m => !q || m.item.toLowerCase().includes(q) || m.uraian.toLowerCase().includes(q) || (m.notif ?? '').toLowerCase().includes(q))
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [maintenances, search, filterTipe, filterStatus, filterScope, filterForeman, dateFrom, dateTo]);

    const counts = useMemo(() => ({
        total: filtered.length,
        active: filtered.filter(m => m.status !== 'OK').length,
        done: filtered.filter(m => m.status === 'OK').length,
    }), [filtered]);

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100 bg-gray-50/60">
                <div className="relative flex-1 min-w-[200px]">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" style={{ fontSize: 16 }}>search</span>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Cari item / uraian / notif…"
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                </div>

                <select value={filterTipe} onChange={e => setFilterTipe(e.target.value as MaintenanceType | 'all')} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none cursor-pointer">
                    <option value="all">Semua Tipe</option>
                    <option value="corrective">Corrective</option>
                    <option value="preventif">Preventif</option>
                    <option value="modifikasi">Modifikasi</option>
                </select>

                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'done')} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none cursor-pointer">
                    <option value="all">Semua Status</option>
                    <option value="active">Belum Selesai</option>
                    <option value="done">Selesai</option>
                </select>

                <select value={filterScope} onChange={e => setFilterScope(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none cursor-pointer">
                    <option value="all">Semua Scope</option>
                    {scopes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <select value={filterForeman} onChange={e => setFilterForeman(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none cursor-pointer">
                    <option value="all">Semua Foreman</option>
                    {foremen.map(f => <option key={f} value={f}>{f === 'foreman_turbin' ? 'Turbin' : f === 'foreman_boiler' ? 'Boiler' : f}</option>)}
                </select>

                <div className="flex items-center gap-1.5">
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-2 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 outline-none cursor-pointer" />
                    <span className="text-gray-400 text-xs font-bold">→</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-2 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 outline-none cursor-pointer" />
                </div>

                {(search || filterTipe !== 'all' || filterStatus !== 'all' || filterScope !== 'all' || filterForeman !== 'all' || dateFrom || dateTo) && (
                    <button
                        onClick={() => { setSearch(''); setFilterTipe('all'); setFilterStatus('all'); setFilterScope('all'); setFilterForeman('all'); setDateFrom(''); setDateTo(''); }}
                        className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold cursor-pointer transition-colors"
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Summary chips */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-white text-xs font-bold text-gray-500">
                <span>Total: <span className="text-gray-800">{counts.total}</span></span>
                <span className="text-gray-300">·</span>
                <span className="text-amber-600">Belum Selesai: {counts.active}</span>
                <span className="text-gray-300">·</span>
                <span className="text-emerald-600">Selesai: {counts.done}</span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto light-scrollbar">
                <table className="w-full text-sm">
                    <thead className="bg-[#EAEFF5] border-b border-[#D8E2ED] sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest whitespace-nowrap">Tanggal</th>
                            <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest">Item</th>
                            <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest min-w-[200px]">Uraian</th>
                            <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest">Tipe</th>
                            <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest">Scope</th>
                            <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest whitespace-nowrap">Foreman</th>
                            <th className="px-4 py-4 text-left text-xs font-black text-black uppercase tracking-widest">Status</th>
                            <th className="px-4 py-4 text-center text-xs font-black text-black uppercase tracking-widest whitespace-nowrap">Detail / Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-12 text-gray-400 text-sm font-medium">
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="material-symbols-outlined text-4xl text-gray-300">build</span>
                                        Tidak ada maintenance yang sesuai filter.
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filtered.map(m => {
                                const wo = m.work_order_id ? woById[m.work_order_id] : null;
                                const asal = m.critical_equipment
                                    ? { type: 'critical' as const, label: m.critical_equipment.item, sub: m.critical_equipment.deskripsi }
                                    : wo
                                    ? { type: 'wo' as const, label: wo.item, sub: wo.tipe === 'preventif' ? 'Preventif' : 'Modifikasi' }
                                    : null;
                                return (
                                    <tr key={m.id} className="border-b border-gray-100 transition-colors hover:bg-blue-50 bg-white">
                                        <td className="px-4 py-4 whitespace-nowrap text-lg font-bold text-black">{new Date(m.date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                        <td className="px-4 py-4 text-lg font-black text-black whitespace-nowrap">{m.item}</td>
                                        <td className="px-4 py-4 text-lg font-medium text-black"><span className="line-clamp-3 whitespace-pre-wrap">{m.uraian}</span></td>
                                        <td className="px-4 py-4">
                                            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${TIPE_BADGE[m.tipe]}`}>
                                                {m.tipe === 'corrective' ? 'Critical' : TIPE_LABEL[m.tipe]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4"><ScopeBadge scope={m.scope} solid className="px-3 py-1.5 text-sm shadow-sm" /></td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex flex-col leading-tight">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Foreman</span>
                                                <span className="text-lg font-bold text-black">{m.foreman === 'foreman_turbin' ? 'Turbin' : m.foreman === 'foreman_boiler' ? 'Boiler' : m.foreman}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                <ClickableStatusDropdown
                                                    currentStatus={m.status}
                                                    options={STATUS_OPTIONS}
                                                    onChange={newStatus => { onChangeStatus(m.id, newStatus as MaintenanceStatus); }}
                                                    label={m.item}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => onToggleExpand(asal?.type === 'critical' && m.critical_id ? m.critical_id : (m.work_order_id ?? ''), asal?.type || 'critical')}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/20 hover:from-blue-600 hover:to-blue-700 transition-all"
                                                    title="Detail"
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
                                                    Detail
                                                </button>
                                                <button
                                                    onClick={() => onEdit(m)}
                                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm cursor-pointer"
                                                    title="Edit"
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>edit</span>
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        // Check if this is the last real pekerjaan in a work order
                                                        if (m.work_order_id && wo) {
                                                            const siblingsInWO = maintenances.filter(
                                                                s => s.work_order_id === m.work_order_id
                                                                    && s.id !== m.id
                                                                    && s.keterangan !== 'IS_NOTE'
                                                                    && s.item !== 'NOTE'
                                                            );
                                                            if (siblingsInWO.length === 0) {
                                                                const tipeLabel = wo.tipe === 'preventif' ? 'Preventif' : 'Modifikasi';
                                                                if (confirm(`Ini adalah pekerjaan terakhir. Menghapusnya akan menghapus ${tipeLabel} "${wo.item}" secara keseluruhan.\n\nLanjutkan hapus?`)) {
                                                                    await onDelete(m.id);
                                                                }
                                                                return;
                                                            }
                                                        }
                                                        if (confirm(`Hapus maintenance "${m.uraian}"?`)) await onDelete(m.id);
                                                    }}
                                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm cursor-pointer"
                                                    title="Hapus"
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
}
