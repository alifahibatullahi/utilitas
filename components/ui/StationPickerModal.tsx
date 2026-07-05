'use client';

import { useEffect, useState } from 'react';
import {
    STATION_ORDER,
    STATION_LABELS,
    STATION_SHIFT_TABS,
    STATION_HARIAN_TABS,
    detectCurrentShift,
    detectDefaultReport,
    type OperatorStation,
} from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';

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
const REPORT_CHOICES: { id: 'malam' | 'pagi' | 'sore' | 'harian'; shift?: 1 | 2 | 3; label: string; time: string; icon: string; activeClass: string }[] = [
    {
        id: 'malam', shift: 1, label: 'Malam', time: '23.00–07.00', icon: 'bedtime',
        activeClass: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 border-indigo-500/40',
    },
    {
        id: 'pagi', shift: 2, label: 'Pagi', time: '07.00–15.00', icon: 'light_mode',
        activeClass: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-500/20 border-amber-400/40',
    },
    {
        id: 'sore', shift: 3, label: 'Sore', time: '15.00–23.00', icon: 'wb_twilight',
        activeClass: 'bg-gradient-to-r from-orange-600 to-red-500 text-white shadow-md shadow-orange-500/20 border-orange-500/40',
    },
    {
        id: 'harian', label: 'Harian', time: 'Rekap 24 jam', icon: 'today',
        activeClass: 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20 border-emerald-500/40',
    },
];

const SHIFT_NUM: Record<'malam' | 'pagi' | 'sore', 1 | 2 | 3> = { malam: 1, pagi: 2, sore: 3 };
const SHIFT_LABEL: Record<1 | 2 | 3, string> = { 1: 'Malam', 2: 'Pagi', 3: 'Sore' };

// Format YYYY-MM-DD → "Sabtu, 5 Juli 2026" (kosong bila format tidak valid).
function fmtDateID(d: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
}

// Tanggal laporan harian yang seharusnya diisi sekarang — rollover 21:00,
// mengikuti logika default harian di app/input-shift/page.tsx.
function harianExpectedToday(): string {
    const now = new Date();
    const target = new Date(now);
    if (now.getHours() * 60 + now.getMinutes() < 21 * 60) target.setDate(target.getDate() - 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
}

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

    // Shift & tanggal yang sedang berlangsung — dihitung sekali saat modal dibuka.
    // Aman dari hydration mismatch: modal hanya dirender client-side setelah mounted.
    const [current] = useState(() => detectCurrentShift());
    const [harianExpected] = useState(() => harianExpectedToday());
    const currentShiftNum = SHIFT_NUM[current.shift];
    // Laporan yang WAKTUNYA DIISI sekarang (jendela pengisian): badge "Sekarang"
    // menempel di sini — pada 22:30–04:15 jatuh ke Harian, bukan shift malam
    // (laporan malam baru bisa diisi mulai 04:15).
    const [defaultRep] = useState(() => detectDefaultReport());

    // Penanda pasif bila pilihan menyimpang dari waktu sekarang (shift ATAU tanggal).
    const mismatch = mode === 'shift'
        ? shift !== currentShiftNum || date !== current.date
        : date !== harianExpected;
    const resetToNow = () => {
        setMode(defaultRep.mode);
        setShift(SHIFT_NUM[defaultRep.shift]);
        setDate(defaultRep.date);
    };

    const tabsMap = mode === 'shift' ? STATION_SHIFT_TABS : STATION_HARIAN_TABS;
    const stations = STATION_ORDER.filter((s) => tabsMap[s].length > 0);

    // Station yang sudah mengisi laporan (mode/tanggal/shift terpilih) — dibaca dari
    // station_fillers JSONB (di-merge atomik via RPC tiap kali operator menyimpan
    // dari station view). Dipakai untuk penanda hijau + centang di grid station.
    const [filledStations, setFilledStations] = useState<Set<string>>(new Set());
    useEffect(() => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setFilledStations(new Set()); return; }
        let stale = false;
        const supabase = createClient();
        const query = mode === 'harian'
            ? supabase.from('daily_reports').select('station_fillers').eq('date', date)
                .order('created_at', { ascending: false }).limit(1).maybeSingle()
            : supabase.from('shift_reports').select('station_fillers').eq('date', date)
                .eq('shift', (['malam', 'pagi', 'sore'] as const)[shift - 1]) // kolom shift = enum shift_type
                .order('created_at', { ascending: false }).limit(1).maybeSingle();
        query.then(({ data }) => {
            if (stale) return;
            const sf = ((data as { station_fillers?: Record<string, string> | null } | null)?.station_fillers) ?? {};
            const keys = new Set(Object.keys(sf));
            // Key legacy panel penuh menandai kedua panel boiler.
            if (keys.has('panel_boiler')) { keys.add('panel_boiler_a'); keys.add('panel_boiler_b'); }
            setFilledStations(keys);
        });
        return () => { stale = true; };
    }, [mode, date, shift]);

    // Tampilan tanggal format Indonesia
    const dateLabel = fmtDateID(date);

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
                                // Badge "Sekarang" = laporan yang waktunya diisi saat ini
                                // (22:30–04:15 jatuh ke Harian, bukan shift malam).
                                const isNow = defaultRep.mode === 'harian'
                                    ? c.id === 'harian'
                                    : c.shift === SHIFT_NUM[defaultRep.shift];
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                            if (c.id === 'harian') { setMode('harian'); return; }
                                            setMode('shift');
                                            setShift(c.shift!);
                                        }}
                                        className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 sm:px-2 py-2 rounded-xl text-[11px] sm:text-xs uppercase tracking-wider font-bold transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] border border-transparent
                                            ${active ? c.activeClass : REPORT_CHOICE_INACTIVE}`}
                                    >
                                        {isNow && (
                                            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-emerald-500 px-1.5 py-[1px] text-[8px] font-black text-white normal-case tracking-normal whitespace-nowrap shadow-md shadow-emerald-500/30 pointer-events-none">
                                                <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                                                Sekarang
                                            </span>
                                        )}
                                        <span className="flex items-center justify-center gap-1.5">
                                            <span className="material-symbols-outlined text-sm">{c.icon}</span>
                                            <span>{c.label}</span>
                                        </span>
                                        <span className="text-[8px] sm:text-[9px] font-semibold normal-case tracking-normal opacity-70 whitespace-nowrap">
                                            {c.time}
                                        </span>
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

                        {/* Hint pasif: pilihan menyimpang dari shift/tanggal yang sedang berlangsung */}
                        {mismatch && (
                            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 animate-in fade-in duration-200">
                                <span className="material-symbols-outlined text-amber-400 text-[16px] mt-[1px]">warning</span>
                                <p className="text-[11px] text-amber-200/90 font-medium leading-relaxed">
                                    {mode === 'shift' ? (
                                        <>Saat ini sedang berlangsung <b>Shift {SHIFT_LABEL[currentShiftNum]}</b> — laporan {fmtDateID(current.date)}. Pastikan pilihanmu sudah benar.</>
                                    ) : (
                                        <>Laporan harian yang seharusnya diisi sekarang adalah laporan <b>{fmtDateID(harianExpected)}</b>. Pastikan pilihanmu sudah benar.</>
                                    )}{' '}
                                    <button
                                        type="button"
                                        onClick={resetToNow}
                                        className="text-amber-300 font-bold underline underline-offset-2 hover:text-amber-100 transition-colors cursor-pointer"
                                    >
                                        Gunakan waktu sekarang
                                    </button>
                                </p>
                            </div>
                        )}
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
                                const isFilled = filledStations.has(s);

                                return (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => onConfirm({ mode, date, shift, station: s })}
                                        className={`group flex items-center gap-3 rounded-2xl border p-3 text-left text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer
                                            ${isFilled
                                                ? 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15 hover:border-emerald-400/60'
                                                : `border-slate-800 bg-slate-900/40 hover:bg-slate-850/60 ${theme.borderHover} ${theme.glow}`}`}
                                    >
                                        <div className={`flex items-center justify-center p-2 rounded-xl ${theme.iconBg} ${theme.color} transition-all duration-300 group-hover:scale-110 shrink-0`}>
                                            <span className="material-symbols-outlined text-lg">{theme.icon}</span>
                                        </div>
                                        <h4 className={`min-w-0 flex-1 text-xs font-bold tracking-wide leading-tight transition-colors ${isFilled ? 'text-emerald-300 group-hover:text-emerald-200' : 'text-slate-200 group-hover:text-white'}`}>
                                            {STATION_LABELS[s]}
                                        </h4>
                                        {isFilled ? (
                                            <span className="material-symbols-outlined text-emerald-400 text-lg shrink-0" aria-label="Sudah diisi">
                                                check_circle
                                            </span>
                                        ) : (
                                            <span className="material-symbols-outlined text-slate-600 group-hover:text-slate-400 text-xs transition-colors shrink-0">
                                                arrow_forward_ios
                                            </span>
                                        )}
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
