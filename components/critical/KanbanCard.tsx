'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { MaintenanceWithCritical, PhotoRow } from '@/lib/supabase/types';
import { FOREMAN_OPTIONS } from '@/lib/constants';
import StatusBadge from './StatusBadge';
import ScopeBadge from './ScopeBadge';
import PhotoGallery from './PhotoGallery';

function getForemanLabel(val: string) {
    return FOREMAN_OPTIONS.find(f => f.value === val)?.label ?? val;
}

interface KanbanCardProps {
    item: MaintenanceWithCritical;
    photos?: PhotoRow[];
    overlay?: boolean;
    index?: number;
    isFirst?: boolean;
    isLast?: boolean;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    /** ISO timestamp of when current status was reached (sourced from activity log). */
    statusTimeIso?: string;
    /** Konteks shift yang sedang dilihat — untuk deteksi "dari shift sebelumnya". */
    boardDate?: string;
    boardShift?: 'pagi' | 'sore' | 'malam';
}

function formatStatusTime(iso?: string) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Derive (date, shift) WIB dari ISO timestamp. */
function deriveShiftFromIso(iso: string): { date: string; shift: 'pagi' | 'sore' | 'malam' } {
    const d = new Date(iso);
    // Convert to WIB (+7 offset). Pakai toLocaleString trick ke Asia/Jakarta.
    const wib = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const h = wib.getHours();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmtDate = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    if (h >= 7 && h < 15) return { shift: 'pagi', date: fmtDate(wib) };
    if (h >= 15 && h < 23) return { shift: 'sore', date: fmtDate(wib) };
    if (h < 7) {
        const prev = new Date(wib); prev.setDate(prev.getDate() - 1);
        return { shift: 'malam', date: fmtDate(prev) };
    }
    return { shift: 'malam', date: fmtDate(wib) };
}

function shiftLabel(s: 'pagi' | 'sore' | 'malam') {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function shortDateLabel(date: string) {
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function KanbanCard({ item, photos, overlay = false, index, isFirst, isLast, onMoveUp, onMoveDown, statusTimeIso, boardDate, boardShift }: KanbanCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    // Detect kalau status maintenance "berasal" dari shift sebelumnya (statusTime tidak di shift sekarang)
    const originShift = statusTimeIso ? deriveShiftFromIso(statusTimeIso) : null;
    const isFromPreviousShift = !!(
        originShift && boardDate && boardShift &&
        (originShift.date !== boardDate || originShift.shift !== boardShift)
    );

    const scopeAccent: Record<string, string> = {
        mekanik: 'border-l-blue-500',
        listrik: 'border-l-amber-500',
        instrumen: 'border-l-purple-500',
        sipil: 'border-l-teal-500',
    };



    return (
        <div
            ref={overlay ? undefined : setNodeRef}
            style={overlay ? undefined : style}
            {...(overlay ? {} : attributes)}
            {...(overlay ? {} : listeners)}
            className={`bg-white rounded-lg border border-gray-200 border-l-4 ${scopeAccent[item.scope] ?? 'border-l-gray-300'}
                shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 transition-all duration-150 p-2 cursor-grab active:cursor-grabbing active:scale-[0.97] active:shadow-inner active:translate-y-0
                ${overlay ? 'shadow-2xl rotate-2 scale-[1.03] ring-2 ring-emerald-400/50 opacity-95 z-50' : ''}`}
        >
            {/* Header: Item name + status */}
            <div className="flex items-start justify-between gap-1.5 mb-1">
                <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-black text-black leading-tight truncate">{item.item}</h4>
                    {item.critical_equipment?.deskripsi && (
                        <p className="text-[10px] font-semibold text-rose-600 leading-tight line-clamp-1">
                            {item.critical_equipment.deskripsi}
                        </p>
                    )}
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <StatusBadge status={item.status} light />
                    {statusTimeIso && (
                        <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 whitespace-nowrap" title={`Status ${item.status} sejak ${new Date(statusTimeIso).toLocaleString('id-ID')}`}>
                            {formatStatusTime(statusTimeIso)}
                        </span>
                    )}
                    {isFromPreviousShift && originShift && (
                        <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200 whitespace-nowrap flex items-center gap-0.5"
                            title={`Status ${item.status} pertama kali pada shift ${shiftLabel(originShift.shift)} ${shortDateLabel(originShift.date)}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: 9 }}>history</span>
                            dari {shiftLabel(originShift.shift)} {shortDateLabel(originShift.date)}
                        </span>
                    )}
                </div>
            </div>

            {/* Uraian */}
            <p className="text-[11px] text-gray-800 font-semibold mb-1.5 line-clamp-2 leading-snug">
                {item.uraian}
            </p>

            {/* Badges row */}
            <div className="flex items-center gap-1 flex-wrap mb-1">
                <ScopeBadge scope={item.scope} light className="!text-[9px] !px-1.5 !py-0.5 uppercase font-bold tracking-wider" />
                {item.tipe === 'preventif' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-100 text-cyan-700">Preventif</span>
                )}
                {item.tipe === 'modifikasi' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-100 text-violet-700">Modifikasi</span>
                )}
            </div>

            {/* Footer info */}
            <div className="flex items-center justify-between gap-1 text-[9px] text-gray-700 flex-wrap">
                <span className="font-bold bg-gray-100 px-1.5 py-0.5 rounded">{getForemanLabel(item.foreman)}</span>
                <div className="flex items-center gap-1">
                    {item.notif && (
                        <span className="bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-bold text-indigo-700" title={`Notif: ${item.notif}`}>
                            #{item.notif}
                        </span>
                    )}
                    <span className="font-semibold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">{item.date}</span>
                </div>
            </div>

            {/* Photo thumbnails — compact */}
            {photos && photos.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                    <PhotoGallery photos={photos} compact />
                </div>
            )}
        </div>
    );
}
