'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { createClient } from '@/lib/supabase/client';

// ─── Types for raw DB rows ───
interface AnyRow { [key: string]: unknown }

interface TableSection {
    id: string;
    label: string;
    icon: string;
    color: string;
    tables: { name: string; label: string; query: string; joinInfo?: string }[];
}

// ─── Sections definition ───
const SECTIONS: TableSection[] = [
    {
        id: 'shift', label: 'Laporan Shift', icon: 'schedule', color: '#2b7cee',
        tables: [
            { name: 'shift_reports', label: 'Shift Reports (Anchor)', query: 'id,date,shift,group_name,supervisor,status,catatan,created_at' },
            { name: 'shift_turbin', label: 'Turbin', query: '*', joinInfo: 'shift_reports(date,shift,group_name,supervisor)' },
            { name: 'shift_boiler', label: 'Boiler', query: '*', joinInfo: 'shift_reports(date,shift,group_name,supervisor)' },
            { name: 'shift_steam_dist', label: 'Steam Distribution', query: '*', joinInfo: 'shift_reports(date,shift,group_name,supervisor)' },
            { name: 'shift_generator_gi', label: 'Generator & GI', query: '*', joinInfo: 'shift_reports(date,shift,group_name,supervisor)' },
            { name: 'shift_power_dist', label: 'Power Distribution', query: '*', joinInfo: 'shift_reports(date,shift,group_name,supervisor)' },
            { name: 'shift_esp_handling', label: 'ESP & Handling', query: '*', joinInfo: 'shift_reports(date,shift,group_name,supervisor)' },
            { name: 'shift_tankyard', label: 'Tankyard', query: '*', joinInfo: 'shift_reports(date,shift,group_name,supervisor)' },
            { name: 'shift_coal_bunker', label: 'Coal & Bunker', query: '*', joinInfo: 'shift_reports(date,shift,group_name,supervisor)' },
            { name: 'shift_water_quality', label: 'Water Quality', query: '*', joinInfo: 'shift_reports(date,shift,group_name,supervisor)' },
            { name: 'shift_personnel', label: 'Personnel', query: '*', joinInfo: 'shift_reports(date,shift,group_name,supervisor)' },
        ],
    },
    {
        id: 'daily', label: 'Laporan Harian', icon: 'summarize', color: '#8b5cf6',
        tables: [
            { name: 'daily_reports', label: 'Daily Reports (Anchor)', query: '*' },
            { name: 'daily_report_steam', label: 'Steam', query: '*', joinInfo: 'daily_reports(date,status)' },
            { name: 'daily_report_power', label: 'Power', query: '*', joinInfo: 'daily_reports(date,status)' },
            { name: 'daily_report_coal', label: 'Coal', query: '*', joinInfo: 'daily_reports(date,status)' },
            { name: 'daily_report_turbine_misc', label: 'Turbine Misc', query: '*', joinInfo: 'daily_reports(date,status)' },
            { name: 'daily_report_stock_tank', label: 'Stock & Tank', query: '*', joinInfo: 'daily_reports(date,status)' },
            { name: 'daily_report_coal_transfer', label: 'Coal Transfer', query: '*', joinInfo: 'daily_reports(date,status)' },
            { name: 'daily_report_totalizer', label: 'Totalizer', query: '*', joinInfo: 'daily_reports(date,status)' },
        ],
    },
    {
        id: 'tank', label: 'Tank Level & Flow', icon: 'water_drop', color: '#0ea5e9',
        tables: [
            { name: 'tank_levels', label: 'Tank Levels', query: '*' },
            { name: 'tank_flow_readings', label: 'Tank Flow Readings', query: '*' },
        ],
    },
    {
        id: 'critical', label: 'Critical & Maintenance', icon: 'warning', color: '#f59e0b',
        tables: [
            { name: 'critical_equipment', label: 'Critical Equipment', query: '*' },
            { name: 'maintenance_logs', label: 'Maintenance Logs', query: '*' },
            { name: 'critical_activity_logs', label: 'Activity Logs', query: '*' },
        ],
    },
    {
        id: 'unloading', label: 'Unloading', icon: 'local_shipping', color: '#10b981',
        tables: [
            { name: 'solar_unloadings', label: 'Solar Unloadings', query: '*' },
            { name: 'ash_unloadings', label: 'Fly Ash Unloadings', query: '*' },
        ],
    },
    {
        id: 'system', label: 'Sistem', icon: 'settings', color: '#64748b',
        tables: [
            { name: 'operators', label: 'Operators', query: '*' },
            { name: 'app_settings', label: 'App Settings', query: '*' },
            { name: 'shift_notes', label: 'Shift Notes', query: '*' },
        ],
    },
];

// ─── Excluded columns from display ───
const EXCLUDED_COLS = ['id', 'shift_report_id', 'daily_report_id'];

// ─── Format column header ───
function formatCol(col: string): string {
    return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Format cell value ───
function formatVal(val: unknown): string {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
        const d = new Date(val);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
            + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    if (typeof val === 'number') {
        return Number.isInteger(val) ? val.toLocaleString('id-ID') : val.toLocaleString('id-ID', { maximumFractionDigits: 2 });
    }
    return String(val);
}

// ─── DataTable component ───
function DataTable({ tableName, label, joinInfo, color }: {
    tableName: string; label: string; joinInfo?: string; color: string;
}) {
    const [rows, setRows] = useState<AnyRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);

    const fetchData = useCallback(async () => {
        if (rows.length > 0 || loading) return;
        setLoading(true);
        setError(null);
        try {
            const supabase = createClient();
            let selectStr = '*';
            if (joinInfo) selectStr = `*,${joinInfo}`;

            const { data, error: err } = await supabase
                .from(tableName)
                .select(selectStr)
                .order('created_at', { ascending: false })
                .limit(500);

            if (err) {
                // Retry without join if join fails
                if (joinInfo) {
                    const { data: d2, error: e2 } = await supabase
                        .from(tableName).select('*')
                        .order('created_at', { ascending: false }).limit(500);
                    if (e2) throw e2;
                    setRows((d2 as unknown as AnyRow[]) || []);
                } else {
                    throw err;
                }
            } else {
                setRows((data as unknown as AnyRow[]) || []);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [tableName, joinInfo, rows.length, loading]);

    const handleToggle = () => {
        const next = !expanded;
        setExpanded(next);
        if (next) fetchData();
    };

    // Get visible columns (exclude id/FK cols)
    const columns = rows.length > 0
        ? Object.keys(rows[0]).filter(c => !EXCLUDED_COLS.includes(c) && typeof rows[0][c] !== 'object')
        : [];

    // Also gather joined data columns
    const joinedKey = rows.length > 0 ? Object.keys(rows[0]).find(k => typeof rows[0][k] === 'object' && rows[0][k] !== null && !Array.isArray(rows[0][k])) : null;
    const joinedCols = (joinedKey && rows.length > 0 && rows[0][joinedKey] && typeof rows[0][joinedKey] === 'object')
        ? Object.keys(rows[0][joinedKey] as Record<string, unknown>)
        : [];

    return (
        <div className="border border-slate-700/50 rounded-lg overflow-hidden">
            {/* Toggle header */}
            <button onClick={handleToggle}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-highlight/60 transition-colors cursor-pointer"
                style={{ backgroundColor: expanded ? `${color}10` : 'transparent' }}>
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-sm" style={{ color }}>
                        {expanded ? 'expand_less' : 'expand_more'}
                    </span>
                    <span className="text-sm font-bold text-white">{label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                        style={{ backgroundColor: `${color}20`, color }}>{tableName}</span>
                    {rows.length > 0 && (
                        <span className="text-xs text-slate-500">{rows.length} rows</span>
                    )}
                </div>
                {loading && <span className="text-xs text-slate-500">Memuat...</span>}
            </button>

            {/* Table content */}
            {expanded && (
                <div className="border-t border-slate-700/30 overflow-x-auto max-h-[500px] overflow-y-auto">
                    {error ? (
                        <p className="p-4 text-rose-400 text-xs">{error}</p>
                    ) : rows.length === 0 && !loading ? (
                        <p className="p-4 text-slate-500 text-xs italic">Tabel kosong atau belum ada data.</p>
                    ) : rows.length > 0 ? (
                        <table className="w-full text-xs min-w-[800px]">
                            <thead className="sticky top-0 z-10">
                                <tr style={{ backgroundColor: `${color}15` }}>
                                    <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30 whitespace-nowrap">#</th>
                                    {joinedCols.map(c => (
                                        <th key={`j-${c}`} className="text-left px-3 py-2 uppercase tracking-wider font-semibold border-b border-slate-700/30 whitespace-nowrap"
                                            style={{ color }}>
                                            {formatCol(c)}
                                        </th>
                                    ))}
                                    {columns.map(c => (
                                        <th key={c} className="text-left px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30 whitespace-nowrap">
                                            {formatCol(c)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/20">
                                {rows.map((row, i) => (
                                    <tr key={i} className="hover:bg-surface-highlight/30 transition-colors">
                                        <td className="px-3 py-2 text-slate-600 tabular-nums">{i + 1}</td>
                                        {joinedCols.map(c => (
                                            <td key={`j-${c}`} className="px-3 py-2 whitespace-nowrap font-semibold" style={{ color }}>
                                                {formatVal((row[joinedKey!] as Record<string, unknown>)?.[c])}
                                            </td>
                                        ))}
                                        {columns.map(c => (
                                            <td key={c} className="px-3 py-2 text-slate-300 whitespace-nowrap">
                                                {c === 'status' ? (
                                                    <StatusBadge value={String(row[c] ?? '')} />
                                                ) : (
                                                    formatVal(row[c])
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : null}
                </div>
            )}
        </div>
    );
}

// ─── Status Badge ───
function StatusBadge({ value }: { value: string }) {
    const v = value.toLowerCase();
    let bg = '#334155'; let fg = '#94a3b8';
    if (v === 'open') { bg = '#1e3a5f'; fg = '#60a5fa'; }
    if (v === 'ip' || v === 'in progress') { bg = '#422006'; fg = '#fbbf24'; }
    if (v === 'ok' || v === 'closed' || v === 'approved' || v === 'submitted') { bg = '#052e16'; fg = '#4ade80'; }
    if (v === 'draft') { bg = '#1e293b'; fg = '#94a3b8'; }
    return (
        <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase" style={{ backgroundColor: bg, color: fg }}>
            {value || '-'}
        </span>
    );
}

// ─── Solar Unloading Table (with Edit/Delete) ───
function SolarUnloadingTable({ color }: { color: string }) {
    const [rows, setRows] = useState<AnyRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [editRow, setEditRow] = useState<AnyRow | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [editForm, setEditForm] = useState({ date: '', liters: '', supplier: '' });
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase.from('solar_unloadings').select('*').order('created_at', { ascending: false }).limit(500);
        setRows((data as unknown as AnyRow[]) || []);
        setLoading(false);
    }, []);

    const handleToggle = () => {
        const next = !expanded;
        setExpanded(next);
        if (next && rows.length === 0) fetchData();
    };

    const handleEdit = (row: AnyRow) => {
        setEditRow(row);
        setEditForm({
            date: String(row.date || ''),
            liters: String(row.liters || ''),
            supplier: String(row.supplier || '').toUpperCase(),
        });
    };

    const handleAdd = () => {
        const today = new Date().toISOString().split('T')[0];
        setIsAdding(true);
        setEditRow({ _new: true });
        setEditForm({ date: today, liters: '', supplier: '' });
    };

    const handleSave = async () => {
        if (!editRow) return;
        setSaving(true);
        const supabase = createClient();
        const payload = {
            date: editForm.date,
            liters: Number(editForm.liters),
            supplier: editForm.supplier.toUpperCase(),
        };
        if (isAdding) {
            await supabase.from('solar_unloadings').insert(payload);
        } else {
            await supabase.from('solar_unloadings').update(payload).eq('id', editRow.id);
        }
        setEditRow(null);
        setIsAdding(false);
        setSaving(false);
        await fetchData();
    };

    const handleDelete = async (id: unknown) => {
        if (!confirm('Hapus data solar unloading ini?')) return;
        const supabase = createClient();
        await supabase.from('solar_unloadings').delete().eq('id', String(id));
        await fetchData();
    };

    return (
        <div className="border border-slate-700/50 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 hover:bg-surface-highlight/60 transition-colors"
                style={{ backgroundColor: expanded ? `${color}10` : 'transparent' }}>
                <button onClick={handleToggle} className="flex items-center gap-3 cursor-pointer">
                    <span className="material-symbols-outlined text-sm" style={{ color }}>{expanded ? 'expand_less' : 'expand_more'}</span>
                    <span className="text-sm font-bold text-white">Solar Unloadings</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ backgroundColor: `${color}20`, color }}>solar_unloadings</span>
                    {rows.length > 0 && <span className="text-xs text-slate-500">{rows.length} rows</span>}
                </button>
                <div className="flex items-center gap-2">
                    {loading && <span className="text-xs text-slate-500">Memuat...</span>}
                    {expanded && (
                        <button onClick={handleAdd}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            style={{ backgroundColor: `${color}20`, color }}>
                            <span className="material-symbols-outlined text-sm">add</span>
                            Tambah
                        </button>
                    )}
                </div>
            </div>
            {expanded && (
                <div className="border-t border-slate-700/30 overflow-x-auto max-h-[500px] overflow-y-auto">
                    {rows.length === 0 && !loading ? (
                        <p className="p-4 text-slate-500 text-xs italic">Tabel kosong atau belum ada data.</p>
                    ) : rows.length > 0 ? (
                        <table className="w-full text-xs min-w-[700px]">
                            <thead className="sticky top-0 z-10">
                                <tr style={{ backgroundColor: `${color}15` }}>
                                    <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">#</th>
                                    <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">Tanggal</th>
                                    <th className="text-right px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">Liter</th>
                                    <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">Supplier</th>
                                    <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">Dibuat</th>
                                    <th className="text-center px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/20">
                                {rows.map((row, i) => (
                                    <tr key={String(row.id)} className="hover:bg-surface-highlight/30 transition-colors">
                                        <td className="px-3 py-2 text-slate-600 tabular-nums">{i + 1}</td>
                                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{formatVal(row.date)}</td>
                                        <td className="px-3 py-2 text-white font-mono font-semibold text-right tabular-nums">{Number(row.liters || 0).toLocaleString('id-ID')}</td>
                                        <td className="px-3 py-2 text-slate-300 font-bold uppercase">{String(row.supplier || '-').toUpperCase()}</td>
                                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatVal(row.created_at)}</td>
                                        <td className="px-3 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => handleEdit(row)} className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer" title="Edit">
                                                    <span className="material-symbols-outlined text-sm">edit</span>
                                                </button>
                                                <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer" title="Hapus">
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : null}
                </div>
            )}
            {/* Add/Edit Modal */}
            {editRow && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setEditRow(null); setIsAdding(false); }}>
                    <div className="bg-surface-dark border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
                        <h4 className="text-base font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg" style={{ color }}>{isAdding ? 'add_circle' : 'edit'}</span>
                            {isAdding ? 'Tambah Solar Unloading' : 'Edit Solar Unloading'}
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Tanggal</label>
                                <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                                    className="w-full px-3 py-2 bg-surface-highlight border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Liter</label>
                                <input type="number" value={editForm.liters} onChange={e => setEditForm(f => ({ ...f, liters: e.target.value }))}
                                    className="w-full px-3 py-2 bg-surface-highlight border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Supplier</label>
                                <input type="text" value={editForm.supplier} onChange={e => setEditForm(f => ({ ...f, supplier: e.target.value.toUpperCase() }))}
                                    className="w-full px-3 py-2 bg-surface-highlight border border-slate-700 rounded-lg text-sm text-slate-200 uppercase focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => { setEditRow(null); setIsAdding(false); }} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer">Batal</button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                                {saving ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Ash Unloading Table (with Edit/Delete) ───
function AshUnloadingTable({ color }: { color: string }) {
    const [rows, setRows] = useState<AnyRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [editRow, setEditRow] = useState<AnyRow | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [editForm, setEditForm] = useState({ date: '', shift: '', silo: '', perusahaan: '', tujuan: '', ritase: '' });
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase.from('ash_unloadings').select('*').order('created_at', { ascending: false }).limit(500);
        setRows((data as unknown as AnyRow[]) || []);
        setLoading(false);
    }, []);

    const handleToggle = () => {
        const next = !expanded;
        setExpanded(next);
        if (next && rows.length === 0) fetchData();
    };

    const handleEdit = (row: AnyRow) => {
        setEditRow(row);
        setEditForm({
            date: String(row.date || ''),
            shift: String(row.shift || ''),
            silo: String(row.silo || ''),
            perusahaan: String(row.perusahaan || '').toUpperCase(),
            tujuan: String(row.tujuan || '').toUpperCase(),
            ritase: String(row.ritase || ''),
        });
    };

    const handleAdd = () => {
        const today = new Date().toISOString().split('T')[0];
        setIsAdding(true);
        setEditRow({ _new: true });
        setEditForm({ date: today, shift: 'pagi', silo: 'A', perusahaan: '', tujuan: '', ritase: '' });
    };

    const handleSave = async () => {
        if (!editRow) return;
        setSaving(true);
        const supabase = createClient();
        const payload = {
            date: editForm.date,
            shift: editForm.shift,
            silo: editForm.silo,
            perusahaan: editForm.perusahaan.toUpperCase(),
            tujuan: editForm.tujuan.toUpperCase(),
            ritase: Number(editForm.ritase),
        };
        if (isAdding) {
            await supabase.from('ash_unloadings').insert(payload);
        } else {
            await supabase.from('ash_unloadings').update(payload).eq('id', editRow.id);
        }
        setEditRow(null);
        setIsAdding(false);
        setSaving(false);
        await fetchData();
    };

    const handleDelete = async (id: unknown) => {
        if (!confirm('Hapus data fly ash unloading ini?')) return;
        const supabase = createClient();
        await supabase.from('ash_unloadings').delete().eq('id', String(id));
        await fetchData();
    };

    return (
        <div className="border border-slate-700/50 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 hover:bg-surface-highlight/60 transition-colors"
                style={{ backgroundColor: expanded ? `${color}10` : 'transparent' }}>
                <button onClick={handleToggle} className="flex items-center gap-3 cursor-pointer">
                    <span className="material-symbols-outlined text-sm" style={{ color }}>{expanded ? 'expand_less' : 'expand_more'}</span>
                    <span className="text-sm font-bold text-white">Fly Ash Unloadings</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ backgroundColor: `${color}20`, color }}>ash_unloadings</span>
                    {rows.length > 0 && <span className="text-xs text-slate-500">{rows.length} rows</span>}
                </button>
                <div className="flex items-center gap-2">
                    {loading && <span className="text-xs text-slate-500">Memuat...</span>}
                    {expanded && (
                        <button onClick={handleAdd}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            style={{ backgroundColor: `${color}20`, color }}>
                            <span className="material-symbols-outlined text-sm">add</span>
                            Tambah
                        </button>
                    )}
                </div>
            </div>
            {expanded && (
                <div className="border-t border-slate-700/30 overflow-x-auto max-h-[500px] overflow-y-auto">
                    {rows.length === 0 && !loading ? (
                        <p className="p-4 text-slate-500 text-xs italic">Tabel kosong atau belum ada data.</p>
                    ) : rows.length > 0 ? (
                        <table className="w-full text-xs min-w-[800px]">
                            <thead className="sticky top-0 z-10">
                                <tr style={{ backgroundColor: `${color}15` }}>
                                    <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">#</th>
                                    <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">Tanggal</th>
                                    <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">Shift</th>
                                    <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">Silo</th>
                                    <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">Perusahaan</th>
                                    <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">Tujuan</th>
                                    <th className="text-right px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">Ritase</th>
                                    <th className="text-left px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">Dibuat</th>
                                    <th className="text-center px-3 py-2 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/30">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/20">
                                {rows.map((row, i) => (
                                    <tr key={String(row.id)} className="hover:bg-surface-highlight/30 transition-colors">
                                        <td className="px-3 py-2 text-slate-600 tabular-nums">{i + 1}</td>
                                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{formatVal(row.date)}</td>
                                        <td className="px-3 py-2 text-slate-300 capitalize">{String(row.shift || '-')}</td>
                                        <td className="px-3 py-2 text-slate-300">{String(row.silo || '-')}</td>
                                        <td className="px-3 py-2 text-slate-300 font-bold uppercase">{String(row.perusahaan || '-').toUpperCase()}</td>
                                        <td className="px-3 py-2 text-slate-300 font-bold uppercase">{String(row.tujuan || '-').toUpperCase()}</td>
                                        <td className="px-3 py-2 text-white font-mono font-semibold text-right tabular-nums">{Number(row.ritase || 0).toLocaleString('id-ID')}</td>
                                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatVal(row.created_at)}</td>
                                        <td className="px-3 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => handleEdit(row)} className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer" title="Edit">
                                                    <span className="material-symbols-outlined text-sm">edit</span>
                                                </button>
                                                <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer" title="Hapus">
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : null}
                </div>
            )}
            {/* Add/Edit Modal */}
            {editRow && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setEditRow(null); setIsAdding(false); }}>
                    <div className="bg-surface-dark border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
                        <h4 className="text-base font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg" style={{ color }}>{isAdding ? 'add_circle' : 'edit'}</span>
                            {isAdding ? 'Tambah Fly Ash Unloading' : 'Edit Fly Ash Unloading'}
                        </h4>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Tanggal</label>
                                    <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                                        className="w-full px-3 py-2 bg-surface-highlight border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                                <div>
                                    <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Shift</label>
                                    <select value={editForm.shift} onChange={e => setEditForm(f => ({ ...f, shift: e.target.value }))}
                                        className="w-full px-3 py-2 bg-surface-highlight border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50">
                                        <option value="pagi">Pagi</option>
                                        <option value="sore">Sore</option>
                                        <option value="malam">Malam</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Silo</label>
                                <select value={editForm.silo} onChange={e => setEditForm(f => ({ ...f, silo: e.target.value }))}
                                    className="w-full px-3 py-2 bg-surface-highlight border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50">
                                    <option value="A">Silo A</option>
                                    <option value="B">Silo B</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Perusahaan</label>
                                <input type="text" value={editForm.perusahaan} onChange={e => setEditForm(f => ({ ...f, perusahaan: e.target.value.toUpperCase() }))}
                                    className="w-full px-3 py-2 bg-surface-highlight border border-slate-700 rounded-lg text-sm text-slate-200 uppercase focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Tujuan</label>
                                <input type="text" value={editForm.tujuan} onChange={e => setEditForm(f => ({ ...f, tujuan: e.target.value.toUpperCase() }))}
                                    className="w-full px-3 py-2 bg-surface-highlight border border-slate-700 rounded-lg text-sm text-slate-200 uppercase focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wider">Ritase</label>
                                <input type="number" value={editForm.ritase} onChange={e => setEditForm(f => ({ ...f, ritase: e.target.value }))}
                                    className="w-full px-3 py-2 bg-surface-highlight border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => { setEditRow(null); setIsAdding(false); }} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer">Batal</button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                                {saving ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ───
export default function HistoryPage() {
    const { operator } = useOperator();
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<string>('shift');

    useEffect(() => {
        if (!operator) router.push('/');
    }, [operator, router]);

    if (!operator) return null;

    const currentSection = SECTIONS.find(s => s.id === activeSection) || SECTIONS[0];

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto space-y-5">
            {/* Header */}
            <header className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-xl">
                        <span className="material-symbols-outlined text-primary text-2xl">history</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-white">History & Data Lengkap</h2>
                        <p className="text-text-secondary text-sm mt-1">Seluruh data operasional dari database, dikelompokkan per konteks</p>
                    </div>
                </div>
                <button onClick={() => router.push('/dashboard')}
                    className="flex items-center gap-2 text-slate-400 hover:text-white hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    Dashboard
                </button>
            </header>

            {/* Section Tabs */}
            <div className="flex flex-wrap gap-2">
                {SECTIONS.map(s => (
                    <button key={s.id} onClick={() => setActiveSection(s.id)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border"
                        style={activeSection === s.id ? {
                            backgroundColor: `${s.color}18`,
                            borderColor: `${s.color}50`,
                            color: s.color,
                            boxShadow: `0 0 12px ${s.color}20`,
                        } : {
                            backgroundColor: 'transparent',
                            borderColor: '#1e293b',
                            color: '#64748b',
                        }}>
                        <span className="material-symbols-outlined text-base">{s.icon}</span>
                        {s.label}
                        <span className="opacity-60">({s.tables.length})</span>
                    </button>
                ))}
            </div>

            {/* Active Section Tables */}
            <div className="bg-surface-dark rounded-xl border border-slate-800 p-5 space-y-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-lg" style={{ color: currentSection.color }}>{currentSection.icon}</span>
                    {currentSection.label}
                    <span className="text-xs text-slate-500 font-normal ml-1">{currentSection.tables.length} tabel</span>
                </h3>
                <div className="space-y-2">
                    {activeSection === 'unloading' ? (
                        <>
                            <SolarUnloadingTable color={currentSection.color} />
                            <AshUnloadingTable color={currentSection.color} />
                        </>
                    ) : (
                        currentSection.tables.map(t => (
                            <DataTable
                                key={t.name}
                                tableName={t.name}
                                label={t.label}
                                joinInfo={t.joinInfo}
                                color={currentSection.color}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
