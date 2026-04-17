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
            {/* TOP HEADER - Full Width Without Navigation button */}
            <div className="w-full bg-slate-50 border-b-2 border-slate-300 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 relative">
                {/* Logos - Top Left */}
                <div className="flex gap-4 items-center">
                    <Image src="/logo/Danantara_Indonesia_(no_SW).png" alt="Danantara" width={140} height={40} className="object-contain" />
                    <Image src="/logo/Logo_Pupuk_Indonesia__Persero_-removebg-preview.png" alt="Pupuk Indonesia" width={120} height={40} className="object-contain" />
                    <Image src="/logo/logo-PG-agro-trans-small-removebg-preview.png" alt="Petrokimia Gresik" width={120} height={40} className="object-contain" />
                </div>
                
                {/* Clean Beautiful Title Centered */}
                <div className="flex-1 flex justify-center w-full">
                    <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 drop-shadow-sm pb-1">
                        Pusat Data UBB
                    </h1>
                </div>

                <div className="w-[300px] hidden md:block"></div> {/* Spacer for centering */}
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
                        <div className="overflow-x-auto max-h-[75vh] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead className="bg-[#f8f9fa] sticky top-0 z-20 shadow-sm">
                                    <tr>
                                        {/* Tanggal & Jam (Sticky Left) */}
                                        <th className="px-6 py-4 font-black text-black text-xl uppercase tracking-wider sticky left-0 bg-[#f8f9fa] border-r-2 border-b-2 border-slate-300 z-30 shadow-[2px_0_0_#cbd5e1] min-w-[150px] text-center">Tanggal</th>
                                        <th className="px-6 py-4 font-black text-black text-xl uppercase tracking-wider sticky left-[150px] bg-[#f8f9fa] border-r-2 border-b-2 border-slate-300 z-30 shadow-[2px_0_0_#cbd5e1] w-32 text-center">Jam</th>
                                        
                                        {/* Parameter Header (Selector row) */}
                                        {columns.map((colId, index) => (
                                            <th key={`sel-${index}`} className="px-4 py-3 bg-[#f8f9fa] border-b-2 border-slate-400 text-center relative group min-w-[320px]">
                                                <div className="flex items-center justify-between gap-3 relative">
                                                    <div className="relative w-full">
                                                        <select 
                                                            value={colId} 
                                                            onChange={(e) => changeColumn(index, e.target.value)}
                                                            className="w-full p-2.5 pr-10 bg-white border-2 border-slate-400 text-black font-black text-lg rounded cursor-pointer hover:border-black appearance-none truncate outline-none shadow-sm"
                                                        >
                                                            {Object.entries(groupedParameters).map(([groupName, params]) => (
                                                                <optgroup key={groupName} label={groupName} className="font-black bg-slate-100 text-sm">
                                                                    {params.map(p => (
                                                                        <option key={p.id} value={p.id} className="font-bold text-black bg-white text-base">
                                                                            {p.label}
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                            ))}
                                                        </select>
                                                        {/* Arrow icon fixed on the right of the select */}
                                                        <span className="material-symbols-outlined text-3xl font-bold text-black absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none">
                                                            expand_more
                                                        </span>
                                                    </div>
                                                    
                                                    {columns.length > 1 && (
                                                        <button onClick={() => removeColumn(index)} className="p-2 text-red-600 border-2 border-transparent hover:border-red-600 bg-red-50 hover:bg-red-100 rounded transition-all cursor-pointer flex-shrink-0" title="Hapus Kolom">
                                                            <span className="material-symbols-outlined text-2xl font-black">close</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((row, rowIdx) => (
                                        <tr key={row.id} className="hover:bg-[#dbeafe] transition-colors border-b border-slate-300">
                                            {/* Date */}
                                            <td className="px-6 py-4 font-black text-black text-xl sticky left-0 bg-white border-r-2 border-slate-300 shadow-[2px_0_0_#cbd5e1] text-center whitespace-nowrap z-10 group-hover:bg-[#dbeafe]">
                                                {new Date(row.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            {/* Time */}
                                            <td className="px-6 py-4 font-black text-black text-xl sticky left-[150px] bg-slate-50 border-r-2 border-slate-300 shadow-[2px_0_0_#cbd5e1] text-center z-10 group-hover:bg-[#dbeafe]">
                                                {SHIFT_TIME_MAP[row.shift ?? ''] || row.shift}
                                            </td>
                                            
                                            {/* Dynamic Data Cells */}
                                            {columns.map((colId, index) => {
                                                const paramDef = PARAMETERS.find(p => p.id === colId);
                                                const val = paramDef ? paramDef.extract(row) : null;
                                                // Alternate column background slightly
                                                const CellBg = index % 2 === 0 ? 'bg-transparent' : 'bg-slate-50';

                                                return (
                                                    <td key={`data-${row.id}-${index}`} className={`px-6 py-4 text-center font-black text-black text-2xl border-x border-slate-200 ${CellBg} group-hover:bg-transparent`}>
                                                        {val !== null && val !== undefined ? (
                                                            <div className="flex items-baseline justify-center gap-1.5">
                                                                <span>{typeof val === 'number' && val % 1 !== 0 ? val.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : val.toLocaleString('id-ID')}</span>
                                                                <span className="text-[13px] font-bold text-slate-600 uppercase tracking-widest">{paramDef?.unit || ''}</span>
                                                            </div>
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
                                            <td colSpan={columns.length + 2} className="px-6 py-12 text-center text-black font-black text-2xl">
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
                <div className="mt-4 flex justify-between items-center bg-white p-5 border border-slate-300 rounded shadow-sm">
                   <p className="text-black font-extrabold text-lg uppercase tracking-wider">Log Sheet Operasional UBB</p>
                   <button onClick={addColumn} className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-black text-xl rounded shadow-md hover:bg-blue-800 transition-colors cursor-pointer border-2 border-blue-900 border-b-4 active:border-b-2 active:translate-y-[2px]">
                        <span className="material-symbols-outlined text-3xl font-black">add_circle</span>
                        Tambah Kolom Parameter
                    </button>
                </div>
            </div>

            {/* Custom scrollbar with arrows */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 20px;
                    height: 20px;
                    background-color: #f1f5f9;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #94a3b8;
                    border: 4px solid #f1f5f9;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #64748b;
                }
                
                /* Scrollbar buttons (arrows) */
                .custom-scrollbar::-webkit-scrollbar-button {
                    display: block;
                    width: 20px;
                    height: 20px;
                    background-color: #cbd5e1;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-button:hover {
                    background-color: #94a3b8;
                }

                /* Up Arrow */
                .custom-scrollbar::-webkit-scrollbar-button:vertical:start:decrement {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="%23475569" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }
                
                /* Down Arrow */
                .custom-scrollbar::-webkit-scrollbar-button:vertical:end:increment {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="%23475569" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }

                /* Left Arrow */
                .custom-scrollbar::-webkit-scrollbar-button:horizontal:start:decrement {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="%23475569" viewBox="0 0 24 24"><path d="M14 7l-5 5 5 5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }

                /* Right Arrow */
                .custom-scrollbar::-webkit-scrollbar-button:horizontal:end:increment {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="%23475569" viewBox="0 0 24 24"><path d="M10 7l5 5-5 5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }
            `}</style>
        </div>
    );
}
