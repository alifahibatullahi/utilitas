'use client';

import { useMemo, useState } from 'react';
import { SHIFT_OPTIONS, getShiftWindow, detectCurrentShift } from '@/lib/constants';
import type { ActivityActionType, MaintenanceWithCritical, MaintenanceStatus, PhotoRow, WorkOrderWithPekerjaan } from '@/lib/supabase/types';
import KanbanBoard from './KanbanBoard';
import CustomCalendarPopover from './CustomCalendarPopover';

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
    workOrders?: WorkOrderWithPekerjaan[];
    onOpenDetail?: (id: string, type: 'critical' | 'preventif' | 'modifikasi') => void;
}

export default function KanbanBoardModal({
    open, onClose,
    maintenances,
    boardDate, boardShift, onChangeBoardDate, onChangeBoardShift,
    onMoveStatus, onKonfirmasiShift,
    photosByMaintId, statusTimeByMaintId, statusActorByMaintId,
    activityLogs,
    workOrders,
    onOpenDetail,
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
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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

                {/* Unified Toolbar */}
                <div className="flex justify-center px-6 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center p-1.5 bg-slate-100/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-sm">
                        {/* Date Navigator */}
                        <div className="flex items-center h-9 bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
                            <button
                                onClick={() => {
                                    const [y, m, d] = boardDate.split('-').map(Number);
                                    const prev = new Date(y, m - 1, d - 1);
                                    const pad = (n: number) => String(n).padStart(2, '0');
                                    onChangeBoardDate(`${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`);
                                }}
                                className="px-2.5 h-full flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-800 cursor-pointer transition-colors border-r border-slate-100"
                                title="Tanggal sebelumnya"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                            </button>
                            <button
                                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                className="flex items-center gap-2 px-3 h-full cursor-pointer hover:bg-slate-50/80 transition-colors text-left"
                                title="Pilih tanggal"
                            >
                                <span className="material-symbols-outlined text-blue-500" style={{ fontSize: 16 }}>calendar_month</span>
                                <span className="text-sm font-black text-slate-700 tracking-tight">
                                    {(() => {
                                        const [y, m, d] = boardDate.split('-').map(Number);
                                        const dt = new Date(y, m - 1, d);
                                        return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                                    })()}
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    const [y, m, d] = boardDate.split('-').map(Number);
                                    const next = new Date(y, m - 1, d + 1);
                                    const pad = (n: number) => String(n).padStart(2, '0');
                                    onChangeBoardDate(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`);
                                }}
                                className="px-2.5 h-full flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-800 cursor-pointer transition-colors border-l border-slate-100"
                                title="Tanggal berikutnya"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                            </button>
                            <CustomCalendarPopover
                                value={boardDate}
                                onChange={onChangeBoardDate}
                                isOpen={isCalendarOpen}
                                onClose={() => setIsCalendarOpen(false)}
                            />
                        </div>

                        {/* Hari Ini Indicator / Shortcut */}
                        {(() => {
                            if (!isViewingTodayDate) {
                                return null;
                            } else {
                                return (
                                    <div className="ml-2.5 mr-1 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-100/50 text-emerald-700 text-[10px] font-black uppercase tracking-wider border border-emerald-200/50" title="Tanggal hari ini">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
                                        HARI INI
                                    </div>
                                );
                            }
                        })()}

                        {/* Vertical Divider */}
                        <div className="w-px h-6 bg-slate-300/60 mx-2.5" />

                        {/* Shift Tabs */}
                        <div className="flex items-center gap-1 h-9">
                            {SHIFT_OPTIONS.map(s => {
                                const isCurrentRealShift = isViewingTodayDate && s.value === nowShift.shift;
                                const active = boardShift === s.value;
                                const shiftIcons: Record<string, string> = { pagi: 'light_mode', sore: 'wb_twilight', malam: 'dark_mode' };
                                const shiftColors: Record<string, string> = { pagi: 'text-amber-500', sore: 'text-orange-500', malam: 'text-indigo-500' };

                                return (
                                    <button
                                        key={s.value}
                                        onClick={() => onChangeBoardShift(s.value)}
                                        className={`relative flex items-center gap-1.5 px-3.5 h-full rounded-xl text-[13px] font-black transition-all cursor-pointer whitespace-nowrap overflow-hidden ${
                                            active
                                                ? 'bg-white text-slate-800 shadow-sm border border-slate-200/80'
                                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 border border-transparent'
                                        }`}
                                        title={isCurrentRealShift ? 'Shift saat ini (berlangsung)' : undefined}
                                    >
                                        {active && (
                                            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500" />
                                        )}
                                        <span className={`material-symbols-outlined ${shiftColors[s.value]}`} style={{ fontSize: 16 }}>
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
                        workOrders={workOrders}
                        onOpenDetail={onOpenDetail}
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
