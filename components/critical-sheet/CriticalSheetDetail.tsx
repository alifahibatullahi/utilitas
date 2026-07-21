'use client';

import { useEffect, useState } from 'react';
import type { SheetCritical, SheetMaintenance } from './types';
import { fetchSheetData } from './types';
import { SheetStatusBadge, SheetScopeBadge } from './SheetBadges';
import SheetPhotoSection from './SheetPhotoSection';

interface CriticalSheetDetailProps {
    critical: SheetCritical;
    onClose: () => void;
}

function Field({ label, value }: { label: string; value: string }) {
    if (!value) return null;
    return (
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="text-sm font-medium text-slate-700">{value}</p>
        </div>
    );
}

/** Modal detail satu critical: field lengkap, foto, dan maintenance yang ter-link
 *  (via kolom Ref Critical di sheet — hanya data baru yang punya relasi). */
export default function CriticalSheetDetail({ critical, onClose }: CriticalSheetDetailProps) {
    const [linked, setLinked] = useState<SheetMaintenance[] | null>(null);
    const [linkedErr, setLinkedErr] = useState<string | null>(null);

    useEffect(() => {
        if (critical.no === null) { setLinked([]); return; }
        let cancelled = false;
        fetchSheetData<SheetMaintenance>({
            view: 'maintenance', refNo: critical.no, status: 'semua', page: 1, pageSize: 50,
        })
            .then(res => { if (!cancelled) setLinked(res.items); })
            .catch(err => { if (!cancelled) setLinkedErr(err instanceof Error ? err.message : 'Gagal memuat'); });
        return () => { cancelled = true; };
    }, [critical.no]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto light-scrollbar"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3 rounded-t-2xl">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            {critical.no !== null && (
                                <span className="text-[11px] font-bold text-slate-400">#{critical.no}</span>
                            )}
                            <SheetStatusBadge status={critical.status} />
                            <SheetScopeBadge scope={critical.scope} />
                        </div>
                        <h2 className="text-base font-bold text-slate-800 mt-1 leading-snug">{critical.item}{critical.varian ? ` — ${critical.varian}` : ''}</h2>
                        <p className="text-sm text-slate-600 mt-0.5">{critical.uraian}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                        aria-label="Tutup"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                    </button>
                </div>

                <div className="px-5 py-4 space-y-5">
                    {/* Fields */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Field label="Tanggal Dilaporkan" value={critical.tanggalRaw} />
                        <Field label="Yang Melaporkan" value={critical.pelapor} />
                        <Field label="Notif" value={critical.notif} />
                        <Field label="Tanggal di OK" value={critical.tanggalOkRaw} />
                        <Field label={'Yang Meng"OK"'} value={critical.pengOk} />
                        <Field label="Gabungan" value={critical.gabungan} />
                    </div>

                    {/* Foto critical */}
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Foto Kondisi</h3>
                        <SheetPhotoSection parentKind="critical" rowUid={critical.uid} />
                    </div>

                    {/* Maintenance ter-link */}
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                            Riwayat Pekerjaan Maintenance
                            {linked && linked.length > 0 && <span className="ml-1.5 text-slate-400 normal-case">({linked.length})</span>}
                        </h3>
                        {linkedErr && <p className="text-xs text-rose-600">{linkedErr}</p>}
                        {!linkedErr && linked === null && <p className="text-xs text-slate-400 italic">Memuat…</p>}
                        {linked !== null && linked.length === 0 && (
                            <p className="text-xs text-slate-400 italic">
                                Belum ada maintenance yang ter-link. Isi kolom &quot;Ref Critical&quot; di sheet MAINTENANCE
                                dengan nomor critical ini ({critical.no !== null ? `mis. "${critical.no} - ${critical.uraian.slice(0, 30)}…"` : 'baris ini belum bernomor'}).
                            </p>
                        )}
                        <div className="space-y-2">
                            {(linked ?? []).map(m => (
                                <div key={m.uid || m.rowIndex} className="border border-slate-100 rounded-xl p-3 bg-slate-50/60">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[11px] font-semibold text-slate-500">{m.tanggalRaw}</span>
                                        {m.shift && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{m.shift}</span>}
                                        <SheetStatusBadge status={m.status} />
                                        <SheetScopeBadge scope={m.scope} />
                                        {m.foreman && <span className="text-[10px] text-slate-400 font-semibold">Foreman: {m.foreman}</span>}
                                    </div>
                                    <p className="text-sm text-slate-700 mt-1">{m.uraian}</p>
                                    <div className="mt-2">
                                        <SheetPhotoSection parentKind="maintenance" rowUid={m.uid} compact />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
