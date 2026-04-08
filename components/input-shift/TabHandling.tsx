'use client';
import React from 'react';
import { Card, InputField, CalculatedField } from './SharedComponents';

export interface SolarEntry {
    tanggal: string;
    jumlah: number | null;
    perusahaan: string;
}

export interface OutSolarEntry {
    tanggal: string;
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
}

export default function TabHandling({
    espValues = {}, tankyardValues = {},
    onEspChange, onTankyardChange,
    solarEntries = [], onSolarEntriesChange,
    outSolarEntries = [], onOutSolarEntriesChange,
    savedSolarEntries = [], savedOutSolarEntries = []
}: TabHandlingProps) {
    const [currentEntry, setCurrentEntry] = React.useState<SolarEntry>({ tanggal: '', jumlah: null, perusahaan: '' });
    const [currentOutEntry, setCurrentOutEntry] = React.useState<OutSolarEntry>({ tanggal: '', jumlah: null, tujuan: '' });

    const addEntry = () => {
        if (!currentEntry.tanggal || !currentEntry.jumlah || !currentEntry.perusahaan) {
            alert('Lengkapi semua data kedatangan solar sebelum menambah.');
            return;
        }
        onSolarEntriesChange?.([...solarEntries, currentEntry]);
        setCurrentEntry({ tanggal: '', jumlah: null, perusahaan: '' });
    };

    const removeEntry = (idx: number) => {
        const next = solarEntries.filter((_, i) => i !== idx);
        onSolarEntriesChange?.(next);
    };

    const addOutEntry = () => {
        if (!currentOutEntry.tanggal || !currentOutEntry.jumlah || !currentOutEntry.tujuan) {
            alert('Lengkapi semua data pemakaian solar sebelum menambah.');
            return;
        }
        onOutSolarEntriesChange?.([...outSolarEntries, currentOutEntry]);
        setCurrentOutEntry({ tanggal: '', jumlah: null, tujuan: '' });
    };

    const removeOutEntry = (idx: number) => {
        const next = outSolarEntries.filter((_, i) => i !== idx);
        onOutSolarEntriesChange?.(next);
    };

    const totalInSolar = savedSolarEntries.reduce((sum, e) => sum + (e.jumlah || 0), 0);
    const totalOutSolar = savedOutSolarEntries.reduce((sum, e) => sum + (e.jumlah || 0), 0);

    return (
        <>
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Loading Batubara" icon="local_shipping" color="orange">
                        <InputField label="Total Loading" unit="shovel" color="orange" name="loading" value={espValues.loading} onChange={onEspChange} />

                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-xs">
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
                            <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-xs">
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

                    <Card title="Aktivitas Solar" icon="local_gas_station" color="amber">
                        <div className="space-y-6">
                            {/* Kedatangan Solar */}
                            <div className="space-y-4">
                                <div className="space-y-3 p-3 bg-[#101822]/30 border border-slate-700/50 rounded-lg">
                                    <p className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[16px]">download</span> Kedatangan (In)
                                    </p>
                                    <div className="space-y-1.5 w-full">
                                        <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-xs">
                                            Tanggal & Waktu
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={currentEntry.tanggal}
                                            onChange={e => setCurrentEntry({...currentEntry, tanggal: e.target.value})}
                                            className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-sm font-mono transition-all [color-scheme:dark]"
                                        />
                                    </div>
                                    <InputField
                                        label="Jumlah"
                                        unit="Liter"
                                        color="amber"
                                        name="solar_jumlah"
                                        value={currentEntry.jumlah}
                                        onChange={(_, v) => setCurrentEntry({...currentEntry, jumlah: typeof v === 'string' ? (v === '' ? null : parseFloat(v) ?? null) : v as number | null})}
                                    />
                                    <div className="space-y-1.5 w-full">
                                        <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-xs">
                                            Perusahaan Pengirim
                                        </label>
                                        <input
                                            type="text"
                                            value={currentEntry.perusahaan}
                                            onChange={e => setCurrentEntry({...currentEntry, perusahaan: e.target.value})}
                                            placeholder="Nama perusahaan..."
                                            className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-sm transition-all"
                                        />
                                    </div>
                                    
                                    <button
                                        type="button"
                                        onClick={addEntry}
                                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-colors mt-2"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                        TAMBAH IN SOLAR
                                    </button>
                                </div>

                                {solarEntries.length > 0 && (
                                    <div className="space-y-2 mt-2">
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
                            </div>

                            {/* Pemakaian Solar */}
                            <div className="space-y-4">
                                <div className="space-y-3 p-3 bg-[#101822]/30 border border-slate-700/50 rounded-lg">
                                    <p className="text-xs font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[16px]">upload</span> Pemakaian (Out)
                                    </p>
                                    <div className="space-y-1.5 w-full">
                                        <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-xs">
                                            Tanggal & Waktu
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={currentOutEntry.tanggal}
                                            onChange={e => setCurrentOutEntry({...currentOutEntry, tanggal: e.target.value})}
                                            className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm font-mono transition-all [color-scheme:dark]"
                                        />
                                    </div>
                                    <InputField
                                        label="Jumlah"
                                        unit="Liter"
                                        color="rose"
                                        name="out_solar_jumlah"
                                        value={currentOutEntry.jumlah}
                                        onChange={(_, v) => setCurrentOutEntry({...currentOutEntry, jumlah: typeof v === 'string' ? (v === '' ? null : parseFloat(v) ?? null) : v as number | null})}
                                    />
                                    <div className="space-y-1.5 w-full">
                                        <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-xs">
                                            Tujuan Pemakaian
                                        </label>
                                        <input
                                            type="text"
                                            value={currentOutEntry.tujuan}
                                            onChange={e => setCurrentOutEntry({...currentOutEntry, tujuan: e.target.value})}
                                            placeholder="Cth: Boiler A, Alat Berat..."
                                            className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm transition-all"
                                        />
                                    </div>
                                    
                                    <button
                                        type="button"
                                        onClick={addOutEntry}
                                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-rose-500/50 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-colors mt-2"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                        TAMBAH OUT SOLAR
                                    </button>
                                </div>

                                {outSolarEntries.length > 0 && (
                                    <div className="space-y-2 mt-2">
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
                            </div>
                        </div>
                    </Card>

                </div>
            </div>
            
            <div className="w-full xl:w-[240px] shrink-0 h-full flex flex-col">
                <Card title="Summary Solar" icon="assessment" color="amber" isSidebar={true}>
                    <CalculatedField label="Total In Solar" value={totalInSolar.toLocaleString('id-ID')} unit="L" variant="primary" size="large" />
                    <CalculatedField label="Total Out Solar" value={totalOutSolar.toLocaleString('id-ID')} unit="L" variant="secondary" size="large" />
                    
                    <div className="h-px bg-slate-700/80 w-full my-1"></div>
                    
                    <CalculatedField label="Selisih (In - Out)" value={(totalInSolar - totalOutSolar).toLocaleString('id-ID')} unit="L" variant="purple" size="large" />
                </Card>
            </div>
        </>
    );
}
