'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';

const DUMMY_REPORTS = [
    { id: 1, shift: 'A', date: '2026-02-25', operator: 'Budi Santoso', status: 'pending' as const, steamA: 45.2, steamB: 42.8, loadMW: 12.5 },
    { id: 2, shift: 'C', date: '2026-02-25', operator: 'Eko Prasetyo', status: 'approved' as const, steamA: 43.5, steamB: 42.0, loadMW: 12.3 },
    { id: 3, shift: 'B', date: '2026-02-24', operator: 'Rizky Pratama', status: 'approved' as const, steamA: 44.0, steamB: 41.5, loadMW: 12.0 },
    { id: 4, shift: 'A', date: '2026-02-24', operator: 'Budi Santoso', status: 'rejected' as const, steamA: 44.5, steamB: 43.0, loadMW: 12.2 },
    { id: 5, shift: 'C', date: '2026-02-24', operator: 'Dimas Aditya', status: 'approved' as const, steamA: 43.0, steamB: 41.8, loadMW: 11.9 },
];

type ReportStatus = 'pending' | 'approved' | 'rejected';

const STATUS_CONFIG: Record<ReportStatus, { label: string; icon: string; className: string }> = {
    pending: { label: 'Menunggu', icon: 'schedule', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    approved: { label: 'Approved', icon: 'check_circle', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    rejected: { label: 'Rejected', icon: 'cancel', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

export default function LaporanShiftPage() {
    const { operator, canApprove } = useOperator();
    const router = useRouter();
    const [filterStatus, setFilterStatus] = useState<ReportStatus | 'all'>('all');
    const [selectedReport, setSelectedReport] = useState<typeof DUMMY_REPORTS[0] | null>(null);
    const [approvalNote, setApprovalNote] = useState('');

    useEffect(() => {
        if (!operator) router.push('/');
    }, [operator, router]);

    if (!operator) return null;

    const filtered = filterStatus === 'all' ? DUMMY_REPORTS : DUMMY_REPORTS.filter(r => r.status === filterStatus);

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-6">
            {/* Header */}
            <header className="flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-xl">
                    <span className="material-symbols-outlined text-primary text-2xl">description</span>
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-white">Laporan Shift</h2>
                    <p className="text-text-secondary text-sm mt-1">Daftar laporan shift dan proses approval</p>
                </div>
            </header>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border
                            ${filterStatus === s
                                ? 'bg-primary/20 text-primary border-primary/30'
                                : 'bg-surface-dark text-text-secondary border-slate-800 hover:bg-surface-highlight'
                            }`}
                    >
                        {s === 'all' ? 'Semua' : (
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">{STATUS_CONFIG[s].icon}</span>
                                {STATUS_CONFIG[s].label}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Report list */}
                <div className="lg:col-span-2 space-y-2">
                    {filtered.map(report => (
                        <button
                            key={report.id}
                            onClick={() => setSelectedReport(report)}
                            className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer
                                ${selectedReport?.id === report.id
                                    ? 'bg-primary/10 border-primary/30'
                                    : 'bg-surface-dark border-slate-800 hover:bg-surface-highlight hover:border-slate-700'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-white">Shift {report.shift}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${STATUS_CONFIG[report.status].className}`}>
                                    <span className="material-symbols-outlined text-xs">{STATUS_CONFIG[report.status].icon}</span>
                                    {STATUS_CONFIG[report.status].label}
                                </span>
                            </div>
                            <p className="text-xs text-text-secondary">{new Date(report.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            <p className="text-xs text-text-secondary/60 mt-0.5">{report.operator}</p>
                        </button>
                    ))}
                </div>

                {/* Detail panel */}
                <div className="lg:col-span-3">
                    {selectedReport ? (
                        <div className="bg-surface-dark rounded-xl border border-slate-800 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white">Shift {selectedReport.shift} — {new Date(selectedReport.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</h3>
                                    <p className="text-sm text-text-secondary">Operator: {selectedReport.operator}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${STATUS_CONFIG[selectedReport.status].className}`}>
                                    <span className="material-symbols-outlined text-sm">{STATUS_CONFIG[selectedReport.status].icon}</span>
                                    {STATUS_CONFIG[selectedReport.status].label}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3 mb-5">
                                <div className="bg-surface-highlight/30 rounded-xl p-3 border border-slate-700/30">
                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider">Steam A</p>
                                    <p className="text-xl font-bold text-white tabular-nums">{selectedReport.steamA} <span className="text-xs text-slate-400 font-normal">t/h</span></p>
                                </div>
                                <div className="bg-surface-highlight/30 rounded-xl p-3 border border-slate-700/30">
                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider">Steam B</p>
                                    <p className="text-xl font-bold text-white tabular-nums">{selectedReport.steamB} <span className="text-xs text-slate-400 font-normal">t/h</span></p>
                                </div>
                                <div className="bg-surface-highlight/30 rounded-xl p-3 border border-slate-700/30">
                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider">Load MW</p>
                                    <p className="text-xl font-bold text-primary tabular-nums">{selectedReport.loadMW} <span className="text-xs text-primary/60 font-normal">MW</span></p>
                                </div>
                            </div>

                            {canApprove && selectedReport.status === 'pending' && (
                                <div className="border-t border-slate-700/40 pt-4">
                                    <p className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-3 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">approval</span>
                                        Approval
                                    </p>
                                    <textarea
                                        value={approvalNote}
                                        onChange={e => setApprovalNote(e.target.value)}
                                        placeholder="Catatan approval (opsional)..."
                                        rows={2}
                                        className="w-full px-4 py-3 bg-surface-highlight border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-slate-600 resize-none mb-3"
                                    />
                                    <div className="flex gap-3">
                                        <button className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-1">
                                            <span className="material-symbols-outlined text-base">check_circle</span>
                                            Approve
                                        </button>
                                        <button className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all cursor-pointer flex items-center justify-center gap-1">
                                            <span className="material-symbols-outlined text-base">cancel</span>
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-surface-dark rounded-xl border border-slate-800 h-64 flex items-center justify-center">
                            <p className="text-sm text-text-secondary/40">Pilih laporan untuk melihat detail</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
