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
            {/* Header: Item name + critical deskripsi + status */}
            <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0 flex-1 mt-0.5">
                    <h4 className="text-base font-black text-black leading-tight mb-1">Item: {item.item}</h4>
                    {item.critical_equipment?.deskripsi && (
                        <p className="text-xs font-bold text-rose-600 leading-tight line-clamp-2">
                            Critical: {item.critical_equipment.deskripsi}
                        </p>
                    )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <StatusBadge status={item.status} light />
                </div>
            </div>

            {/* Uraian */}
            <p className="text-sm text-black font-medium mb-3 mt-2 line-clamp-3">
                <span className="font-bold text-black">Maintenance : </span>{item.uraian}
            </p>

            {/* Badges row */}
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <ScopeBadge scope={item.scope} light />
                {item.tipe === 'preventif' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700">
                        Preventif
                    </span>
                ) : null}
            </div>

            {/* Footer info */}
            <div className="flex items-center justify-between text-xs text-black">
                <span className="font-bold bg-gray-100 px-2 py-1 rounded">{getForemanLabel(item.foreman)}</span>
                <div className="flex items-center gap-2">
                    {item.notif && (
                        <span className="bg-indigo-100 border border-indigo-200 px-2 py-1 rounded font-bold text-indigo-900">
                            Notif: {item.notif}
                        </span>
                    )}
                    <span className="font-bold bg-slate-100 border border-slate-200 px-2 py-1 rounded text-slate-700">{item.date}</span>
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
