'use client';

import { useState } from 'react';
import { SHIFT_OPTIONS, getShiftWindow } from '@/lib/constants';
import type { MaintenanceWithCritical, MaintenanceStatus, PhotoRow } from '@/lib/supabase/types';
import KanbanBoard from './KanbanBoard';

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
}

export default function KanbanBoardModal({
    open, onClose,
    maintenances,
    boardDate, boardShift, onChangeBoardDate, onChangeBoardShift,
    onMoveStatus, onKonfirmasiShift,
    photosByMaintId, statusTimeByMaintId, statusActorByMaintId,
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

    if (!open) return null;

    const shiftWindow = getShiftWindow(boardDate, boardShift);
    // Shift sudah selesai → board read-only (laporan shift sudah final, isi locked)
    const isPastShift = Date.now() > shiftWindow.end.getTime();
    const counts = {
        open: maintenances.filter(m => m.status === 'OPEN').length,
        ip: maintenances.filter(m => m.status === 'IP').length,
        ok: maintenances.filter(m => m.status === 'OK').length,
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-gray-900/60 backdrop-blur-sm p-2 md:p-4">
            <div className="bg-white rounded-2xl w-full max-w-[1800px] max-h-[96vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 22 }}>view_kanban</span>
                        <h2 className="text-base font-extrabold text-white tracking-wide">Board Pekerjaan Maintenance</h2>
                    </div>
                    <button onClick={onClose} className="text-blue-100 hover:text-white cursor-pointer transition-colors bg-white/10 hover:bg-white/20 p-1 rounded-lg">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>

                {/* Toolbar: date + shift centered */}
                <div className="flex items-center justify-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
                    <input
                        type="date"
                        value={boardDate}
                        onChange={e => onChangeBoardDate(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-medium outline-none cursor-pointer shadow-sm"
                    />
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
                        maintenances={maintenances}
                        shiftWindow={shiftWindow}
                        // Saat user search OPEN, jangan hide future-dated OPEN — user explicitly mencari
                        boardDate={search.trim() ? undefined : boardDate}
                        boardShift={boardShift}
                        openSearch={search}
                        onOpenSearchChange={setSearch}
                        onMoveStatus={handleMoveStatus}
                        onKonfirmasiShift={handleKonfirmasi}
                        photosByMaintId={photosByMaintId}
                        statusTimeByMaintId={statusTimeByMaintId}
                        statusActorByMaintId={statusActorByMaintId}
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
