'use client';

import { useState, useEffect, useCallback } from 'react';
import { listSchedules, updateSchedule, ScheduleRow } from '@/app/admin/notification-log/schedule-actions';

const pad = (n: number) => String(n).padStart(2, '0');

function fmtTime(h: number, m: number): string {
    if (h >= 24) return `${pad(h - 24)}:${pad(m)} (+1 hari)`;
    return `${pad(h)}:${pad(m)}`;
}

interface DraftRow extends ScheduleRow {
    dirty?: boolean;
}

export default function SchedulePanel() {
    const [rows, setRows] = useState<DraftRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await listSchedules();
        if (res.ok) setRows(res.data.map(r => ({ ...r })));
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const update = (id: string, patch: Partial<DraftRow>) => {
        setRows(rows.map(r => r.id === id ? { ...r, ...patch, dirty: true } : r));
    };

    const save = async (row: DraftRow) => {
        setSavingId(row.id);
        setMsg(null);
        const res = await updateSchedule(row.id, {
            start_hour: row.start_hour,
            start_minute: row.start_minute,
            end_hour: row.end_hour,
            end_minute: row.end_minute,
            throttle_minutes: row.throttle_minutes,
            enabled: row.enabled,
        });
        setMsg(res.ok ? `✓ "${row.label}" tersimpan` : `✗ ${res.error}`);
        setSavingId(null);
        if (res.ok) await load();
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-bold text-white">Jadwal Reminder</h3>
                <p className="text-xs text-text-secondary mt-1">
                    Reminder dikirim <b>1x per shift</b> (tidak repeat). Cron eksternal ping endpoint tiap 15 menit;
                    pengiriman pertama setelah <b>Jam mulai</b> akan trigger send, lalu di-skip permanen sampai laporan berikutnya.
                </p>
                <p className="text-xs text-text-secondary mt-1">
                    <b>Jam selesai</b> = batas akhir window (kalau cron baru aktif setelah jam ini, reminder dilewat). Untuk jam yang melewati tengah malam, gunakan jam &gt; 23 (mis. <code className="text-amber-300">26:00</code> = 02:00 hari berikutnya).
                </p>
            </div>

            {msg && <div className="text-sm bg-surface-highlight/50 border border-slate-700 rounded-lg px-4 py-2 text-white">{msg}</div>}

            {loading && <div className="text-text-secondary text-sm">Memuat...</div>}

            <div className="space-y-3">
                {rows.map(r => (
                    <div key={r.id} className="bg-surface-dark rounded-xl border border-slate-800 p-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h4 className="text-sm font-bold text-white">{r.label}</h4>
                                <code className="text-xs text-emerald-400">{r.id}</code>
                                <span className="ml-2 text-xs text-text-secondary">
                                    Window aktif: {fmtTime(r.start_hour, r.start_minute)} → {fmtTime(r.end_hour, r.end_minute)}
                                </span>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer whitespace-nowrap">
                                <input type="checkbox" checked={r.enabled} onChange={e => update(r.id, { enabled: e.target.checked })} />
                                Aktif
                            </label>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <Field label="Mulai jam" value={r.start_hour} min={0} max={23} onChange={v => update(r.id, { start_hour: v })} />
                            <Field label="Mulai menit" value={r.start_minute} min={0} max={59} onChange={v => update(r.id, { start_minute: v })} />
                            <Field label="Selesai jam" value={r.end_hour} min={0} max={47} onChange={v => update(r.id, { end_hour: v })} hint=">23 = next day" />
                            <Field label="Selesai menit" value={r.end_minute} min={0} max={59} onChange={v => update(r.id, { end_minute: v })} />
                        </div>

                        <div className="flex justify-end mt-4">
                            <button onClick={() => save(r)} disabled={!r.dirty || savingId === r.id}
                                className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg cursor-pointer">
                                {savingId === r.id ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Field({ label, value, min, max, onChange, hint }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; hint?: string }) {
    return (
        <div>
            <label className="block text-xs text-text-secondary uppercase mb-1.5">{label}</label>
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full bg-surface-highlight border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-primary"
            />
            {hint && <p className="text-[10px] text-text-secondary mt-1">{hint}</p>}
        </div>
    );
}
