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
    station: OperatorStation;
}

interface StationPickerModalProps {
    initialMode: 'shift' | 'harian';
    initialDate: string;
    initialShift: 1 | 2 | 3;
    onConfirm: (sel: StationSetupSelection) => void;
    onCancel: () => void;
}

const SHIFTS: { n: 1 | 2 | 3; label: string }[] = [
    { n: 1, label: 'Malam' },
    { n: 2, label: 'Pagi' },
    { n: 3, label: 'Sore' },
];

// Dialog setup laporan — muncul saat operator membuka input laporan tanpa station
// (mis. dari sidebar/dashboard). Operator memilih: jenis laporan (Shift/Harian),
// tanggal, shift (untuk mode shift), lalu station. Klik station = konfirmasi.
// Station yang ditampilkan hanya yang PUNYA tab di mode terpilih.
export default function StationPickerModal({
    initialMode,
    initialDate,
    initialShift,
    onConfirm,
    onCancel,
}: StationPickerModalProps) {
    const [mode, setMode] = useState<'shift' | 'harian'>(initialMode);
    const [date, setDate] = useState(initialDate);
    const [shift, setShift] = useState<1 | 2 | 3>(initialShift);

    const tabsMap = mode === 'shift' ? STATION_SHIFT_TABS : STATION_HARIAN_TABS;
    const stations = STATION_ORDER.filter((s) => tabsMap[s].length > 0);

    // Tampilan tanggal format Indonesia (input native ikut locale browser, jadi
    // kita tampilkan label terformat di bawahnya).
    const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
        : '';

    const segBtn = (active: boolean) =>
        `flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${active
            ? 'bg-blue-500 text-white'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
                <div className="px-5 py-4 border-b border-slate-700">
                    <h2 className="text-lg font-bold text-white">Pilih Laporan</h2>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Tentukan jenis laporan, tanggal, lalu pilih station yang ingin kamu isi.
                    </p>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Jenis laporan */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Jenis Laporan</label>
                        <div className="flex gap-2">
                            <button className={segBtn(mode === 'shift')} onClick={() => setMode('shift')}>Shift</button>
                            <button className={segBtn(mode === 'harian')} onClick={() => setMode('harian')}>Harian (LHUBB)</button>
                        </div>
                    </div>

                    {/* Tanggal */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tanggal</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                        />
                        {dateLabel && (
                            <p className="text-xs font-semibold text-blue-300 mt-1.5">{dateLabel}</p>
                        )}
                    </div>

                    {/* Shift (hanya mode shift) */}
                    {mode === 'shift' && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Shift</label>
                            <div className="flex gap-2">
                                {SHIFTS.map((s) => (
                                    <button key={s.n} className={segBtn(shift === s.n)} onClick={() => setShift(s.n)}>
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Station */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Station</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {stations.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => onConfirm({ mode, date, shift, station: s })}
                                    className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-left text-white font-semibold hover:border-blue-500 hover:bg-slate-700 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-blue-400 text-xl">tune</span>
                                    {STATION_LABELS[s]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-slate-700 flex justify-end">
                    <button onClick={onCancel} className="text-sm text-slate-400 hover:text-white px-3 py-1.5">
                        Batal
                    </button>
                </div>
            </div>
        </div>
    );
}
