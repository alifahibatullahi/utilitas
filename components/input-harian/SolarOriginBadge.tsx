import React from 'react';

// Nilai shift dari laporan shift = pagi/sore/malam. 'siang' = legacy. Lainnya/kosong = harian.
export const SHIFT_LABEL: Record<string, string> = { pagi: 'Pagi', sore: 'Sore', siang: 'Siang', malam: 'Malam' };

/** Badge asal entri solar: "Shift Pagi/Sore/Malam" (dari laporan shift) vs "Harian"
 *  (ditambah langsung di laporan harian). Dipakai di TabHandling & TabSolarReview. */
export function SolarOriginBadge({ shift }: { shift?: string | null }) {
    const label = shift ? SHIFT_LABEL[shift] : undefined;
    return label ? (
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-slate-700/40 text-slate-300 border-slate-600/50">
            <span className="material-symbols-outlined text-[11px]">schedule</span>Shift {label}
        </span>
    ) : (
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-blue-500/15 text-blue-300 border-blue-500/30">
            <span className="material-symbols-outlined text-[11px]">edit_calendar</span>Harian
        </span>
    );
}
