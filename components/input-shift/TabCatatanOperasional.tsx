'use client';
import React from 'react';
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
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    running:     { label: 'Running',     color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
    standby:     { label: 'Standby',     color: 'bg-slate-500/15 text-slate-300 border-slate-500/40' },
    maintenance: { label: 'Maintenance', color: 'bg-blue-500/15 text-blue-300 border-blue-500/40' },
    berasap:     { label: 'Berasap',     color: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
    shutdown:    { label: 'Shutdown',    color: 'bg-rose-500/15 text-rose-300 border-rose-500/40' },
};

function statusBadge(value: string) {
    const def = STATUS_LABEL[value] ?? { label: value || '-', color: 'bg-slate-700/30 text-slate-400 border-slate-700/40' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${def.color}`}>{def.label}</span>;
}

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
    const solarIn = [...savedSolarEntries, ...solarEntries].filter(e => e.jumlah && e.perusahaan);
    const solarOut = [...savedOutSolarEntries, ...outSolarEntries].filter(e => e.jumlah && e.tujuan);
    const ash = [...savedAshEntries, ...ashEntries].filter(e => e.silo && e.ritase);
    const ashA = ash.filter(e => e.silo === 'A');
    const ashB = ash.filter(e => e.silo === 'B');

    const bunkerWithIssue = BUNKER_KEYS
        .map(k => ({ key: k, status: String(coalBunker[`status_bunker_${k}`] ?? 'running') }))
        .filter(b => b.status && b.status !== 'running');

    return (
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* === Kolom kiri: auto sections === */}
            <div className="flex flex-col gap-6">
                {/* Solar */}
                <Card title="Aktivitas Solar" icon="local_gas_station" color="amber">
                    {/* Kedatangan */}
                    <div>
                        <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2">Kedatangan</div>
                        {solarIn.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic">Tidak ada kedatangan solar</p>
                        ) : (
                            <ul className="space-y-1.5">
                                {solarIn.map((e, i) => (
                                    <li key={i} className="flex items-center gap-2 text-[11px] text-slate-200">
                                        <span className="material-symbols-outlined text-amber-400 text-[14px]">arrow_downward</span>
                                        <span className="font-mono font-bold text-amber-200">{(e.jumlah ?? 0).toLocaleString('id-ID')} L</span>
                                        <span className="text-slate-400">dari</span>
                                        <span className="font-semibold">{e.perusahaan}</span>
                                        <span className="text-slate-500 text-[10px]">({e.tanggal})</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {/* Permintaan / pemakaian */}
                    <div className="pt-3 mt-3 border-t border-slate-700/40">
                        <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2">Permintaan / Pemakaian</div>
                        {solarOut.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic">Tidak ada permintaan solar</p>
                        ) : (
                            <ul className="space-y-1.5">
                                {solarOut.map((e, i) => (
                                    <li key={i} className="flex items-center gap-2 text-[11px] text-slate-200">
                                        <span className="material-symbols-outlined text-orange-400 text-[14px]">arrow_upward</span>
                                        <span className="font-mono font-bold text-orange-200">{(e.jumlah ?? 0).toLocaleString('id-ID')} L</span>
                                        <span className="text-slate-400">ke</span>
                                        <span className="font-semibold">{e.tujuan}</span>
                                        <span className="text-slate-500 text-[10px]">({e.tanggal})</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </Card>

                {/* Fly Ash */}
                <Card title="Unloading Fly Ash" icon="ac_unit" color="slate">
                    {ash.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">Tidak ada unloading fly ash</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Silo A</div>
                                {ashA.length === 0 ? (
                                    <p className="text-[11px] text-slate-500 italic">—</p>
                                ) : (
                                    <ul className="space-y-1">
                                        {ashA.map((e, i) => (
                                            <li key={i} className="text-[11px] text-slate-200 flex items-center gap-1.5">
                                                <span className="font-mono font-bold text-slate-200">{e.ritase}× </span>
                                                <span className="text-slate-400">→</span>
                                                <span className="text-slate-300">{e.tujuan || '-'}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Silo B</div>
                                {ashB.length === 0 ? (
                                    <p className="text-[11px] text-slate-500 italic">—</p>
                                ) : (
                                    <ul className="space-y-1">
                                        {ashB.map((e, i) => (
                                            <li key={i} className="text-[11px] text-slate-200 flex items-center gap-1.5">
                                                <span className="font-mono font-bold text-slate-200">{e.ritase}× </span>
                                                <span className="text-slate-400">→</span>
                                                <span className="text-slate-300">{e.tujuan || '-'}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </Card>

                {/* Bunker Status */}
                <Card title="Status Bunker" icon="inventory_2" color="indigo">
                    {bunkerWithIssue.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">Semua bunker dalam status Running.</p>
                    ) : (
                        <ul className="space-y-1.5">
                            {bunkerWithIssue.map(b => (
                                <li key={b.key} className="flex items-center gap-2 text-[11px]">
                                    <span className="font-mono font-bold text-indigo-300 uppercase">Bunker {b.key.toUpperCase()}</span>
                                    <span className="text-slate-500">·</span>
                                    {statusBadge(b.status)}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            {/* === Kolom kanan: catatan textarea === */}
            <div className="flex flex-col">
                <Card title="Catatan Lain" icon="edit_note" color="amber">
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                        Catatan operasional lain yang perlu disampaikan ke shift berikutnya / supervisor.
                        Solar, fly ash, dan status bunker sudah otomatis tercatat dari tab masing-masing.
                    </p>
                    <textarea
                        value={catatan}
                        onChange={e => onCatatanChange(e.target.value)}
                        placeholder="Tulis catatan operasional di sini..."
                        rows={14}
                        className="w-full bg-[#0e1621] border border-slate-700/60 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none resize-y placeholder:text-slate-600 leading-relaxed"
                    />
                </Card>
            </div>
        </div>
    );
}
