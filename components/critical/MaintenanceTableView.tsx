'use client';

import { useMemo, useState } from 'react';
import type { MaintenanceWithCritical, WorkOrderWithPekerjaan, MaintenanceStatus, MaintenanceType } from '@/lib/supabase/types';
import ScopeBadge from './ScopeBadge';

const TIPE_LABEL: Record<MaintenanceType, string> = {
    corrective: 'Corrective',
    preventif: 'Preventif',
    modifikasi: 'Modifikasi',
};

const TIPE_BADGE: Record<MaintenanceType, string> = {
    corrective: 'bg-rose-50 text-rose-600 border-rose-200',
    preventif: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    modifikasi: 'bg-violet-50 text-violet-600 border-violet-200',
};

interface MaintenanceTableViewProps {
    maintenances: MaintenanceWithCritical[];
    workOrders: WorkOrderWithPekerjaan[];
    onEdit: (m: MaintenanceWithCritical) => void;
    onDelete: (id: string) => Promise<void> | void;
    onChangeStatus: (id: string, newStatus: MaintenanceStatus) => Promise<unknown> | unknown;
}

export default function MaintenanceTableView({ maintenances, workOrders, onEdit, onDelete, onChangeStatus }: MaintenanceTableViewProps) {
    const [search, setSearch] = useState('');
    const [filterTipe, setFilterTipe] = useState<MaintenanceType | 'all'>('all');
    const [filterStatus, setFilterStatus] = useState<MaintenanceStatus | 'all'>('all');
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
            .filter(m => filterStatus === 'all' || m.status === filterStatus)
            .filter(m => filterScope === 'all' || m.scope === filterScope)
            .filter(m => filterForeman === 'all' || m.foreman === filterForeman)
            .filter(m => !dateFrom || m.date >= dateFrom)
            .filter(m => !dateTo || m.date <= dateTo)
            .filter(m => !q || m.item.toLowerCase().includes(q) || m.uraian.toLowerCase().includes(q) || (m.notif ?? '').toLowerCase().includes(q))
            .sort((a, b) => {
                // OPEN/IP di atas, OK di bawah; lalu by date desc
                const order = { OPEN: 0, IP: 1, OK: 2 };
                if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
                return b.date.localeCompare(a.date);
            });
    }, [maintenances, search, filterTipe, filterStatus, filterScope, filterForeman, dateFrom, dateTo]);

    const counts = useMemo(() => ({
        total: filtered.length,
        open: filtered.filter(m => m.status === 'OPEN').length,
        ip: filtered.filter(m => m.status === 'IP').length,
        ok: filtered.filter(m => m.status === 'OK').length,
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

                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as MaintenanceStatus | 'all')} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none cursor-pointer">
                    <option value="all">Semua Status</option>
                    <option value="OPEN">Open</option>
                    <option value="IP">In Progress</option>
                    <option value="OK">Selesai</option>
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
                <span className="text-blue-600">Open: {counts.open}</span>
                <span className="text-gray-300">·</span>
                <span className="text-amber-600">IP: {counts.ip}</span>
                <span className="text-gray-300">·</span>
                <span className="text-emerald-600">Selesai: {counts.ok}</span>
            </div>

            {/* Table */}
            <div className="overflow-auto light-scrollbar" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            <th className="px-4 py-3">Tanggal</th>
                            <th className="px-4 py-3">Item</th>
                            <th className="px-4 py-3 min-w-[200px]">Uraian</th>
                            <th className="px-4 py-3">Tipe</th>
                            <th className="px-4 py-3">Scope</th>
                            <th className="px-4 py-3">Foreman</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Asal</th>
                            <th className="px-4 py-3 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-12 text-gray-400 text-sm font-medium">
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
                                    <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                                        <td className="px-4 py-3 text-xs text-gray-700 font-medium whitespace-nowrap">{m.date}</td>
                                        <td className="px-4 py-3 text-xs text-gray-800 font-bold">{m.item}</td>
                                        <td className="px-4 py-3 text-xs text-gray-700">{m.uraian}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${TIPE_BADGE[m.tipe]}`}>
                                                {TIPE_LABEL[m.tipe]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3"><ScopeBadge scope={m.scope} light /></td>
                                        <td className="px-4 py-3 text-xs text-gray-700 font-medium">{m.foreman === 'foreman_turbin' ? 'Turbin' : m.foreman === 'foreman_boiler' ? 'Boiler' : m.foreman}</td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={m.status}
                                                onChange={e => onChangeStatus(m.id, e.target.value as MaintenanceStatus)}
                                                className="px-2 py-1 rounded-md border border-gray-200 bg-white text-[11px] font-bold cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/20"
                                            >
                                                <option value="OPEN">Open</option>
                                                <option value="IP">In Progress</option>
                                                <option value="OK">Selesai</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {asal ? (
                                                <div className="flex items-center gap-1">
                                                    <span className={`material-symbols-outlined ${asal.type === 'critical' ? 'text-rose-500' : 'text-emerald-500'}`} style={{ fontSize: 14 }}>
                                                        {asal.type === 'critical' ? 'warning' : 'event_available'}
                                                    </span>
                                                    <span className="font-bold text-gray-700">{asal.label}</span>
                                                    <span className="text-gray-400 text-[10px]">· {asal.sub}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 italic">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => onEdit(m)}
                                                    className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
                                                    title="Edit"
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (confirm(`Hapus maintenance "${m.uraian}"?`)) await onDelete(m.id);
                                                    }}
                                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                                                    title="Hapus"
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
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
