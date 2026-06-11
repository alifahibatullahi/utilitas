'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    STATION_ORDER,
    STATION_LABELS,
    STATION_SHIFT_TABS,
    STATION_HARIAN_TABS,
    detectCurrentShift,
    getGroupForShift,
    getGroupShiftOnDate,
    type OperatorStation,
} from '@/lib/constants';

export interface StationSetupSelection {
    mode: 'shift' | 'harian';
    date: string;        // YYYY-MM-DD
    shift: 1 | 2 | 3;    // 1=malam, 2=pagi, 3=sore (hanya relevan utk mode shift)
    station: OperatorStation | 'all';  // 'all' = semua tab (form penuh)
}

interface StationPickerModalProps {
    initialMode: 'shift' | 'harian';
    initialDate: string;
    initialShift: 1 | 2 | 3;
    /** Tampilkan opsi "Review laporan" (form penuh) — khusus admin. */
    allowAllTabs?: boolean;
    onConfirm: (sel: StationSetupSelection) => void;
    onCancel: () => void;
}

// 4 pilihan sejajar: 3 shift + harian (tidak ada lagi 2 langkah Shift→Malam/Pagi/Sore).
type PickerOption = 'malam' | 'pagi' | 'sore' | 'harian';

const OPTIONS: { id: PickerOption; label: string; window: string }[] = [
    { id: 'malam', label: 'Malam', window: '23.00–07.00' },
    { id: 'pagi', label: 'Pagi', window: '07.00–15.00' },
    { id: 'sore', label: 'Sore', window: '15.00–23.00' },
    { id: 'harian', label: 'Harian', window: 'LHUBB · 1 hari' },
];

const SHIFT_NUM: Record<Exclude<PickerOption, 'harian'>, 1 | 2 | 3> = { malam: 1, pagi: 2, sore: 3 };

const LAST_STATION_KEY = 'powerops_last_station';

const fmtYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Tanggal default per opsi — user tidak perlu mengetik tanggal sendiri:
// - pagi/sore: hari ini
// - malam: konvensi ENDING — mulai 23:00 → laporan tercatat tanggal selesai (besok)
// - harian: LHUBB rollover 21:00 — sebelum 21:00 masih laporan kemarin
function defaultDateFor(option: PickerOption): string {
    const now = new Date();
    if (option === 'harian') {
        const t = new Date(now);
        if (now.getHours() * 60 + now.getMinutes() < 21 * 60) t.setDate(t.getDate() - 1);
        return fmtYmd(t);
    }
    if (option === 'malam' && now.getHours() >= 23) {
        const t = new Date(now);
        t.setDate(t.getDate() + 1);
        return fmtYmd(t);
    }
    return fmtYmd(now);
}

// LHUBB diisi grup yang dinas malam mulai 23:00 hari D (working_start = date).
function groupMalamOnDate(dateStr: string): string {
    for (const g of ['A', 'B', 'C', 'D'] as const) {
        if (getGroupShiftOnDate(g, dateStr) === 'M') return g;
    }
    return '';
}

function StepLabel({ n, label }: { n: string; label: string }) {
    return (
        <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs font-semibold text-[#1D4FD7]">{n}</span>
            <span className="text-xs font-medium text-[#707070]">{label}</span>
        </div>
    );
}

export default function StationPickerModal({
    initialMode,
    initialDate,
    initialShift,
    allowAllTabs = false,
    onConfirm,
    onCancel,
}: StationPickerModalProps) {
    const [option, setOption] = useState<PickerOption>(
        initialMode === 'harian' ? 'harian' : initialShift === 1 ? 'malam' : initialShift === 2 ? 'pagi' : 'sore'
    );
    const [date, setDate] = useState(initialDate);
    const [now, setNow] = useState(() => new Date());
    const [lastStation, setLastStation] = useState<string | null>(null);

    // Jam header + deteksi shift berjalan di-refresh tiap 30 detik.
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        try { setLastStation(localStorage.getItem(LAST_STATION_KEY)); } catch { /* ignore */ }
    }, []);

    const current = useMemo(() => detectCurrentShift(), [now]);

    const selectOption = (o: PickerOption) => {
        setOption(o);
        setDate(defaultDateFor(o));
    };

    // Penanda positif: pilihan persis = jadwal yang sedang berjalan.
    const isOnSchedule = option === 'harian'
        ? date === defaultDateFor('harian')
        : option === current.shift && date === current.date;

    const backToNow = () => {
        if (option === 'harian') {
            setDate(defaultDateFor('harian'));
        } else {
            setOption(current.shift);
            setDate(current.date);
        }
    };

    const dutyGroup = option === 'harian' ? groupMalamOnDate(date) : getGroupForShift(date, option);

    const tabsMap = option === 'harian' ? STATION_HARIAN_TABS : STATION_SHIFT_TABS;
    const stations = STATION_ORDER.filter((s) => tabsMap[s].length > 0);

    const confirm = (station: OperatorStation | 'all') => {
        if (station !== 'all') {
            try { localStorage.setItem(LAST_STATION_KEY, station); } catch { /* ignore */ }
        }
        onConfirm({
            mode: option === 'harian' ? 'harian' : 'shift',
            date,
            shift: option === 'harian' ? SHIFT_NUM[current.shift] : SHIFT_NUM[option],
            station,
        });
    };

    const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
        : '';

    const headerDate = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
    const headerClock = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Portal ke document.body: lepas dari <main> AppShell yang di-zoom 1.25 pada
    // monitor besar — tanpa ini, fixed inset-0 tidak menutupi viewport penuh.
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto overscroll-contain animate-in fade-in duration-150">
            <div className="mx-auto w-full max-w-md px-5 pt-6 pb-10 sm:pt-10">

                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-[22px] sm:text-2xl font-semibold tracking-tight text-[#141414]">Input laporan</h1>
                        <p className="mt-0.5 text-sm text-[#707070]">{headerDate} · {headerClock} WIB</p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label="Tutup"
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E2E2E2] text-[#707070] transition-colors hover:bg-[#F5F5F5] hover:text-[#141414] cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* 01 — Pilih shift */}
                <div className="mt-7">
                    <StepLabel n="01" label="Pilih shift" />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        {OPTIONS.map((o) => {
                            const active = option === o.id;
                            const isCurrent = o.id !== 'harian' && current.shift === o.id;
                            return (
                                <button
                                    key={o.id}
                                    type="button"
                                    onClick={() => selectOption(o.id)}
                                    className={`relative rounded-[10px] border p-3 text-left transition-colors cursor-pointer ${
                                        active
                                            ? (isCurrent ? 'border-[#1D4FD7] bg-[#1D4FD7]' : 'border-[#141414] bg-[#141414]')
                                            : isCurrent
                                                ? 'border-[#1D4FD7] bg-[#F4F8FE] hover:bg-[#EAF1FE]'
                                                : 'border-[#E2E2E2] bg-white hover:border-[#BDBDBD]'
                                    }`}
                                >
                                    <span className={`block text-[15px] font-semibold ${active ? 'text-white' : isCurrent ? 'text-[#1D4FD7]' : 'text-[#141414]'}`}>
                                        {o.label}
                                    </span>
                                    <span className={`mt-0.5 block text-xs ${active ? (isCurrent ? 'text-[#BFD2F8]' : 'text-[#A8A8A8]') : isCurrent ? 'text-[#5B82E0]' : 'text-[#8A8A8A]'}`}>
                                        {o.window}
                                    </span>
                                    {isCurrent && (
                                        <span className={`absolute right-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                            active ? 'bg-white text-[#1D4FD7]' : 'bg-[#1D4FD7] text-white'
                                        }`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-[#1D4FD7]' : 'bg-white'}`} />
                                            Sekarang
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 02 — Tanggal */}
                <div className="mt-7">
                    <StepLabel n="02" label="Tanggal" />
                    <div className="relative mt-3">
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* noop */ } }}
                            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 [color-scheme:light]"
                            aria-label="Pilih tanggal"
                        />
                        <div className="pointer-events-none flex w-full items-center justify-between rounded-[10px] border border-[#E2E2E2] bg-white px-4 py-3">
                            <span className="text-[15px] font-semibold text-[#141414]">{dateLabel || 'Pilih tanggal'}</span>
                            <span className="material-symbols-outlined text-[20px] text-[#8A8A8A]">calendar_month</span>
                        </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        {dutyGroup && (
                            <span className="rounded-full border border-[#E2E2E2] px-2.5 py-0.5 text-xs font-semibold text-[#555555]">
                                Grup {dutyGroup}
                            </span>
                        )}
                        {isOnSchedule ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4FD7]">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#1D4FD7]" />
                                Sesuai jadwal sekarang
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={backToNow}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4FD7] underline underline-offset-2 cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[14px]">history</span>
                                Kembali ke sekarang
                            </button>
                        )}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[#9A9A9A]">
                        Tanggal terisi otomatis mengikuti shift — ubah hanya jika mengisi laporan lama.
                    </p>
                </div>

                {/* 03 — Pilih station */}
                <div className="mt-7">
                    <StepLabel n="03" label="Pilih station" />
                    <div className="mt-3 overflow-hidden rounded-xl border border-[#E8E8E8]">
                        {stations.map((s, i) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => confirm(s)}
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAFAFA] cursor-pointer ${i > 0 ? 'border-t border-[#F0F0F0]' : ''}`}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[15px] font-semibold text-[#141414]">{STATION_LABELS[s]}</span>
                                        {lastStation === s && (
                                            <span className="rounded-full border border-[#C9D8FB] bg-[#F4F8FE] px-2 py-px text-[11px] font-semibold text-[#1D4FD7]">
                                                Terakhir
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 truncate text-xs text-[#8A8A8A]">{tabsMap[s].join(' · ')}</p>
                                </div>
                                <span className="material-symbols-outlined shrink-0 text-[18px] text-[#B5B5B5]">chevron_right</span>
                            </button>
                        ))}
                    </div>

                    {/* Form penuh (semua tab) — khusus admin */}
                    {allowAllTabs && (
                        <button
                            type="button"
                            onClick={() => confirm('all')}
                            className="mt-3 flex w-full items-center gap-2.5 rounded-xl border border-dashed border-[#D5D5D5] px-4 py-3 text-left transition-colors hover:bg-[#FAFAFA] cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[18px] text-[#707070]">lock_open</span>
                            <span className="flex-1 text-sm font-semibold text-[#555555]">Review laporan — semua tab</span>
                            <span className="rounded-full border border-[#E2E2E2] px-2 py-0.5 text-[11px] font-semibold text-[#707070]">Admin</span>
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onCancel}
                    className="mt-8 w-full rounded-[10px] border border-[#E2E2E2] py-2.5 text-sm font-semibold text-[#707070] transition-colors hover:bg-[#F5F5F5] cursor-pointer"
                >
                    Batal
                </button>
            </div>
        </div>,
        document.body
    );
}
