'use client';

import { useMemo, useState } from 'react';
import { SHIFT_OPTIONS, getShiftWindow } from '@/lib/constants';
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

    // Snapshot beku: kalau shift sudah lewat, tampilkan status & updated_at masing-masing
    // maintenance SEPERTI di akhir shift window — bukan state sekarang. Status change setelah
    // shift berakhir tidak boleh mempengaruhi tampilan locked board.
    const snapshot = useMemo(() => {
        if (!isPastShift) return null;
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
            snapMaint.push({ ...m, status: snapStatus, updated_at: snapTime });
            snapStatusTime[m.id] = snapTime;
            snapStatusActor[m.id] = actors;
        }

        return { maintenances: snapMaint, statusTime: snapStatusTime, statusActor: snapStatusActor };
    }, [isPastShift, shiftWindow.end, activityLogs, maintenances]);

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

                {/* Toolbar: date navigator + shift tabs */}
                <div className="flex flex-col items-center gap-2 px-6 py-3 border-b border-gray-100 bg-gray-50">
                    {/* Date navigator: prev | picker + display | next | hari ini */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const [y, m, d] = boardDate.split('-').map(Number);
                                const prev = new Date(y, m - 1, d - 1);
                                const pad = (n: number) => String(n).padStart(2, '0');
                                onChangeBoardDate(`${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 cursor-pointer transition-colors shadow-sm"
                            title="Tanggal sebelumnya"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                        </button>
                        <div className="flex flex-col items-center min-w-[200px]">
                            <input
                                type="date"
                                value={boardDate}
                                onChange={e => onChangeBoardDate(e.target.value)}
                                className="px-3 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-bold outline-none cursor-pointer shadow-sm text-center"
                            />
                            <span className="text-[11px] font-bold text-blue-700 mt-0.5">
                                {(() => {
                                    const [y, m, d] = boardDate.split('-').map(Number);
                                    const dt = new Date(y, m - 1, d);
                                    return dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                                })()}
                            </span>
                        </div>
                        <button
                            onClick={() => {
                                const [y, m, d] = boardDate.split('-').map(Number);
                                const next = new Date(y, m - 1, d + 1);
                                const pad = (n: number) => String(n).padStart(2, '0');
                                onChangeBoardDate(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 cursor-pointer transition-colors shadow-sm"
                            title="Tanggal berikutnya"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                        </button>
                        {(() => {
                            const now = new Date();
                            const pad = (n: number) => String(n).padStart(2, '0');
                            const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                            const isToday = boardDate === todayStr;
                            return (
                                <button
                                    onClick={() => onChangeBoardDate(todayStr)}
                                    disabled={isToday}
                                    className={`px-3 h-8 rounded-lg border text-xs font-bold transition-colors shadow-sm ${
                                        isToday
                                            ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-default'
                                            : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer'
                                    }`}
                                    title="Lompat ke hari ini"
                                >
                                    Hari Ini
                                </button>
                            );
                        })()}
                    </div>

                    {/* Shift tabs */}
                    <div className="flex bg-gray-100 rounded-xl p-1 gap-1 border border-gray-200 shadow-inner">
                        {SHIFT_OPTIONS.map(s => (
                            <button
                                key={s.value}
                                onClick={() => onChangeBoardShift(s.value)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${boardShift === s.value ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {s.value.charAt(0).toUpperCase() + s.value.slice(1)}
                            </button>
                        ))}
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
