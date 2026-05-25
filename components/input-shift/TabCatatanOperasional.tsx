'use client';
import React, { useMemo } from 'react';
import { Card } from './SharedComponents';
import type { AshUnloadingEntry } from './TabESP';

interface SolarInEntry { id?: string; tanggal: string; jumlah: number | null; perusahaan: string }
interface SolarOutEntry { id?: string; tanggal: string; jumlah: number | null; tujuan: string }

interface TabCatatanOperasionalProps {
    catatan: string;
    onCatatanChange: (v: string) => void;
    solarEntries: SolarInEntry[];
    outSolarEntries: SolarOutEntry[];
    savedSolarEntries: SolarInEntry[];
    savedOutSolarEntries: SolarOutEntry[];
    ashEntries: AshUnloadingEntry[];
    savedAshEntries: AshUnloadingEntry[];
    coalBunker: Record<string, number | string | null>;
}

const BUNKER_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

// ─── Auto-catatan helpers (exported, dipakai juga di page.tsx saat submit) ───

export interface AutoCatatanInput {
    solarIn: SolarInEntry[];
    solarOut: SolarOutEntry[];
    ash: AshUnloadingEntry[];
    coalBunker: Record<string, number | string | null>;
}

/** Pattern auto-line yang harus di-strip dari catatan saat load supaya tidak duplikat. */
const AUTO_CATATAN_PATTERNS: RegExp[] = [
    /^Kedatangan solar dari .+ sebanyak .+ L\.?$/i,
    /^Permintaan solar ke .+ sebanyak .+ L\.?$/i,
    /^Unloading fly ash Silo [AB] sebanyak \d+× ke .+\.?$/i,
    /^Bunker [A-F] berasap\.?$/i,
];

/** Hapus auto-line dari teks catatan (dipakai saat load dari DB). */
export function stripAutoCatatan(raw: string | null | undefined): string {
    if (!raw) return '';
    const kept = raw
        .split('\n')
        .filter(line => {
            const t = line.trim();
            if (!t) return true; // keep blank lines, akan di-trim nanti
            return !AUTO_CATATAN_PATTERNS.some(re => re.test(t));
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return kept;
}

/** Build daftar auto-line dari state live (entries + bunker). */
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
        if (st === 'berasap') lines.push(`Bunker ${k.toUpperCase()} berasap`);
    }
    return lines;
}

/** Gabungkan auto-lines + free text jadi catatan final untuk disimpan ke DB. */
export function combineCatatan(autoLines: string[], freeText: string): string | null {
    const free = (freeText ?? '').trim();
    if (autoLines.length === 0 && !free) return null;
    if (autoLines.length === 0) return free;
    if (!free) return autoLines.join('\n');
    return autoLines.join('\n') + '\n\n' + free;
}

// ─── Component ───

export default function TabCatatanOperasional({
    catatan,
    onCatatanChange,
    solarEntries,
    outSolarEntries,
    savedSolarEntries,
    savedOutSolarEntries,
    ashEntries,
    savedAshEntries,
    coalBunker,
}: TabCatatanOperasionalProps) {
    const autoLines = useMemo(() => {
        const solarIn = [...savedSolarEntries, ...solarEntries];
        const solarOut = [...savedOutSolarEntries, ...outSolarEntries];
        const ash = [...savedAshEntries, ...ashEntries];
        return buildAutoCatatanLines({ solarIn, solarOut, ash, coalBunker });
    }, [solarEntries, outSolarEntries, savedSolarEntries, savedOutSolarEntries, ashEntries, savedAshEntries, coalBunker]);

    return (
        <div className="w-full max-w-3xl mx-auto">
            <Card title="Catatan Operasional" icon="sticky_note_2" color="amber">
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    Tulis catatan operasional bebas (kejadian penting, info untuk shift berikutnya, dll).
                    Aktivitas <span className="text-amber-300 font-semibold">solar</span>,{' '}
                    <span className="text-slate-300 font-semibold">unloading fly ash</span>, dan{' '}
                    <span className="text-amber-300 font-semibold">bunker berasap</span> akan ditambahkan otomatis
                    dari tab masing-masing saat laporan disimpan.
                </p>

                {/* Preview auto-lines yang bakal di-prepend saat save */}
                {autoLines.length > 0 && (
                    <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="material-symbols-outlined text-amber-400 text-[14px]">auto_awesome</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                                Otomatis ditambahkan saat simpan
                            </span>
                        </div>
                        <ul className="space-y-0.5">
                            {autoLines.map((line, i) => (
                                <li key={i} className="text-[11px] text-amber-100/90 font-mono">• {line}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <textarea
                    value={catatan}
                    onChange={e => onCatatanChange(e.target.value)}
                    placeholder="Tulis catatan operasional di sini... (mis. kejadian unit trip, info ke shift berikutnya)"
                    rows={14}
                    className="w-full bg-[#0e1621] border border-slate-700/60 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none resize-y placeholder:text-slate-600 leading-relaxed"
                />

                <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                    Catatan ini akan ikut tampil di pesan publish WhatsApp dan laporan PDF.
                </p>
            </Card>
        </div>
    );
}
