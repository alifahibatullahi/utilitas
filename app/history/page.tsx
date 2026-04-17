'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function HistoryPage() {
    const { operator } = useOperator();
    const router = useRouter();

    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter per kolom (Array of parameter IDs)
    const [columns, setColumns] = useState<string[]>(['boiler_a_flow_steam', 'turbin_steam_inlet']);

    useEffect(() => {
        if (!operator) router.push('/');
    }, [operator, router]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = createClient();
            const { data, error: err } = await supabase
                .from('shift_reports')
                .select(`
                    id, date, shift, created_at,
                    shift_boiler (*),
                    shift_turbin (*),
                    shift_steam_dist (*),
                    shift_generator_gi (*),
                    shift_water_quality (*),
                    shift_tankyard (*)
                `)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(100);

            if (err) throw err;
            setReports(data || []);
        } catch (e: any) {
            setError(e.message || String(e));
        } finally {
            setLoading(false);
        }
    }, []);

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
        setColumns([...columns, PARAMETERS[0].id]);
    };

    const removeColumn = (index: number) => {
        const newCols = [...columns];
        newCols.splice(index, 1);
        setColumns(newCols);
    };

    if (!operator) return null;

    return (
        <div className="min-h-screen bg-slate-50 w-full font-sans pb-10">
            {/* TOP HEADER - Full Width */}
            <div className="w-full bg-white border-b-2 border-slate-300 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                    <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-black font-extrabold text-lg rounded hover:bg-slate-300 transition-colors cursor-pointer border border-slate-400">
                        <span className="material-symbols-outlined text-black font-bold">arrow_back</span>
                        Kembali ke Dashboard
                    </button>
                    <div className="flex gap-4 items-center">
                        <Image src="/logo/Danantara_Indonesia_(no_SW).png" alt="Danantara" width={140} height={40} className="object-contain" />
                        <Image src="/logo/Logo_Pupuk_Indonesia__Persero_-removebg-preview.png" alt="Pupuk Indonesia" width={120} height={40} className="object-contain" />
                        <Image src="/logo/logo-PG-agro-trans-small-removebg-preview.png" alt="Petrokimia Gresik" width={120} height={40} className="object-contain" />
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="text-3xl font-black text-black tracking-tight uppercase">Pusat Data UBB</h1>
                </div>
            </div>

            {/* TABLE CONTAINER - Full Width */}
            <div className="w-full px-6 mt-6">
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
                        <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead className="bg-[#f8f9fa] sticky top-0 z-20 border-b-2 border-slate-400 shadow-sm">
                                    <tr>
                                        {/* Tanggal & Jam (Sticky Left) */}
                                        <th className="px-6 py-4 font-black text-black text-lg uppercase tracking-wider sticky left-0 bg-[#f8f9fa] border-r-2 border-b-2 border-slate-300 z-30 shadow-[2px_0_0_#cbd5e1] min-w-[150px] text-center" rowSpan={2}>Tanggal</th>
                                        <th className="px-6 py-4 font-black text-black text-lg uppercase tracking-wider sticky left-[150px] bg-[#f8f9fa] border-r-2 border-b-2 border-slate-300 z-30 shadow-[2px_0_0_#cbd5e1] w-28 text-center" rowSpan={2}>Jam</th>
                                        
                                        {/* Parameter Header Row 1 (Selector) */}
                                        {columns.map((colId, index) => (
                                            <th key={`sel-${index}`} className="px-4 py-2 bg-[#f8f9fa] border-b-2 border-slate-400 text-center font-bold relative group">
                                                <div className="flex items-center justify-between gap-2">
                                                    <select 
                                                        value={colId} 
                                                        onChange={(e) => changeColumn(index, e.target.value)}
                                                        className="w-full p-2 bg-white border-2 border-slate-400 text-black font-bold text-base rounded cursor-pointer hover:border-black appearance-none truncate outline-none"
                                                    >
                                                        {Object.entries(groupedParameters).map(([groupName, params]) => (
                                                            <optgroup key={groupName} label={groupName} className="font-black bg-slate-100">
                                                                {params.map(p => (
                                                                    <option key={p.id} value={p.id} className="font-bold text-black bg-white">
                                                                        {p.label}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                    {columns.length > 1 && (
                                                        <button onClick={() => removeColumn(index)} className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors cursor-pointer" title="Hapus Kolom">
                                                            <span className="material-symbols-outlined text-2xl font-bold">close</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                        
                                    </tr>
                                    <tr>
                                        {/* Parameter Header Row 2 (Unit & Add Button Location) */}
                                        {columns.map((colId, index) => {
                                            const paramDef = PARAMETERS.find(p => p.id === colId);
                                            return (
                                                <th key={`unit-${index}`} className={`px-4 py-3 bg-[#eef2f6] border-b-2 border-slate-400 text-center uppercase ${index % 2 === 0 ? 'bg-[#e2e8f0]' : 'bg-[#f1f5f9]'}`}>
                                                    <span className="text-black font-black text-lg tracking-widest">{paramDef?.unit || '-'}</span>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((row, rowIdx) => (
                                        <tr key={row.id} className="hover:bg-[#dbeafe] transition-colors border-b border-slate-300">
                                            {/* Date */}
                                            <td className="px-6 py-4 font-black text-black text-lg sticky left-0 bg-white border-r-2 border-slate-300 shadow-[2px_0_0_#cbd5e1] text-center whitespace-nowrap z-10 group-hover:bg-[#dbeafe]">
                                                {new Date(row.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            {/* Time */}
                                            <td className="px-6 py-4 font-black text-black text-lg sticky left-[150px] bg-slate-50 border-r-2 border-slate-300 shadow-[2px_0_0_#cbd5e1] text-center z-10 group-hover:bg-[#dbeafe]">
                                                {SHIFT_TIME_MAP[row.shift ?? ''] || row.shift}
                                            </td>
                                            
                                            {/* Dynamic Data */}
                                            {columns.map((colId, index) => {
                                                const paramDef = PARAMETERS.find(p => p.id === colId);
                                                const val = paramDef ? paramDef.extract(row) : null;
                                                // Alternate column background slightly
                                                const CellBg = index % 2 === 0 ? 'bg-transparent' : 'bg-slate-50';

                                                return (
                                                    <td key={`data-${row.id}-${index}`} className={`px-6 py-4 text-center font-bold text-black text-xl border-x border-slate-200 ${CellBg} group-hover:bg-transparent`}>
                                                        {val !== null && val !== undefined ? (
                                                            typeof val === 'number' && val % 1 !== 0 ? val.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : val.toLocaleString('id-ID')
                                                        ) : (
                                                            <span className="text-slate-400">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    {reports.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={columns.length + 2} className="px-6 py-12 text-center text-black font-black text-xl">
                                                Tidak ada data ditemukan di database.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                
                {/* TOMBOL TAMBAH KOLOM */}
                <div className="mt-4 flex justify-between items-center bg-white p-4 items-center border border-slate-300 rounded shadow-sm">
                   <p className="text-black font-bold text-base uppercase">Data Pusat Log Sheet Operasional UBB</p>
                   <button onClick={addColumn} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-black text-lg rounded hover:bg-blue-800 transition-colors cursor-pointer border-2 border-blue-900 shadow-md">
                        <span className="material-symbols-outlined text-2xl font-bold">add</span>
                        Tambah Kolom Parameter
                    </button>
                </div>

            </div>
        </div>
    );
}
