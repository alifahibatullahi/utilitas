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
    const { operator, loading: operatorLoading } = useOperator();
    const router = useRouter();

    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter per kolom (Array of parameter IDs)
    const [columns, setColumns] = useState<string[]>(['', '']);

    useEffect(() => {
        if (!operatorLoading && !operator) router.push('/');
    }, [operator, operatorLoading, router]);

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

            {/* TABLE CONTAINER - Full Width to Bottom */}
            <div className="w-full px-6 mt-6 pb-6">
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
                        <div className="overflow-x-auto h-[80vh] custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead className="bg-[#f8f9fa] sticky top-0 z-20 shadow-sm border-b-4 border-slate-400">
                                    <tr>
                                        {/* Tanggal & Jam (Sticky Left) - diperkecil */}
                                        <th className="px-3 py-3 font-black text-black text-sm uppercase tracking-wider sticky left-0 bg-[#f8f9fa] border-r-2 border-slate-300 z-30 shadow-[2px_0_0_#cbd5e1] min-w-[100px] text-center" rowSpan={2}>Tanggal</th>
                                        <th className="px-2 py-3 font-black text-black text-sm uppercase tracking-wider sticky left-[100px] bg-[#f8f9fa] border-r-2 border-slate-300 z-30 shadow-[2px_0_0_#cbd5e1] w-16 text-center" rowSpan={2}>Jam</th>

                                        {/* Parameter Header - baris 1: Label judul */}
                                        {columns.map((colId, index) => {
                                            const paramDef = colId ? PARAMETERS.find(p => p.id === colId) : null;
                                            return (
                                                <th key={`label-${index}`} className="px-3 pt-2 pb-0 bg-[#f8f9fa] text-center min-w-[180px]">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className="font-black text-black text-sm leading-tight text-center">
                                                            {paramDef ? paramDef.label : 'Pilih . . .'}
                                                        </span>
                                                        {paramDef?.unit && (
                                                            <span className="text-[11px] font-bold text-slate-500">({paramDef.unit})</span>
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
                                        {/* Parameter Header - baris 2: Dropdown select */}
                                        {columns.map((colId, index) => (
                                            <th key={`sel-${index}`} className="px-3 pt-1 pb-2 bg-[#f8f9fa] border-b border-slate-300 text-center">
                                                <div className="flex items-center gap-1">
                                                    <div className="relative w-full">
                                                        <select
                                                            value={colId}
                                                            onChange={(e) => changeColumn(index, e.target.value)}
                                                            className={`w-full p-1.5 pr-7 bg-white border-2 border-slate-400 font-bold text-xs rounded cursor-pointer hover:border-black appearance-none truncate outline-none shadow-sm ${colId ? 'text-black' : 'text-slate-400'}`}
                                                        >
                                                            <option value="" className="text-slate-400">Pilih . . .</option>
                                                            {Object.entries(groupedParameters).map(([groupName, params]) => (
                                                                <optgroup key={groupName} label={groupName} className="font-black bg-slate-100 text-xs">
                                                                    {params.map(p => (
                                                                        <option key={p.id} value={p.id} className="font-bold text-black bg-white text-sm">
                                                                            {p.label}
                                                                        </option>
                                                                    ))}
                                                                </optgroup>
                                                            ))}
                                                        </select>
                                                        <span className="material-symbols-outlined text-lg font-bold text-black absolute top-1/2 -translate-y-1/2 right-0.5 pointer-events-none">
                                                            expand_more
                                                        </span>
                                                    </div>

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
                                                {SHIFT_TIME_MAP[row.shift ?? ''] || row.shift}
                                            </td>
                                            
                                            {/* Dynamic Data Cells */}
                                            {columns.map((colId, index) => {
                                                const paramDef = PARAMETERS.find(p => p.id === colId);
                                                const val = paramDef ? paramDef.extract(row) : null;
                                                // Alternate column background slightly
                                                const CellBg = index % 2 === 0 ? 'bg-transparent' : 'bg-slate-100/50';

                                                return (
                                                    <td key={`data-${row.id}-${index}`} className={`px-6 py-4 text-center font-black text-black text-2xl border-x border-slate-200 ${CellBg} group-hover:bg-[#dbeafe] transition-colors`}>
                                                        {val !== null && val !== undefined ? (
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

            {/* Custom scrollbar with arrows */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 20px;
                    height: 20px;
                    background-color: #ffffff; /* White background as requested */
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background-color: #ffffff; /* Ensure track is pure white */
                    border-radius: 0;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #94a3b8; /* Gray thumb */
                    border: 4px solid #ffffff; /* White border to match track */
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
                    background-color: #ffffff;
                    border: 2px solid white;
                }
                .custom-scrollbar::-webkit-scrollbar-button:hover {
                    background-color: #f1f5f9;
                }

                /* Up Arrow */
                .custom-scrollbar::-webkit-scrollbar-button:vertical:start:decrement {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="%2364748b" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }
                
                /* Down Arrow */
                .custom-scrollbar::-webkit-scrollbar-button:vertical:end:increment {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="%2364748b" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }

                /* Left Arrow */
                .custom-scrollbar::-webkit-scrollbar-button:horizontal:start:decrement {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="%2364748b" viewBox="0 0 24 24"><path d="M14 7l-5 5 5 5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }

                /* Right Arrow */
                .custom-scrollbar::-webkit-scrollbar-button:horizontal:end:increment {
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="%2364748b" viewBox="0 0 24 24"><path d="M10 7l5 5-5 5z"/></svg>');
                    background-repeat: no-repeat;
                    background-position: center;
                }
            `}</style>
        </div>
    );
}
