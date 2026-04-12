'use client';
import React from 'react';
import { Card, InputField, CalculatedField } from './SharedComponents';

export interface SolarEntry {
    id?: string;
    tanggal: string;  // kept for backward compat (date YYYY-MM-DD)
    jam?: string;     // HH:MM 24h
    jumlah: number | null;
    perusahaan: string;
}

export interface OutSolarEntry {
    id?: string;
    tanggal: string;
    jam?: string;
    jumlah: number | null;
    tujuan: string;
}

interface TabHandlingProps {
    espValues?: Record<string, number | string | null>;
    tankyardValues?: Record<string, number | string | null>;
    onEspChange?: (name: string, value: number | string | null) => void;
    onTankyardChange?: (name: string, value: number | string | null) => void;
    solarEntries?: SolarEntry[];
    onSolarEntriesChange?: (entries: SolarEntry[]) => void;
    outSolarEntries?: OutSolarEntry[];
    onOutSolarEntriesChange?: (entries: OutSolarEntry[]) => void;
    savedSolarEntries?: SolarEntry[];
    savedOutSolarEntries?: OutSolarEntry[];
    onDeleteSavedSolar?: (id: string) => void;
    onDeleteSavedOutSolar?: (id: string) => void;
}

export default function TabHandling({
    espValues = {}, tankyardValues = {},
    onEspChange, onTankyardChange,
    solarEntries = [], onSolarEntriesChange,
    outSolarEntries = [], onOutSolarEntriesChange,
    savedSolarEntries = [], savedOutSolarEntries = [],
    onDeleteSavedSolar, onDeleteSavedOutSolar
}: TabHandlingProps) {
    const [currentEntry, setCurrentEntry] = React.useState<SolarEntry>({ tanggal: '', jam: '', jumlah: null, perusahaan: '' });
    const [currentOutEntry, setCurrentOutEntry] = React.useState<OutSolarEntry>({ tanggal: '', jam: '', jumlah: null, tujuan: 'Bengkel' });
    const [tujuanMode, setTujuanMode] = React.useState<'Bengkel' | 'SA/SU 3B' | 'Lainnya'>('Bengkel');

    const addEntry = () => {
        if (!currentEntry.jam || !currentEntry.jumlah || !currentEntry.perusahaan) {
            alert('Lengkapi semua data kedatangan solar sebelum menambah.');
            return;
        }
        onSolarEntriesChange?.([...solarEntries, { ...currentEntry, tanggal: currentEntry.jam }]);
        setCurrentEntry({ tanggal: '', jam: '', jumlah: null, perusahaan: '' });
    };

    const removeEntry = (idx: number) => {
        const next = solarEntries.filter((_, i) => i !== idx);
        onSolarEntriesChange?.(next);
    };

    const addOutEntry = () => {
        if (!currentOutEntry.jam || !currentOutEntry.jumlah || !currentOutEntry.tujuan) {
            alert('Lengkapi semua data permintaan solar sebelum menambah.');
            return;
        }
        onOutSolarEntriesChange?.([...outSolarEntries, { ...currentOutEntry, tanggal: currentOutEntry.jam }]);
        setCurrentOutEntry({ tanggal: '', jam: '', jumlah: null, tujuan: 'Bengkel' });
        setTujuanMode('Bengkel');
    };

    const removeOutEntry = (idx: number) => {
        const next = outSolarEntries.filter((_, i) => i !== idx);
        onOutSolarEntriesChange?.(next);
    };

    const allInSolar = [...savedSolarEntries, ...solarEntries];
    const allOutSolar = [...savedOutSolarEntries, ...outSolarEntries];
    const totalInSolar = allInSolar.reduce((sum, e) => sum + (e.jumlah || 0), 0);
    const totalOutSolar = allOutSolar.reduce((sum, e) => sum + (e.jumlah || 0), 0);

    return (
        <>
            <div className="flex-1 w-full overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Loading Batubara" icon="local_shipping" color="orange">
                        <InputField label="Total Loading" unit="shovel" color="orange" name="loading" value={espValues.loading} onChange={onEspChange} />

                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-white uppercase tracking-wider block text-left text-xs">
                                Hopper Aktif
                            </label>
                            <select
                                className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-sm font-mono transition-all"
                                value={(espValues.hopper as string) || 'A'}
                                onChange={e => onEspChange?.('hopper', e.target.value)}
                                onFocus={() => { if (!espValues.hopper) onEspChange?.('hopper', 'A'); }}
                            >
                                <option value="A">Hopper A</option>
                                <option value="B">Hopper B</option>
                            </select>
                        </div>

                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-white uppercase tracking-wider block text-left text-xs">
                                Conveyor Status
                            </label>
                            <select
                                className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-sm font-mono transition-all"
                                value={(espValues.conveyor as string) || 'AB'}
                                onChange={e => onEspChange?.('conveyor', e.target.value)}
                                onFocus={() => { if (!espValues.conveyor) onEspChange?.('conveyor', 'AB'); }}
                            >
                                <option value="AB">Conveyor AB (1&amp;2)</option>
                                <option value="A">Conveyor A (1)</option>
                                <option value="B">Conveyor B (2)</option>
                            </select>
                        </div>
                    </Card>

                    <Card title="Tankyard" icon="water_drop" color="blue">
                        <InputField label="Level RCW" unit="m" color="blue" name="tk_rcw" value={tankyardValues.tk_rcw} onChange={onTankyardChange} />
                        <InputField label="Level Demin" unit="m" color="blue" name="tk_demin" value={tankyardValues.tk_demin} onChange={onTankyardChange} />
                        <InputField label="Level Tanki Solar" unit="m" color="blue" name="tk_solar_ab" value={tankyardValues.tk_solar_ab} onChange={onTankyardChange} />
                    </Card>

                    <Card title="Kedatangan Solar" icon="download" color="amber">
                        <div className="space-y-3 p-3 bg-[#101822]/30 border border-slate-700/50 rounded-lg">
                            <div className="space-y-1.5 w-full">
                                <label className="font-medium text-white uppercase tracking-wider block text-left text-xs">Jam Kedatangan</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="00:00"
                                    maxLength={5}
                                    value={currentEntry.jam ?? ''}
                                    onChange={e => {
                                        let v = e.target.value.replace(/[^0-9:]/g, '');
                                        if (v.length === 2 && !v.includes(':') && (currentEntry.jam ?? '').length < 2) v = v + ':';
                                        setCurrentEntry({ ...currentEntry, jam: v });
                                    }}
                                    className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-sm font-mono transition-all"
                                />
                            </div>
                            <InputField label="Jumlah" unit="Liter" color="amber" name="solar_jumlah" value={currentEntry.jumlah} thousands
                                onChange={(_, v) => setCurrentEntry({...currentEntry, jumlah: typeof v === 'string' ? (v === '' ? null : parseFloat(v) ?? null) : v as number | null})} />
                            <div className="space-y-1.5 w-full">
                                <label className="font-medium text-white uppercase tracking-wider block text-left text-xs">Perusahaan</label>
                                <input type="text" value={currentEntry.perusahaan} onChange={e => setCurrentEntry({...currentEntry, perusahaan: e.target.value})}
                                    placeholder="Nama perusahaan..."
                                    className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-sm transition-all" />
                            </div>
                            <button type="button" onClick={addEntry}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-colors mt-2">
                                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                TAMBAH KEDATANGAN
                            </button>
                        </div>
                        {solarEntries.length > 0 && (
                            <div className="space-y-2 mt-3">
                                {solarEntries.map((entry, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-[#101822] border border-amber-500/30 rounded-lg shadow-inner">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-mono text-white font-bold">{entry.jumlah?.toLocaleString('id-ID')} <span className="text-xs text-amber-400 font-medium">L</span></span>
                                            <span className="text-xs text-slate-400 mt-0.5">{entry.perusahaan}</span>
                                        </div>
                                        <button type="button" onClick={() => removeEntry(idx)} className="w-8 h-8 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card title="Permintaan Solar" icon="upload" color="rose">
                        <div className="space-y-3 p-3 bg-[#101822]/30 border border-slate-700/50 rounded-lg">
                            <div className="space-y-1.5 w-full">
                                <label className="font-medium text-white uppercase tracking-wider block text-left text-xs">Jam Permintaan</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="00:00"
                                    maxLength={5}
                                    value={currentOutEntry.jam ?? ''}
                                    onChange={e => {
                                        let v = e.target.value.replace(/[^0-9:]/g, '');
                                        if (v.length === 2 && !v.includes(':') && (currentOutEntry.jam ?? '').length < 2) v = v + ':';
                                        setCurrentOutEntry({ ...currentOutEntry, jam: v });
                                    }}
                                    className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm font-mono transition-all"
                                />
                            </div>
                            <InputField label="Jumlah" unit="Liter" color="rose" name="out_solar_jumlah" value={currentOutEntry.jumlah} thousands
                                onChange={(_, v) => setCurrentOutEntry({...currentOutEntry, jumlah: typeof v === 'string' ? (v === '' ? null : parseFloat(v) ?? null) : v as number | null})} />
                            <div className="space-y-1.5 w-full">
                                <label className="font-medium text-white uppercase tracking-wider block text-left text-xs">Tujuan Permintaan</label>
                                <select
                                    value={tujuanMode}
                                    onChange={e => {
                                        const mode = e.target.value as typeof tujuanMode;
                                        setTujuanMode(mode);
                                        if (mode !== 'Lainnya') setCurrentOutEntry({ ...currentOutEntry, tujuan: mode });
                                        else setCurrentOutEntry({ ...currentOutEntry, tujuan: '' });
                                    }}
                                    className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm transition-all"
                                >
                                    <option value="Bengkel">Bengkel</option>
                                    <option value="SA/SU 3B">SA/SU 3B</option>
                                    <option value="Lainnya">Lainnya…</option>
                                </select>
                                {tujuanMode === 'Lainnya' && (
                                    <input type="text" value={currentOutEntry.tujuan} onChange={e => setCurrentOutEntry({ ...currentOutEntry, tujuan: e.target.value })}
                                        placeholder="Tulis tujuan permintaan..."
                                        className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm transition-all mt-2" />
                                )}
                            </div>
                            <button type="button" onClick={addOutEntry}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-rose-500/50 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-colors mt-2">
                                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                TAMBAH PERMINTAAN
                            </button>
                        </div>
                        {outSolarEntries.length > 0 && (
                            <div className="space-y-2 mt-3">
                                {outSolarEntries.map((entry, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-[#101822] border border-rose-500/30 rounded-lg shadow-inner">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-mono text-white font-bold">{entry.jumlah?.toLocaleString('id-ID')} <span className="text-xs text-rose-400 font-medium">L</span></span>
                                            <span className="text-xs text-slate-400 mt-0.5">{entry.tujuan}</span>
                                        </div>
                                        <button type="button" onClick={() => removeOutEntry(idx)} className="w-8 h-8 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                </div>
            </div>
            
            <div className="w-full xl:w-[240px] shrink-0 h-full flex flex-col">
                <Card title="Summary Solar" icon="assessment" color="amber" isSidebar={true}>
                    <CalculatedField label="TOTAL KEDATANGAN" value={totalInSolar.toLocaleString('id-ID')} unit="Liter" variant="amber" />
                    {allInSolar.length > 0 && (
                        <div className="flex flex-col gap-1 mt-2">
                            {savedSolarEntries.map((e) => (
                                <div key={`saved-${e.id}`} className="relative flex justify-between items-center px-2 py-1.5 bg-amber-900/10 border border-amber-500/30 rounded-lg pr-8">
                                    <span className="text-[11px] text-slate-400 truncate max-w-[110px]">{e.perusahaan || '—'}</span>
                                    <span className="text-[11px] font-mono font-bold text-amber-300 whitespace-nowrap ml-1">{(e.jumlah || 0).toLocaleString('id-ID')} L</span>
                                    {e.id && onDeleteSavedSolar && (
                                        <button type="button" onClick={() => onDeleteSavedSolar(e.id!)}
                                            className="absolute top-1/2 -translate-y-1/2 right-1 w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                            {solarEntries.map((e, idx) => (
                                <div key={`pending-${idx}`} className="relative flex justify-between items-center px-2 py-1.5 bg-[#101822]/50 border border-amber-500/20 rounded-lg pr-8">
                                    <span className="text-[11px] text-slate-400 truncate max-w-[110px]">{e.perusahaan || '—'}{e.jam ? ` · ${e.jam}` : ''} <span className="text-[9px] text-amber-500">(new)</span></span>
                                    <span className="text-[11px] font-mono font-bold text-amber-300 whitespace-nowrap ml-1">{(e.jumlah || 0).toLocaleString('id-ID')} L</span>
                                    <button type="button" onClick={() => removeEntry(idx)}
                                        className="absolute top-1/2 -translate-y-1/2 right-1 w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="h-px bg-slate-700/80 w-full my-3"></div>

                    <CalculatedField label="TOTAL PERMINTAAN" value={totalOutSolar.toLocaleString('id-ID')} unit="Liter" variant="rose" />
                    {allOutSolar.length > 0 && (
                        <div className="flex flex-col gap-1 mt-2">
                            {savedOutSolarEntries.map((e) => (
                                <div key={`saved-${e.id}`} className="relative flex justify-between items-center px-2 py-1.5 bg-rose-900/10 border border-rose-500/30 rounded-lg pr-8">
                                    <span className="text-[11px] text-slate-400 truncate max-w-[110px]">{e.tujuan || '—'}</span>
                                    <span className="text-[11px] font-mono font-bold text-rose-300 whitespace-nowrap ml-1">{(e.jumlah || 0).toLocaleString('id-ID')} L</span>
                                    {e.id && onDeleteSavedOutSolar && (
                                        <button type="button" onClick={() => onDeleteSavedOutSolar(e.id!)}
                                            className="absolute top-1/2 -translate-y-1/2 right-1 w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                            {outSolarEntries.map((e, idx) => (
                                <div key={`pending-${idx}`} className="relative flex justify-between items-center px-2 py-1.5 bg-[#101822]/50 border border-rose-500/20 rounded-lg pr-8">
                                    <span className="text-[11px] text-slate-400 truncate max-w-[110px]">{e.tujuan || '—'}{e.jam ? ` · ${e.jam}` : ''} <span className="text-[9px] text-rose-500">(new)</span></span>
                                    <span className="text-[11px] font-mono font-bold text-rose-300 whitespace-nowrap ml-1">{(e.jumlah || 0).toLocaleString('id-ID')} L</span>
                                    <button type="button" onClick={() => removeOutEntry(idx)}
                                        className="absolute top-1/2 -translate-y-1/2 right-1 w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}
