'use client';
import React from 'react';
import { Card } from './SharedComponents';
import type { AshUnloadingEntry } from './TabESP';
import type { BunkerBerasapInfo } from '@/hooks/useShiftReport';
import { STATION_LABELS, type OperatorStation } from '@/lib/constants';

interface SolarInEntry { id?: string; tanggal: string; jumlah: number | null; perusahaan: string }
interface SolarOutEntry { id?: string; tanggal: string; jumlah: number | null; tujuan: string }

// Station yang punya tab Catatan Operasional sendiri. Catatan dari station ini
// digabung saat publish; di form, ditampilkan saling-silang sebagai referensi.
const CATATAN_STATION_ORDER: OperatorStation[] = ['panel_boiler_a', 'panel_boiler_b', 'panel_turbin'];

interface TabCatatanOperasionalProps {
    catatan: string;
    onCatatanChange: (v: string) => void;
    /** Semua catatan per-station (report.station_catatan) — untuk menampilkan catatan
     *  station LAIN (PB A/B & Turbin) sebagai referensi read-only di tab ini. */
    stationCatatan?: Record<string, string> | null;
    /** Station yang sedang diedit (textarea). Dikecualikan dari blok referensi karena
     *  sudah jadi textarea utama. Null = mode penuh → semua station tampil sebagai referensi. */
    currentStation?: string | null;
    // Props lain (solar/ash/coalBunker) tetap di-pass untuk back-compat & jaga2 kalau
    // butuh derive sesuatu di masa depan, tapi tidak dipakai sekarang.
    solarEntries?: SolarInEntry[];
    outSolarEntries?: SolarOutEntry[];
    savedSolarEntries?: SolarInEntry[];
    savedOutSolarEntries?: SolarOutEntry[];
    ashEntries?: AshUnloadingEntry[];
    savedAshEntries?: AshUnloadingEntry[];
    coalBunker?: Record<string, number | string | null>;
}

const BUNKER_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

// ─── Auto-catatan helpers (exported, dipakai juga di page.tsx untuk auto-inject) ───

export interface AutoCatatanInput {
    solarIn: SolarInEntry[];
    solarOut: SolarOutEntry[];
    ash: AshUnloadingEntry[];
    coalBunker: Record<string, number | string | null>;
    /** Hasil dari useBunkerBerasapHistory — kunci dari shift terakhir saat bunker mulai berasap.
     *  Kalau bunker baru pertama kali dilaporkan berasap di shift sekarang, value-nya null →
     *  fallback ke currentDate + currentShift. */
    berasapSince?: BunkerBerasapInfo;
    currentDate?: string;        // YYYY-MM-DD, fallback "sejak shift ini"
    currentShift?: string;       // 'malam' | 'pagi' | 'sore'
}

const SHIFT_LABEL: Record<string, string> = { malam: 'Shift Malam', pagi: 'Shift Pagi', sore: 'Shift Sore' };

/** Format DD/MM Shift X dari date+shift (idem TabCoalBunker.formatBerasapSince). */
function formatSince(info: { date: string; shift: string } | null | undefined): string {
    if (!info || !info.date) return '';
    const d = new Date(info.date + 'T00:00:00');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month} ${SHIFT_LABEL[info.shift] || info.shift}`;
}

/** Build daftar auto-line dari state live (entries + bunker berasap). */
export function buildAutoCatatanLines(p: AutoCatatanInput): string[] {
    const lines: string[] = [];

    for (const e of p.solarIn) {
        if (e.jumlah && e.perusahaan) {
            lines.push(`Kedatangan solar dari ${e.perusahaan} sebanyak ${e.jumlah.toLocaleString('id-ID')} L`);
        }
    }
    for (const e of p.solarOut) {
        if (e.jumlah && e.tujuan) {
            lines.push(`Permintaan solar ke ${e.tujuan} sebanyak ${e.jumlah.toLocaleString('id-ID')} L`);
        }
    }
    for (const e of p.ash) {
        if (e.silo && e.ritase) {
            lines.push(`Unloading fly ash Silo ${e.silo} sebanyak ${e.ritase}× ke ${e.tujuan || '-'}`);
        }
    }
    for (const k of BUNKER_KEYS) {
        const st = String(p.coalBunker[`status_bunker_${k}`] ?? 'running').toLowerCase();
        if (st !== 'berasap') continue;
        // Cari kapan pertama kali berasap. Kalau ada history → pakai itu. Kalau tidak ada
        // (bunker baru pertama dilaporkan berasap di shift ini) → fallback ke currentDate/Shift.
        const histKey = `status_bunker_${k}`;
        const hist = p.berasapSince?.[histKey];
        const since = hist
            ? formatSince(hist)
            : (p.currentDate && p.currentShift ? formatSince({ date: p.currentDate, shift: p.currentShift }) : '');
        lines.push(since
            ? `Bunker ${k.toUpperCase()} berasap sejak ${since}`
            : `Bunker ${k.toUpperCase()} berasap`);
    }
    return lines;
}

// ─── Component ───

export default function TabCatatanOperasional({
    catatan,
    onCatatanChange,
    stationCatatan,
    currentStation,
}: TabCatatanOperasionalProps) {
    const sc = stationCatatan ?? {};
    // Catatan station LAIN (selain yang sedang diedit) yang ada isinya → referensi read-only.
    const others = CATATAN_STATION_ORDER.filter(
        s => s !== currentStation && (sc[s] ?? '').trim().length > 0,
    );

    return (
        <div className="w-full max-w-3xl mx-auto space-y-4">
            <Card title="Catatan Operasional" icon="sticky_note_2" color="amber">
                <textarea
                    value={catatan}
                    onChange={e => onCatatanChange(e.target.value)}
                    placeholder="Tulis catatan operasional di sini..."
                    rows={16}
                    className="w-full bg-[#0e1621] border border-slate-700/60 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none resize-y placeholder:text-slate-600 leading-relaxed font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                    Catatan ini akan ikut tampil di pesan publish WhatsApp dan laporan PDF.
                </p>
            </Card>

            {others.length > 0 && (
                <Card title="Catatan Station Lain" icon="notes" color="slate">
                    <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                        Catatan dari Panel Boiler / Turbin lain (read-only). Semua digabung otomatis saat publish.
                    </p>
                    <div className="space-y-3">
                        {others.map(s => (
                            <div key={s}>
                                <p className="text-[11px] font-bold text-slate-300 mb-1">{STATION_LABELS[s]}</p>
                                <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans bg-[#0e1621] border border-slate-700/60 rounded-lg px-3 py-2 leading-relaxed">{sc[s].trim()}</pre>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
