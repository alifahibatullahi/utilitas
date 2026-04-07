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
}

export default function KanbanCard({ item, photos, overlay = false, index, isFirst, isLast, onMoveUp, onMoveDown }: KanbanCardProps) {
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

    const scopeAccent: Record<string, string> = {
        mekanik: 'border-l-blue-500',
        listrik: 'border-l-amber-500',
        instrumen: 'border-l-purple-500',
        sipil: 'border-l-teal-500',
    };

    const showControls = index !== undefined && (onMoveUp || onMoveDown);

    return (
        <div
            ref={overlay ? undefined : setNodeRef}
            style={overlay ? undefined : style}
            {...(overlay ? {} : attributes)}
            {...(overlay ? {} : listeners)}
            className={`bg-white rounded-xl border border-gray-200 border-l-4 ${scopeAccent[item.scope] ?? 'border-l-gray-300'}
                shadow-sm hover:shadow-md transition-shadow p-3 cursor-grab active:cursor-grabbing
                ${overlay ? 'shadow-xl rotate-2 scale-105' : ''}`}
        >
            {/* Nomor urut + up/down controls */}
            {showControls && (
                <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-extrabold border border-gray-200">
                        {index}
                    </span>
                    <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                        <button
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); onMoveUp?.(); }}
                            disabled={isFirst}
                            className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Pindah ke atas"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_upward</span>
                        </button>
                        <button
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); onMoveDown?.(); }}
                            disabled={isLast}
                            className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Pindah ke bawah"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_downward</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Item name + critical deskripsi + status */}
            <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-gray-800 leading-tight">{item.item}</h4>
                    {item.critical_equipment?.deskripsi && (
                        <p className="text-[10px] font-semibold text-rose-600 leading-tight mt-0.5 line-clamp-1">
                            Critical : {item.critical_equipment.deskripsi}
                        </p>
                    )}
                </div>
                <StatusBadge status={item.status} light />
            </div>

            {/* Uraian */}
            <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                <span className="font-bold text-gray-500">Maintenance : </span>{item.uraian}
            </p>

            {/* Badges row */}
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <ScopeBadge scope={item.scope} light />
                {item.tipe === 'preventif' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-700">
                        Preventif
                    </span>
                ) : item.critical_equipment ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                        CR: {item.critical_equipment.item}
                    </span>
                ) : null}
            </div>

            {/* Footer info */}
            <div className="flex items-center justify-between text-[10px] text-gray-500">
                <span className="font-medium">{getForemanLabel(item.foreman)}</span>
                <div className="flex items-center gap-2">
                    {item.notif && (
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                            {item.notif}
                        </span>
                    )}
                    <span>{item.date}</span>
                </div>
            </div>

            {/* Photo thumbnails */}
            {photos && photos.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                    <PhotoGallery photos={photos} compact />
                </div>
            )}
        </div>
    );
}
