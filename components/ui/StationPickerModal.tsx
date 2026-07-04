'use client';

import { useState } from 'react';
import {
    STATION_ORDER,
    STATION_LABELS,
    STATION_SHIFT_TABS,
    STATION_HARIAN_TABS,
    type OperatorStation,
} from '@/lib/constants';

export interface StationSetupSelection {
    mode: 'shift' | 'harian';
    date: string;        // YYYY-MM-DD
    shift: 1 | 2 | 3;    // 1=malam, 2=pagi, 3=sore (hanya relevan utk mode shift)
    station: OperatorStation | 'all';  // 'all' = semua tab (form penuh, foreman/supervisor)
}

interface StationPickerModalProps {
    initialMode: 'shift' | 'harian';
    initialDate: string;
    initialShift: 1 | 2 | 3;
    /** Tampilkan opsi "Semua Tab" (form penuh) — tersedia untuk semua user. */
    allowAllTabs?: boolean;
    onConfirm: (sel: StationSetupSelection) => void;
    onCancel: () => void;
}

// Pilihan jenis laporan datar: 3 shift + harian dalam satu baris.
// malam/pagi/sore → mode 'shift' + nomor shift; harian → mode 'harian'.
const REPORT_CHOICE_INACTIVE = 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 hover:border-slate-700/50';
const REPORT_CHOICES: { id: 'malam' | 'pagi' | 'sore' | 'harian'; shift?: 1 | 2 | 3; label: string; icon: string; activeClass: string }[] = [
    {
        id: 'malam', shift: 1, label: 'Malam', icon: 'bedtime',
        activeClass: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 border-indigo-500/40',
    },
    {
        id: 'pagi', shift: 2, label: 'Pagi', icon: 'light_mode',
        activeClass: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-500/20 border-amber-400/40',
    },
    {
        id: 'sore', shift: 3, label: 'Sore', icon: 'wb_twilight',
        activeClass: 'bg-gradient-to-r from-orange-600 to-red-500 text-white shadow-md shadow-orange-500/20 border-orange-500/40',
    },
    {
        id: 'harian', label: 'Harian', icon: 'today',
        activeClass: 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20 border-emerald-500/40',
    },
];

// Custom icons and color themes for each operator station
const STATION_THEMES: Record<
    OperatorStation,
    { icon: string; color: string; borderHover: string; glow: string; textActive: string; iconBg: string }
> = {
    panel_boiler: {
        icon: 'local_fire_department',
        color: 'text-rose-400',
        borderHover: 'hover:border-rose-500/50',
        glow: 'hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]',
        textActive: 'text-rose-400',
        iconBg: 'bg-rose-500/10',
    },
    panel_boiler_a: {
        icon: 'local_fire_department',
        color: 'text-rose-400',
        borderHover: 'hover:border-rose-500/50',
        glow: 'hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]',
        textActive: 'text-rose-400',
        iconBg: 'bg-rose-500/10',
    },
    panel_boiler_b: {
        icon: 'local_fire_department',
        color: 'text-orange-400',
        borderHover: 'hover:border-orange-500/50',
        glow: 'hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]',
        textActive: 'text-orange-400',
        iconBg: 'bg-orange-500/10',
    },
    panel_turbin: {
        icon: 'toys_fan',
        color: 'text-cyan-400',
        borderHover: 'hover:border-cyan-500/50',
        glow: 'hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]',
        textActive: 'text-cyan-400',
        iconBg: 'bg-cyan-500/10',
    },
    handling: {
        icon: 'precision_manufacturing',
        color: 'text-amber-400',
        borderHover: 'hover:border-amber-500/50',
        glow: 'hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]',
        textActive: 'text-amber-400',
        iconBg: 'bg-amber-500/10',
    },
    esp: {
        icon: 'electric_bolt',
        color: 'text-purple-400',
        borderHover: 'hover:border-purple-500/50',
        glow: 'hover:shadow-[0_0_20px_rgba(192,132,252,0.15)]',
        textActive: 'text-purple-400',
        iconBg: 'bg-purple-500/10',
    },
    bunker: {
        icon: 'layers',
        color: 'text-blue-400',
        borderHover: 'hover:border-blue-500/50',
        glow: 'hover:shadow-[0_0_20px_rgba(96,165,250,0.15)]',
        textActive: 'text-blue-400',
        iconBg: 'bg-blue-500/10',
    },
    lapangan_boiler: {
        icon: 'science',
        color: 'text-teal-400',
        borderHover: 'hover:border-teal-500/50',
        glow: 'hover:shadow-[0_0_20px_rgba(45,212,191,0.15)]',
        textActive: 'text-teal-400',
        iconBg: 'bg-teal-500/10',
    },
    lapangan_turbin: {
        icon: 'engineering',
        color: 'text-emerald-400',
        borderHover: 'hover:border-emerald-500/50',
        glow: 'hover:shadow-[0_0_20px_rgba(52,211,153,0.15)]',
        textActive: 'text-emerald-400',
        iconBg: 'bg-emerald-500/10',
    },
};

export default function StationPickerModal({
    initialMode,
    initialDate,
    initialShift,
    allowAllTabs = false,
    onConfirm,
    onCancel,
}: StationPickerModalProps) {
    const [mode, setMode] = useState<'shift' | 'harian'>(initialMode);
    const [date, setDate] = useState(initialDate);
    const [shift, setShift] = useState<1 | 2 | 3>(initialShift);

    const tabsMap = mode === 'shift' ? STATION_SHIFT_TABS : STATION_HARIAN_TABS;
    const stations = STATION_ORDER.filter((s) => tabsMap[s].length > 0);

    // Tampilan tanggal format Indonesia
    const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
        : '';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl rounded-3xl border border-slate-700 bg-slate-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 duration-200 ease-out">
                {/* Close Button on top right */}
                <button
                    type="button"
                    onClick={onCancel}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-slate-800/80 p-1.5 rounded-full transition-colors z-20 cursor-pointer flex items-center justify-center"
                    aria-label="Tutup"
                >
                    <span className="material-symbols-outlined text-lg">close</span>
                </button>

                {/* Ambient glow decoration */}
                <div className="absolute -top-[20%] -right-[20%] w-72 h-72 rounded-full bg-blue-500/10 blur-[80px] pointer-events-none" />
                <div className="absolute -bottom-[20%] -left-[20%] w-72 h-72 rounded-full bg-emerald-500/5 blur-[80px] pointer-events-none" />

                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-800 relative z-10">
                    <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-slate-400 tracking-tight flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-400">assignment</span>
                        Pilih Laporan
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed pr-6">
                        Tentukan jenis laporan, tanggal, lalu pilih station untuk mulai mengisi data.
                    </p>
                </div>

                {/* Content Body */}
                <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto relative z-10 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    
                    {/* Step 1: Jenis Laporan — 4 pilihan datar (malam/pagi/sore/harian) */}
                    <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">1. Jenis Laporan</label>
                        <div className="flex bg-slate-950/60 p-1.5 rounded-2xl border border-slate-850 gap-1.5 shadow-[inset_0_1.5px_4px_rgba(0,0,0,0.5)]">
                            {REPORT_CHOICES.map((c) => {
                                const active = mode === 'harian' ? c.id === 'harian' : c.shift === shift;
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                            if (c.id === 'harian') { setMode('harian'); return; }
                                            setMode('shift');
                                            setShift(c.shift!);
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] sm:text-xs uppercase tracking-wider font-bold transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] border border-transparent
                                            ${active ? c.activeClass : REPORT_CHOICE_INACTIVE}`}
                                    >
                                        <span className="material-symbols-outlined text-sm">{c.icon}</span>
                                        <span>{c.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step 2: Tanggal */}
                    <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">2. Tanggal</label>
                        {/* Native date input transparan di atas; tampilan field memakai
                            format Indonesia (input native ikut locale browser, jadi disembunyikan). */}
                        <div className="relative group">
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* noop */ } }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 [color-scheme:dark]"
                                aria-label="Pilih tanggal"
                            />
                            <div className="pointer-events-none w-full rounded-2xl border border-slate-800 bg-slate-900/60 group-hover:bg-slate-900/80 px-4 py-3 flex items-center justify-between transition-all">
                                <span className="flex items-center gap-2 text-white text-sm font-semibold">
                                    <span className="material-symbols-outlined text-[18px] text-cyan-400">event</span>
                                    {dateLabel || 'Pilih tanggal'}
                                </span>
                                <span className="material-symbols-outlined text-slate-400 text-[18px]">calendar_today</span>
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Station Grid */}
                    <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            3. Pilih Station
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {stations.map((s) => {
                                const theme = STATION_THEMES[s] || {
                                    icon: 'tune',
                                    color: 'text-blue-400',
                                    borderHover: 'hover:border-blue-500/50',
                                    glow: 'hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]',
                                    textActive: 'text-blue-400',
                                    iconBg: 'bg-blue-500/10'
                                };
                                const activeTabs = tabsMap[s];

                                return (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => onConfirm({ mode, date, shift, station: s })}
                                        className={`group flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-850/60 p-3 text-left text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${theme.borderHover} ${theme.glow}`}
                                    >
                                        <div className={`flex items-center justify-center p-2 rounded-xl ${theme.iconBg} ${theme.color} transition-all duration-300 group-hover:scale-110 shrink-0`}>
                                            <span className="material-symbols-outlined text-lg">{theme.icon}</span>
                                        </div>
                                        <div className="min-w-0 flex-1 self-center">
                                            <h4 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors tracking-wide leading-tight">
                                                {STATION_LABELS[s]}
                                            </h4>
                                            {activeTabs.length > 0 ? (
                                                <p className="text-[10px] text-slate-500 group-hover:text-slate-400/80 font-medium tracking-wide mt-0.5 truncate transition-colors">
                                                    {activeTabs.join(' • ')}
                                                </p>
                                            ) : (
                                                <p className="text-[9px] text-slate-600 font-medium italic mt-0.5">
                                                    Tidak ada input
                                                </p>
                                            )}
                                        </div>
                                        <span className="material-symbols-outlined text-slate-600 group-hover:text-slate-400 text-xs self-center transition-colors shrink-0">
                                            arrow_forward_ios
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Opsi form penuh — hanya foreman/supervisor/admin */}
                        {allowAllTabs && (
                            <button
                                type="button"
                                onClick={() => onConfirm({ mode, date, shift, station: 'all' })}
                                className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-3 text-sm font-bold text-indigo-200 transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-lg">grid_view</span>
                                Review laporan
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-950/20 border-t border-slate-850 flex justify-end gap-3 relative z-10">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-xs text-slate-400 hover:text-white font-bold px-4 py-2 rounded-xl hover:bg-slate-800/60 transition-all duration-200 cursor-pointer"
                    >
                        Batal
                    </button>
                </div>
            </div>
        </div>
    );
}
