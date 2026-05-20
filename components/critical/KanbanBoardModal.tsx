'use client';

import { useMemo, useState } from 'react';
import { SHIFT_OPTIONS, getShiftWindow, detectCurrentShift } from '@/lib/constants';
import type { ActivityActionType, MaintenanceWithCritical, MaintenanceStatus, PhotoRow } from '@/lib/supabase/types';
import KanbanBoard from './KanbanBoard';

export interface BoardActivityLog {
    created_at: string;
    action_type: ActivityActionType;
    actor: string | null;
    metadata: Record<string, unknown> | null;
}

interface KanbanBoardModalProps {
    open: boolean;
    onClose: () => void;
    maintenances: MaintenanceWithCritical[];
    boardDate: string;
    boardShift: 'pagi' | 'sore' | 'malam';
    onChangeBoardDate: (d: string) => void;
    onChangeBoardShift: (s: 'pagi' | 'sore' | 'malam') => void;
    onMoveStatus: (id: string, newStatus: MaintenanceStatus) => Promise<{ error: string | null }>;
    onKonfirmasiShift: (id: string) => Promise<{ error: string | null }>;
    photosByMaintId?: Record<string, PhotoRow[]>;
    statusTimeByMaintId?: Record<string, string>;
    statusActorByMaintId?: Record<string, { ip?: string; ok?: string }>;
    /** All maintenance-related activity logs (critical_activity_logs + work_order_activity_logs).
     *  Used to compute snapshot saat board dikunci. */
    activityLogs?: BoardActivityLog[];
}

export default function KanbanBoardModal({
    open, onClose,
    maintenances,
    boardDate, boardShift, onChangeBoardDate, onChangeBoardShift,
    onMoveStatus, onKonfirmasiShift,
    photosByMaintId, statusTimeByMaintId, statusActorByMaintId,
    activityLogs,
}: KanbanBoardModalProps) {
    // Status change langsung — board sync via updated_at timestamp, no manual assignment.
    // Block kalau shift sudah lewat (laporan shift sudah final).
    const handleMoveStatus = async (id: string, newStatus: MaintenanceStatus) => {
        if (isPastShift) return { error: 'Shift sudah selesai — board dikunci' };
        return await onMoveStatus(id, newStatus);
    };
    const handleKonfirmasi = async (id: string) => {
        if (isPastShift) return { error: 'Shift sudah selesai — board dikunci' };
        return onKonfirmasiShift(id);
    };

    const [search, setSearch] = useState('');

    const shiftWindow = getShiftWindow(boardDate, boardShift);
    // Shift sudah selesai → board read-only + snapshot beku.
    const isPastShift = Date.now() > shiftWindow.end.getTime();
    // Real-time current shift/date — untuk indicator visual ("● Sekarang")
    const nowShift = detectCurrentShift();
    const isViewingTodayDate = boardDate === nowShift.date;
    const isViewingCurrentShift = isViewingTodayDate && boardShift === nowShift.shift;

    // Snapshot beku: kalau shift sudah lewat, tampilkan status & updated_at masing-masing
    // maintenance SEPERTI di akhir shift window — bukan state sekarang. Status change setelah
    // shift berakhir tidak boleh mempengaruhi tampilan locked board.
    const snapshot = useMemo(() => {
        if (!isPastShift) return null;
        const startMs = shiftWindow.start.getTime();
        const endMs = shiftWindow.end.getTime();
        const logs = activityLogs ?? [];

        const byMaint: Record<string, BoardActivityLog[]> = {};
        for (const l of logs) {
            const mid = l.metadata?.maintenance_id as string | undefined;
            if (!mid) continue;
            if (new Date(l.created_at).getTime() > endMs) continue;
            (byMaint[mid] ??= []).push(l);
        }

        const snapMaint: MaintenanceWithCritical[] = [];
        const snapStatusTime: Record<string, string> = {};
        const snapStatusActor: Record<string, { ip?: string; ok?: string }> = {};

        for (const m of maintenances) {
            const ml = (byMaint[m.id] ?? []).slice().sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            if (ml.length === 0) continue; // maintenance belum ada saat shift berakhir → exclude

            let snapStatus: MaintenanceStatus | null = null;
            let snapTime = '';
            const actors: { ip?: string; ok?: string } = {};

            for (const l of ml) {
                if (l.action_type === 'maintenance_added') {
                    snapStatus = 'OPEN';
                    snapTime = l.created_at;
                } else if (l.action_type === 'maintenance_updated') {
                    const ns = l.metadata?.new_status as MaintenanceStatus | undefined;
                    if (ns === 'OPEN' || ns === 'IP' || ns === 'OK') {
                        snapStatus = ns;
                        snapTime = l.created_at;
                        if (ns === 'IP' && l.actor) actors.ip = l.actor;
                        if (ns === 'OK' && l.actor) actors.ok = l.actor;
                    }
                }
            }

            if (!snapStatus) continue;
            // Hanya tampilkan maintenance yang aktivitas terakhirnya terjadi DI DALAM window shift ini.
            // Maintenance lama yang status-nya tidak berubah selama shift = tidak relevan untuk shift itu.
            const snapMs = new Date(snapTime).getTime();
            if (snapMs < startMs || snapMs > endMs) continue;
            snapMaint.push({ ...m, status: snapStatus, updated_at: snapTime });
            snapStatusTime[m.id] = snapTime;
            snapStatusActor[m.id] = actors;
        }

        return { maintenances: snapMaint, statusTime: snapStatusTime, statusActor: snapStatusActor };
    }, [isPastShift, shiftWindow.start, shiftWindow.end, activityLogs, maintenances]);

    if (!open) return null;

    const effectiveMaintenances = snapshot?.maintenances ?? maintenances;
    const effectiveStatusTime = snapshot?.statusTime ?? statusTimeByMaintId;
    const effectiveStatusActor = snapshot?.statusActor ?? statusActorByMaintId;

    const counts = {
        open: effectiveMaintenances.filter(m => m.status === 'OPEN').length,
        ip: effectiveMaintenances.filter(m => m.status === 'IP').length,
        ok: effectiveMaintenances.filter(m => m.status === 'OK').length,
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-gray-900/60 backdrop-blur-sm p-2 md:p-4">
            <div className="bg-white rounded-2xl w-full max-w-[1800px] max-h-[96vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 22 }}>view_kanban</span>
                        <div>
                            <h2 className="text-base font-extrabold text-white tracking-wide leading-tight">Board &amp; Review Pekerjaan Maintenance per Shift</h2>
                            <p className="text-[11px] font-medium text-blue-100 leading-tight">Pantau pekerjaan aktif di shift ini, atau review pekerjaan di shift sebelumnya</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-blue-100 hover:text-white cursor-pointer transition-colors bg-white/10 hover:bg-white/20 p-1 rounded-lg">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>

                {/* Toolbar: date navigator (atas) + shift tabs (bawah) */}
                <div className="flex flex-col items-center gap-2.5 px-6 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        {/* Date navigator — satu pill terpadu */}
                        <div className="flex items-center bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-9">
                            <button
                                onClick={() => {
                                    const [y, m, d] = boardDate.split('-').map(Number);
                                    const prev = new Date(y, m - 1, d - 1);
                                    const pad = (n: number) => String(n).padStart(2, '0');
                                    onChangeBoardDate(`${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`);
                                }}
                                className="px-2 h-full flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-850 cursor-pointer transition-colors border-r border-gray-150"
                                title="Tanggal sebelumnya"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                            </button>
                            <label className="relative flex items-center gap-1.5 px-3 h-full cursor-pointer hover:bg-gray-50/80 transition-colors">
                                <span className="material-symbols-outlined text-blue-500" style={{ fontSize: 15 }}>calendar_today</span>
                                <span className="text-xs font-black text-gray-700">
                                    {(() => {
                                        const [y, m, d] = boardDate.split('-').map(Number);
                                        const dt = new Date(y, m - 1, d);
                                        return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                                    })()}
                                </span>
                                {isViewingTodayDate && (
                                    <span className="flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase tracking-wider border border-emerald-200" title="Tanggal hari ini">
                                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                        Hari ini
                                    </span>
                                )}
                                <input
                                    type="date"
                                    value={boardDate}
                                    onChange={e => onChangeBoardDate(e.target.value)}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    title="Pilih tanggal"
                                />
                            </label>
                            <button
                                onClick={() => {
                                    const [y, m, d] = boardDate.split('-').map(Number);
                                    const next = new Date(y, m - 1, d + 1);
                                    const pad = (n: number) => String(n).padStart(2, '0');
                                    onChangeBoardDate(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`);
                                }}
                                className="px-2 h-full flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-850 cursor-pointer transition-colors border-l border-gray-150"
                                title="Tanggal berikutnya"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                            </button>
                        </div>

                        {/* Hari Ini — hanya tampil kalau user TIDAK sedang lihat tanggal hari ini */}
                        {!isViewingTodayDate && (() => {
                            const now = new Date();
                            const pad = (n: number) => String(n).padStart(2, '0');
                            const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                            return (
                                <button
                                    onClick={() => onChangeBoardDate(todayStr)}
                                    className="px-2.5 h-9 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 cursor-pointer text-xs font-bold transition-all shadow-sm"
                                    title="Lompat ke hari ini"
                                >
                                    Hari Ini
                                </button>
                            );
                        })()}
                    </div>

                    {/* Shift tabs — baris bawah. Shift yang sedang berlangsung (real-time) dapat penanda hijau pulse. */}
                    <div className="flex bg-gray-100 rounded-xl p-1 gap-1 border border-gray-200 shadow-inner h-9 items-center">
                        {SHIFT_OPTIONS.map(s => {
                            const isCurrentRealShift = isViewingTodayDate && s.value === nowShift.shift;
                            const active = boardShift === s.value;
                            const shiftIcons: Record<string, string> = { pagi: 'light_mode', sore: 'wb_twilight', malam: 'dark_mode' };
                            const shiftColors: Record<string, string> = { pagi: 'text-amber-500', sore: 'text-orange-500', malam: 'text-indigo-500' };

                            return (
                                <button
                                    key={s.value}
                                    onClick={() => onChangeBoardShift(s.value)}
                                    className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap h-full ${
                                        active
                                            ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50'
                                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
                                    }`}
                                    title={isCurrentRealShift ? 'Shift yang sedang berlangsung' : undefined}
                                >
                                    <span className={`material-symbols-outlined ${shiftColors[s.value]}`} style={{ fontSize: 13 }}>
                                        {shiftIcons[s.value]}
                                    </span>
                                    {s.value.charAt(0).toUpperCase() + s.value.slice(1)}
                                    {isCurrentRealShift && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50 ml-0.5" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Banner readonly kalau shift sudah lewat */}
                {isPastShift && (
                    <div className="flex items-center justify-center gap-2 px-6 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-bold">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span>
                        Shift sudah selesai — board dikunci. Laporan shift sudah final dengan isi yang sama.
                    </div>
                )}

                {/* Board */}
                <div className="flex-1 overflow-auto p-4 light-scrollbar">
                    <KanbanBoard
                        maintenances={effectiveMaintenances}
                        shiftWindow={shiftWindow}
                        // Saat user search OPEN, jangan hide future-dated OPEN — user explicitly mencari
                        boardDate={search.trim() ? undefined : boardDate}
                        boardShift={boardShift}
                        openSearch={search}
                        onOpenSearchChange={setSearch}
                        onMoveStatus={handleMoveStatus}
                        onKonfirmasiShift={handleKonfirmasi}
                        photosByMaintId={photosByMaintId}
                        statusTimeByMaintId={effectiveStatusTime}
                        statusActorByMaintId={effectiveStatusActor}
                        readOnly={isPastShift}
                    />
                </div>

                {/* Summary footer */}
                <div className="flex items-center justify-center gap-6 px-6 py-3 text-xs text-gray-500 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
                    <span className="flex items-center gap-2 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/30" />
                        Open: {counts.open}
                    </span>
                    <span className="flex items-center gap-2 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/30" />
                        In Progress: {counts.ip}
                    </span>
                    <span className="flex items-center gap-2 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30" />
                        Selesai: {counts.ok}
                    </span>
                </div>
            </div>
        </div>
    );
}
