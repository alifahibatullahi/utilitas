'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useOperator } from '@/hooks/useOperator';
import { createClient } from '@/lib/supabase/client';
import { PARAMETERS, groupedParameters } from '@/lib/history-parameters';

const SHIFT_TIME_MAP: Record<string, string> = {
    'malam': '06:00',
    'pagi': '14:00',
    'sore': '22:00'
};

// ─── Custom Dropdown Component ──────────────────────────────────────────────

interface CustomDropdownProps {
    value: string;
    onChange: (val: string) => void;
}

function CustomDropdown({ value, onChange }: CustomDropdownProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (open) setTimeout(() => searchRef.current?.focus(), 50);
        else setSearch('');
    }, [open]);

    const selectedParam = value ? PARAMETERS.find(p => p.id === value) : null;
    const searchLower = search.toLowerCase();

    // Filter parameters by search query
    const filteredGroups = Object.entries(groupedParameters).reduce((acc, [groupName, params]) => {
        const filtered = search
            ? params.filter(p => p.label.toLowerCase().includes(searchLower) || groupName.toLowerCase().includes(searchLower))
            : params;
        if (filtered.length > 0) acc[groupName] = filtered;
        return acc;
    }, {} as Record<string, typeof PARAMETERS>);

    return (
        <div ref={ref} className="relative w-full">
            {/* Trigger button */}
            <button
                onClick={() => setOpen(!open)}
                className={`w-full p-2 pr-8 bg-white border-2 border-slate-400 font-bold text-sm rounded cursor-pointer hover:border-black text-left truncate outline-none shadow-sm transition-colors ${value ? 'text-black' : 'text-slate-400'}`}
            >
                {selectedParam ? selectedParam.label : 'Pilih . . .'}
            </button>
            <span className="material-symbols-outlined text-lg font-bold text-black absolute top-1/2 -translate-y-1/2 right-1 pointer-events-none">
                {open ? 'expand_less' : 'expand_more'}
            </span>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute top-full left-0 mt-1 w-[900px] bg-white border-2 border-slate-400 rounded-lg shadow-xl z-50 overflow-hidden">
                    {/* Search box */}
                    <div className="p-2 border-b-2 border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-2 bg-white border-2 border-slate-300 rounded px-2 focus-within:border-blue-500 transition-colors">
                            <span className="material-symbols-outlined text-slate-400 text-base">search</span>
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Cari parameter..."
                                className="flex-1 py-1.5 text-sm font-bold text-black outline-none bg-transparent placeholder:text-slate-400"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="max-h-[480px] overflow-y-auto custom-dropdown-scroll">
                        {/* Pilih placeholder — only show when not searching */}
                        {!search && (
                            <button
                                onClick={() => { onChange(''); setOpen(false); }}
                                className="w-full text-left px-4 py-2.5 text-base font-bold text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Pilih . . .
                            </button>
                        )}
                        {Object.entries(filteredGroups).map(([groupName, params]) => (
                            <div key={groupName}>
                                {/* Group header */}
                                <div className="px-4 py-2 bg-slate-100 border-y border-slate-200">
                                    <span className="font-black text-slate-700 text-sm uppercase tracking-wider">{groupName}</span>
                                </div>
                                {/* Grid 2 kolom */}
                                <div className="grid grid-cols-4">
                                {params.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => { onChange(p.id); setOpen(false); }}
                                        className={`text-left px-4 py-2 text-sm font-bold transition-colors cursor-pointer flex items-center justify-between gap-1 border-b border-slate-100 ${
                                            value === p.id
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'text-black hover:bg-slate-50'
                                        }`}
                                    >
                                        <span className="truncate">{p.label}</span>
                                        {p.unit && <span className="text-[10px] font-bold text-slate-400 shrink-0">{p.unit}</span>}
                                    </button>
                                ))}
                                </div>
                            </div>
                        ))}
                        {Object.keys(filteredGroups).length === 0 && (
                            <div className="px-4 py-6 text-center text-slate-400 font-bold text-sm italic">
                                Tidak ada parameter ditemukan
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function HistoryPage() {
    const { operator, loading: operatorLoading } = useOperator();
    const router = useRouter();

    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter per kolom (Array of parameter IDs)
    const [columns, setColumns] = useState<string[]>(['', '']);

    // Date filter
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        if (!operatorLoading && !operator) router.push('/');
    }, [operator, operatorLoading, router]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = createClient();

            // Fetch shift reports
            let shiftQuery = supabase
                .from('shift_reports')
                .select(`
                    id, date, shift, created_at,
                    shift_boiler (*),
                    shift_turbin (*),
                    shift_steam_dist (*),
                    shift_generator_gi (*),
                    shift_power_dist (*),
                    shift_esp_handling (*),
                    shift_coal_bunker (*),
                    shift_water_quality (*),
                    shift_tankyard (*)
                `)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(500);

            if (dateFrom) shiftQuery = shiftQuery.gte('date', dateFrom);
            if (dateTo) shiftQuery = shiftQuery.lte('date', dateTo);

            // Fetch daily reports
            let dailyQuery = supabase
                .from('daily_reports')
                .select(`
                    id, date, created_at,
                    daily_report_steam (*),
                    daily_report_power (*),
                    daily_report_coal (*),
                    daily_report_turbine_misc (*),
                    daily_report_stock_tank (*),
                    daily_report_coal_transfer (*),
                    daily_report_totalizer (*)
                `)
                .order('date', { ascending: false })
                .limit(500);

            if (dateFrom) dailyQuery = dailyQuery.gte('date', dateFrom);
            if (dateTo) dailyQuery = dailyQuery.lte('date', dateTo);

            const [shiftRes, dailyRes] = await Promise.all([shiftQuery, dailyQuery]);

            if (shiftRes.error) throw shiftRes.error;
            if (dailyRes.error) throw dailyRes.error;

            // Tag rows with _source for rendering
            const shiftRows = (shiftRes.data || []).map((r: any) => ({ ...r, _source: 'shift' as const }));

            const dailyRows = (dailyRes.data || []).map((r: any) => ({ ...r, _source: 'daily' as const, shift: null }));

            // Merge and sort: by date desc, then within date: 24 → 22 → 14 → 06
            const SHIFT_ORDER: Record<string, number> = { sore: 2, pagi: 3, malam: 4 };
            const merged = [...shiftRows, ...dailyRows].sort((a, b) => {
                const dateCmp = b.date.localeCompare(a.date);
                if (dateCmp !== 0) return dateCmp;
                const orderA = a._source === 'daily' ? 1 : (SHIFT_ORDER[a.shift] || 5);
                const orderB = b._source === 'daily' ? 1 : (SHIFT_ORDER[b.shift] || 5);
                return orderA - orderB;
            });

            setReports(merged);
        } catch (e: any) {
            setError(e.message || String(e));
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo]);

    useEffect(() => {
        if (operator) fetchData();
    }, [operator, fetchData]);

    // Handle column changes
    const changeColumn = (index: number, newParamId: string) => {
        const newCols = [...columns];
        newCols[index] = newParamId;
        setColumns(newCols);
    };

    const addColumn = () => {
        setColumns([...columns, '']);
    };

    const removeColumn = (index: number) => {
        const newCols = [...columns];
        newCols.splice(index, 1);
        setColumns(newCols);
    };

    if (operatorLoading) return null;
    if (!operator) return null;

    return (
        <div className="min-h-screen bg-slate-50 w-full font-sans pb-10">
            {/* TOP HEADER - Full Width */}
            <div className="w-full bg-slate-50 border-b-2 border-slate-300 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 relative">
                {/* Back Button & Logos - Top Left */}
                <div className="flex gap-4 items-center z-10 relative">
                    <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 px-3 py-1.5 bg-white text-black font-extrabold text-sm rounded shadow hover:bg-slate-100 transition-colors cursor-pointer border-b-2 border-slate-300">
                        <span className="material-symbols-outlined text-black font-bold">arrow_back</span>
                        Kembali
                    </button>
                    <Image src="/logo/Danantara_Indonesia_(no_SW).png" alt="Danantara" width={140} height={40} className="object-contain" />
                    <Image src="/logo/Logo_Pupuk_Indonesia__Persero_-removebg-preview.png" alt="Pupuk Indonesia" width={120} height={40} className="object-contain" />
                    <Image src="/logo/logo-PG-agro-trans-small-removebg-preview.png" alt="Petrokimia Gresik" width={120} height={40} className="object-contain" />
                </div>

                {/* Clean Beautiful Title Centered Absolutely */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 drop-shadow-sm pb-1 pointer-events-auto">
                        Pusat Data UBB
                    </h1>
                </div>
            </div>

            {/* DATE FILTER BAR */}
            <div className="w-full flex items-center justify-center gap-4 px-6 py-3 bg-white border-b-2 border-slate-300">
                <span className="material-symbols-outlined text-slate-500 text-xl">filter_alt</span>
                <label className="font-bold text-sm text-black">Dari</label>
                <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="px-3 py-1.5 border-2 border-slate-300 rounded font-bold text-sm text-black bg-white cursor-pointer outline-none hover:border-slate-400 shadow-sm"
                />
                <label className="font-bold text-sm text-black">Sampai</label>
                <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="px-3 py-1.5 border-2 border-slate-300 rounded font-bold text-sm text-black bg-white cursor-pointer outline-none hover:border-slate-400 shadow-sm"
                />
                {(dateFrom || dateTo) && (
                    <button
                        onClick={() => { setDateFrom(''); setDateTo(''); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 font-bold text-sm rounded border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">close</span>
                        Reset
                    </button>
                )}
            </div>

            {/* TABLE CONTAINER - Full Width to Bottom */}
            <div className="w-full px-6 mt-4 pb-6">
                <div className="bg-white border-2 border-slate-300 shadow-sm overflow-hidden rounded">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center min-h-[400px] text-black">
                            <span className="material-symbols-outlined animate-spin text-5xl mb-3 text-black font-bold">progress_activity</span>
                            <p className="font-extrabold text-xl">Memuat data...</p>
                        </div>
                    ) : error ? (
                        <div className="p-6 text-center text-red-700 font-extrabold bg-red-100 text-xl border-b border-red-300">
                            Terjadi kesalahan: {error}
                        </div>
                    ) : (
                        <div className="overflow-x-auto h-[75vh] custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead className="bg-[#f8f9fa] sticky top-0 z-20 shadow-sm border-b-4 border-slate-400">
                                    <tr>
                                        {/* Tanggal & Jam (Sticky Left) - diperkecil */}
                                        <th className="px-3 py-3 font-black text-black text-sm uppercase tracking-wider sticky left-0 bg-[#f8f9fa] border-r-2 border-slate-300 z-30 shadow-[2px_0_0_#cbd5e1] min-w-[100px] text-center" rowSpan={2}>
                                            <div className="flex items-center justify-center gap-1">
                                                Tanggal
                                                <span className="material-symbols-outlined text-base font-black text-slate-500">arrow_downward</span>
                                            </div>
                                        </th>
                                        <th className="px-2 py-3 font-black text-black text-sm uppercase tracking-wider sticky left-[100px] bg-[#f8f9fa] border-r-2 border-slate-300 z-30 shadow-[2px_0_0_#cbd5e1] w-16 text-center" rowSpan={2}>Jam</th>

                                        {/* Parameter Header - baris 1: Label judul */}
                                        {columns.map((colId, index) => {
                                            const paramDef = colId ? PARAMETERS.find(p => p.id === colId) : null;
                                            return (
                                                <th key={`label-${index}`} className="px-3 pt-2 pb-0 bg-[#f8f9fa] text-center min-w-[200px]">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {paramDef ? (
                                                            <>
                                                                <span className="font-black text-black text-sm leading-tight text-center">
                                                                    {paramDef.label}
                                                                </span>
                                                                {paramDef.unit && (
                                                                    <span className="text-[11px] font-bold text-slate-500">({paramDef.unit})</span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="font-bold text-slate-400 text-xs leading-tight text-center italic">
                                                                Belum ada parameter yang dipilih
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                            );
                                        })}

                                        {/* Tambah Kolom Button */}
                                        <th rowSpan={2} className="px-4 py-3 bg-[#f8f9fa] align-middle text-center border-l-2 border-slate-300 min-w-[120px]">
                                            <button onClick={addColumn} className="flex flex-col items-center justify-center w-full gap-1.5 p-3 bg-white text-blue-600 font-black text-sm border-2 border-dashed border-blue-400 hover:border-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer group">
                                                <span className="material-symbols-outlined text-3xl font-black group-hover:scale-110 transition-transform">add_circle</span>
                                                <span className="leading-tight text-center">Tambah Kolom</span>
                                            </button>
                                        </th>
                                    </tr>
                                    <tr>
                                        {/* Parameter Header - baris 2: Custom Dropdown */}
                                        {columns.map((colId, index) => (
                                            <th key={`sel-${index}`} className="px-3 pt-1 pb-2 bg-[#f8f9fa] border-b border-slate-300 text-center">
                                                <div className="flex items-center gap-1">
                                                    <CustomDropdown
                                                        value={colId}
                                                        onChange={(val) => changeColumn(index, val)}
                                                    />

                                                    {columns.length > 1 && (
                                                        <button onClick={() => removeColumn(index)} className="p-1 text-red-600 border border-transparent hover:border-red-600 bg-red-50 hover:bg-red-100 rounded transition-all cursor-pointer flex-shrink-0" title="Hapus Kolom">
                                                            <span className="material-symbols-outlined text-lg font-black">close</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((row, rowIdx) => (
                                        <tr key={row.id} className="hover:bg-[#dbeafe] transition-colors border-b border-slate-300 group">
                                            {/* Date */}
                                            <td className="px-3 py-3 font-black text-black text-sm sticky left-0 bg-white border-r-2 border-slate-300 shadow-[2px_0_0_#cbd5e1] text-center whitespace-nowrap z-10 group-hover:bg-[#dbeafe]">
                                                {new Date(row.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            {/* Time */}
                                            <td className="px-2 py-3 font-black text-black text-sm sticky left-[100px] bg-slate-50 border-r-2 border-slate-300 shadow-[2px_0_0_#cbd5e1] text-center z-10 group-hover:bg-[#dbeafe]">
                                                {row._source === 'daily' ? '24:00' : (SHIFT_TIME_MAP[row.shift ?? ''] || row.shift)}
                                            </td>

                                            {/* Dynamic Data Cells */}
                                            {columns.map((colId, index) => {
                                                const paramDef = colId ? PARAMETERS.find(p => p.id === colId) : null;
                                                const val = paramDef ? paramDef.extract(row) : null;
                                                const CellBg = index % 2 === 0 ? 'bg-transparent' : 'bg-slate-100/50';

                                                return (
                                                    <td key={`data-${row.id}-${index}`} className={`px-6 py-4 text-center font-black text-black text-2xl border-x border-slate-200 ${CellBg} group-hover:bg-[#dbeafe] transition-colors`}>
                                                        {colId && val !== null && val !== undefined ? (
                                                            <div className="flex items-baseline justify-center gap-1.5">
                                                                <span>{typeof val === 'number' && val % 1 !== 0 ? val.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : val.toLocaleString('id-ID')}</span>
                                                                <span className="text-[14px] font-bold text-slate-600 uppercase tracking-widest">{paramDef?.unit || ''}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            {/* Empty cell under Add Button */}
                                            <td className="border-l-2 border-slate-300 bg-slate-50/30 group-hover:bg-[#dbeafe]"></td>
                                        </tr>
                                    ))}
                                    {reports.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={columns.length + 3} className="px-6 py-12 text-center text-black font-black text-2xl">
                                                Tidak ada data ditemukan di database.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Custom scrollbar styles — table + dropdown */}
            <style jsx global>{`
                /* ── Table scrollbar ── */
                .custom-scrollbar::-webkit-scrollbar {
                    width: 20px;
                    height: 20px;
                    background-color: #ffffff;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background-color: #ffffff;
                    border-radius: 0;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #94a3b8;
                    border: 4px solid #ffffff;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #64748b;
                }
                .custom-scrollbar::-webkit-scrollbar-button {
                    display: block;
                    width: 20px;
                    height: 20px;
                    background-color: #ffffff;
                    border: 2px solid white;
                }
                .custom-scrollbar::-webkit-scrollbar-button:hover {
                    background-color: #f1f5f9;
                }
                .custom-scrollbar::-webkit-scrollbar-button:vertical:start:decrement {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="%2364748b" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }
                .custom-scrollbar::-webkit-scrollbar-button:vertical:end:increment {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="%2364748b" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }
                .custom-scrollbar::-webkit-scrollbar-button:horizontal:start:decrement {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="%2364748b" viewBox="0 0 24 24"><path d="M14 7l-5 5 5 5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }
                .custom-scrollbar::-webkit-scrollbar-button:horizontal:end:increment {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="%2364748b" viewBox="0 0 24 24"><path d="M10 7l5 5-5 5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }

                /* ── Dropdown scrollbar (sama dengan tabel) ── */
                .custom-dropdown-scroll::-webkit-scrollbar {
                    width: 16px;
                    background-color: #ffffff;
                }
                .custom-dropdown-scroll::-webkit-scrollbar-track {
                    background-color: #ffffff;
                }
                .custom-dropdown-scroll::-webkit-scrollbar-thumb {
                    background-color: #94a3b8;
                    border: 3px solid #ffffff;
                    border-radius: 10px;
                }
                .custom-dropdown-scroll::-webkit-scrollbar-thumb:hover {
                    background-color: #64748b;
                }
                .custom-dropdown-scroll::-webkit-scrollbar-button {
                    display: block;
                    width: 16px;
                    height: 16px;
                    background-color: #ffffff;
                    border: 1px solid white;
                }
                .custom-dropdown-scroll::-webkit-scrollbar-button:hover {
                    background-color: #f1f5f9;
                }
                .custom-dropdown-scroll::-webkit-scrollbar-button:vertical:start:decrement {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%2364748b" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }
                .custom-dropdown-scroll::-webkit-scrollbar-button:vertical:end:increment {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%2364748b" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }
            `}</style>
        </div>
    );
}
