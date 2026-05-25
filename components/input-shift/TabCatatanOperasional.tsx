'use client';
import React from 'react';
import { Card } from './SharedComponents';
import type { AshUnloadingEntry } from './TabESP';

interface SolarInEntry { id?: string; tanggal: string; jumlah: number | null; perusahaan: string }
interface SolarOutEntry { id?: string; tanggal: string; jumlah: number | null; tujuan: string }

interface TabCatatanOperasionalProps {
    catatan: string;
    onCatatanChange: (v: string) => void;
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
        if (st === 'berasap') lines.push(`Bunker ${k.toUpperCase()} berasap`);
    }
    return lines;
}

// ─── Component ───

export default function TabCatatanOperasional({
    catatan,
    onCatatanChange,
}: TabCatatanOperasionalProps) {
    return (
        <div className="w-full max-w-3xl mx-auto">
            <Card title="Catatan Operasional" icon="sticky_note_2" color="amber">
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    Tulis catatan operasional bebas. Aktivitas{' '}
                    <span className="text-amber-300 font-semibold">solar</span>,{' '}
                    <span className="text-slate-300 font-semibold">unloading fly ash</span>, dan{' '}
                    <span className="text-amber-300 font-semibold">bunker berasap</span> akan
                    otomatis ditambahkan sebagai baris teks di bawah — bebas diedit, diatur ulang,
                    atau dihapus seperti catatan biasa.
                </p>
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
        </div>
    );
}
