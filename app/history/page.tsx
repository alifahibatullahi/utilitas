'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { createClient } from '@/lib/supabase/client';
import { PARAMETERS, groupedParameters, ParameterDef } from '@/lib/history-parameters';

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

    // Initial selected parameters
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set([
        'boiler_a_flow_steam', 'boiler_b_flow_steam', 'turbin_steam_inlet', 'gen_load'
    ]));

    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [tempSelectedIds, setTempSelectedIds] = useState<Set<string>>(new Set(selectedIds));

    useEffect(() => {
        if (!operator) router.push('/');
    }, [operator, router]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = createClient();
            // Fetch last 100 shift reports including their relations
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
                // Sort descending to get latest first, but since shift is string, we'll sort in JS or use created_at
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

    // Handle Filter Modal
    const openFilter = () => {
        setTempSelectedIds(new Set(selectedIds));
        setIsFilterModalOpen(true);
    };

    const toggleParam = (id: string) => {
        setTempSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const applyFilter = () => {
        setSelectedIds(tempSelectedIds);
        setIsFilterModalOpen(false);
    };

    const activeParameters = useMemo(() => {
        return PARAMETERS.filter(p => selectedIds.has(p.id));
    }, [selectedIds]);

    if (!operator) return null;

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-[1600px] mx-auto space-y-6">
                
                {/* HEADER */}
                <header className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <span className="material-symbols-outlined text-3xl">query_stats</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Compare Data Parameter</h1>
                            <p className="text-sm text-slate-500 font-medium">Tabulasi ringkas parameter operasional historis dari Log Sheet Shift</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={fetchData} className="flex items-center justify-center p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors shadow-sm cursor-pointer" title="Refresh Data">
                            <span className="material-symbols-outlined text-xl">refresh</span>
                        </button>
                        <button onClick={openFilter} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20 cursor-pointer">
                            <span className="material-symbols-outlined text-xl">filter_list</span>
                            Pilih Parameter ({selectedIds.size})
                        </button>
                        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm cursor-pointer">
                            <span className="material-symbols-outlined text-xl">arrow_back</span>
                            Dashboard
                        </button>
                    </div>
                </header>

                {/* TABLE CONTAINER */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                            <span className="material-symbols-outlined animate-spin text-4xl mb-3 text-blue-500">progress_activity</span>
                            <p className="font-medium">Memuat data parameter historis...</p>
                        </div>
                    ) : error ? (
                        <div className="p-6 text-center text-red-500 font-medium bg-red-50 border-b border-red-100">
                            Terjadi kesalahan: {error}
                        </div>
                    ) : activeParameters.length === 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
                            <span className="material-symbols-outlined text-5xl mb-3 opacity-20">table_chart</span>
                            <p className="font-medium text-slate-500">Belum ada parameter yang dipilih.</p>
                            <button onClick={openFilter} className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition cursor-pointer">
                                Pilih Parameter Sekarang
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm text-left border-collapse min-w-max">
                                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                                    <tr>
                                        {/* Frozen Left Columns */}
                                        <th className="px-4 py-3 font-bold text-slate-700 uppercase tracking-wider sticky left-0 bg-slate-50 border-r border-b border-slate-200 shadow-[1px_0_0_#e2e8f0] min-w-[120px] text-center">Tanggal</th>
                                        <th className="px-4 py-3 font-bold text-slate-700 uppercase tracking-wider sticky left-[120px] bg-slate-50 border-r border-b border-slate-200 shadow-[1px_0_0_#e2e8f0] text-center w-24">Jam</th>
                                        
                                        {/* Dynamic Parameter Columns */}
                                        {activeParameters.map(param => (
                                            <th key={param.id} className="px-4 py-3 font-semibold text-slate-600 border-b border-slate-200 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{param.group}</span>
                                                    <span>{param.label}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reports.map((row) => (
                                        <tr key={row.id} className="hover:bg-blue-50/50 transition-colors group">
                                            {/* Date Column */}
                                            <td className="px-4 py-2.5 font-semibold text-slate-700 sticky left-0 bg-white group-hover:bg-blue-50/50 border-r border-slate-100 shadow-[1px_0_0_#f1f5f9] text-center tabular-nums whitespace-nowrap">
                                                {new Date(row.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            {/* Time Column */}
                                            <td className="px-4 py-2.5 font-bold text-slate-800 sticky left-[120px] bg-slate-50/50 group-hover:bg-blue-50/50 border-r border-slate-100 shadow-[1px_0_0_#f1f5f9] text-center tabular-nums">
                                                {SHIFT_TIME_MAP[row.shift ?? ''] || row.shift}
                                            </td>
                                            
                                            {/* Parameter Columns */}
                                            {activeParameters.map(param => {
                                                const val = param.extract(row);
                                                return (
                                                    <td key={param.id} className="px-4 py-2.5 text-right font-mono text-slate-600 whitespace-nowrap">
                                                        {val !== null && val !== undefined ? (
                                                            typeof val === 'number' && val % 1 !== 0 ? val.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : val.toLocaleString('id-ID')
                                                        ) : (
                                                            <span className="text-slate-300">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    {reports.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={activeParameters.length + 2} className="px-6 py-12 text-center text-slate-500 font-medium">
                                                Tidak ada data ditemukan di database.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Helper text */}
                <p className="text-xs text-slate-400 text-center font-medium mt-4">
                    Data diambil dari laporan log sheet. Baris merepresentasikan rekaman input pada jam operasional tertentu (Shift 1 = 06:00, Shift 2 = 14:00, Shift 3 = 22:00).
                </p>

            </div>

            {/* FILTER MODAL */}
            {isFilterModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-600">checklist</span>
                                Pilih Parameter Tersedia
                            </h3>
                            <button onClick={() => setIsFilterModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>
                        
                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {Object.entries(groupedParameters).map(([groupName, params]) => (
                                    <div key={groupName} className="space-y-3">
                                        <h4 className="font-bold text-sm text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">{groupName}</h4>
                                        <div className="space-y-2">
                                            {params.map(p => {
                                                const isChecked = tempSelectedIds.has(p.id);
                                                return (
                                                    <label key={p.id} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors border ${isChecked ? 'bg-blue-50/80 border-blue-200' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                                        <div className="relative flex items-start pt-0.5">
                                                            <input 
                                                                type="checkbox" 
                                                                className="peer sr-only" 
                                                                checked={isChecked}
                                                                onChange={() => toggleParam(p.id)}
                                                            />
                                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isChecked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white peer-hover:border-blue-400'}`}>
                                                                {isChecked && <span className="material-symbols-outlined text-white text-[14px] font-bold">check</span>}
                                                            </div>
                                                        </div>
                                                        <span className={`text-sm font-semibold select-none ${isChecked ? 'text-blue-900' : 'text-slate-600'}`}>
                                                            {p.label}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-500">{tempSelectedIds.size} parameter dipilih</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setTempSelectedIds(new Set())} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer">
                                    Reset
                                </button>
                                <button onClick={applyFilter} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm cursor-pointer transition-colors">
                                    Terapkan Filter
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom scrollbar for table container */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>
        </div>
    );
}
