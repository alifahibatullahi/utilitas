'use client';
import React, { useState } from 'react';
import { Card, InputField, Modal } from './SharedComponents';

export interface SolarEntry {
    id?: string;
    tanggal: string;
    jam?: string;
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

const EMPTY_SOLAR: SolarEntry = { tanggal: '', jam: '', jumlah: null, perusahaan: '' };
const EMPTY_OUT: OutSolarEntry = { tanggal: '', jam: '', jumlah: null, tujuan: 'Bengkel' };

function EntryList({ entries, savedEntries, accentColor, labelKey, valueKey, unitLabel, onRemove, onDeleteSaved }: {
    entries: (SolarEntry | OutSolarEntry)[];
    savedEntries: (SolarEntry | OutSolarEntry)[];
    accentColor: string;
    labelKey: 'perusahaan' | 'tujuan';
    valueKey: 'jumlah';
    unitLabel: string;
    onRemove: (idx: number) => void;
    onDeleteSaved?: (id: string) => void;
}) {
    const borderSaved = `border-${accentColor}-500/30`;
    const borderPending = `border-${accentColor}-500/20`;
    const textAccent = `text-${accentColor}-300`;
    const textAccentSm = `text-${accentColor}-400`;

    return (
        <div className="flex flex-col gap-2">
            {savedEntries.map((e) => (
                <div key={`saved-${e.id}`} className={`relative flex justify-between items-center px-3 py-2 bg-[#101822] border ${borderSaved} rounded-lg pr-10`}>
                    <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-mono font-bold ${textAccent}`}>{(e.jumlah || 0).toLocaleString('id-ID')} <span className={`text-[10px] ${textAccentSm}`}>{unitLabel}</span></span>
                        <span className="text-[10px] text-slate-400 truncate">{(e as any)[labelKey]}{e.jam ? ` · ${e.jam}` : ''}</span>
                    </div>
                    {e.id && onDeleteSaved && (
                        <button type="button" onClick={() => onDeleteSaved(e.id!)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                    )}
                </div>
            ))}
            {entries.map((e, idx) => (
                <div key={`pending-${idx}`} className={`relative flex justify-between items-center px-3 py-2 bg-[#101822]/60 border ${borderPending} rounded-lg pr-10`}>
                    <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-mono font-bold ${textAccent}`}>{(e.jumlah || 0).toLocaleString('id-ID')} <span className={`text-[10px] ${textAccentSm}`}>{unitLabel}</span></span>
                        <span className="text-[10px] text-slate-400 truncate">{(e as any)[labelKey]}{e.jam ? ` · ${e.jam}` : ''} <span className={`text-[9px] ${textAccentSm}`}>(baru)</span></span>
                    </div>
                    <button type="button" onClick={() => onRemove(idx)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                </div>
            ))}
        </div>
    );
}

function timeInput(value: string, prev: string, onChange: (v: string) => void) {
    return (
        <div className="space-y-1.5 w-full">
            <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Jam</label>
            <input
                type="text" inputMode="numeric" placeholder="00:00" maxLength={5}
                value={value}
                onChange={e => {
                    let v = e.target.value.replace(/[^0-9:]/g, '');
                    if (v.length === 2 && !v.includes(':') && prev.length < 2) v = v + ':';
                    onChange(v);
                }}
                className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-500 text-sm font-mono transition-all"
            />
        </div>
    );
}

export default function TabHandling({
    espValues = {}, tankyardValues = {},
    onEspChange, onTankyardChange,
    solarEntries = [], onSolarEntriesChange,
    outSolarEntries = [], onOutSolarEntriesChange,
    savedSolarEntries = [], savedOutSolarEntries = [],
    onDeleteSavedSolar, onDeleteSavedOutSolar,
}: TabHandlingProps) {
    const [showSolarModal, setShowSolarModal] = useState(false);
    const [showOutModal, setShowOutModal] = useState(false);
    const [solarForm, setSolarForm] = useState<SolarEntry>(EMPTY_SOLAR);
    const [outForm, setOutForm] = useState<OutSolarEntry>(EMPTY_OUT);
    const [tujuanMode, setTujuanMode] = useState<'Bengkel' | 'SA/SU 3B' | 'Lainnya'>('Bengkel');

    const saveSolar = () => {
        if (!solarForm.jam || !solarForm.jumlah || !solarForm.perusahaan) return;
        onSolarEntriesChange?.([...solarEntries, { ...solarForm, tanggal: solarForm.jam }]);
        setSolarForm(EMPTY_SOLAR);
        setShowSolarModal(false);
    };

    const saveOut = () => {
        if (!outForm.jam || !outForm.jumlah || !outForm.tujuan) return;
        onOutSolarEntriesChange?.([...outSolarEntries, { ...outForm, tanggal: outForm.jam }]);
        setOutForm(EMPTY_OUT);
        setTujuanMode('Bengkel');
        setShowOutModal(false);
    };

    const removeEntry = (idx: number) => onSolarEntriesChange?.(solarEntries.filter((_, i) => i !== idx));
    const removeOutEntry = (idx: number) => onOutSolarEntriesChange?.(outSolarEntries.filter((_, i) => i !== idx));

    const allInSolar = [...savedSolarEntries, ...solarEntries];
    const allOutSolar = [...savedOutSolarEntries, ...outSolarEntries];
    const totalInSolar = allInSolar.reduce((s, e) => s + (e.jumlah || 0), 0);
    const totalOutSolar = allOutSolar.reduce((s, e) => s + (e.jumlah || 0), 0);

    return (
        <>
            <div className="flex-1 w-full overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <Card title="Loading Batubara" icon="local_shipping" color="orange">
                        <InputField label="Total Loading" unit="shovel" color="orange" name="loading" value={espValues.loading} onChange={onEspChange} />
                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Hopper Aktif</label>
                            <select className={`w-full bg-[#101822] border border-slate-700/80 rounded-lg py-2.5 px-3 focus:ring-1 focus:ring-orange-500 text-sm font-bold transition-all ${!espValues.hopper ? 'text-slate-400' : 'text-white'}`}
                                value={(espValues.hopper as string) || ''} onChange={e => onEspChange?.('hopper', e.target.value || null)}>
                                <option value="" className="text-slate-400 bg-[#101822]">Pilih...</option>
                                <option value="A" className="text-white bg-[#101822] font-bold">Hopper A</option>
                                <option value="B" className="text-white bg-[#101822] font-bold">Hopper B</option>
                                <option value="AB" className="text-white bg-[#101822] font-bold">Hopper AB</option>
                            </select>
                        </div>
                        <div className="space-y-1.5 w-full">
                            <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Conveyor Status</label>
                            <select className={`w-full bg-[#101822] border border-slate-700/80 rounded-lg py-2.5 px-3 focus:ring-1 focus:ring-orange-500 text-sm font-bold transition-all ${!espValues.conveyor ? 'text-slate-400' : 'text-white'}`}
                                value={(espValues.conveyor as string) || ''} onChange={e => onEspChange?.('conveyor', e.target.value || null)}>
                                <option value="" className="text-slate-400 bg-[#101822]">Pilih...</option>
                                <option value="AB" className="text-white bg-[#101822] font-bold">Conveyor AB</option>
                                <option value="A" className="text-white bg-[#101822] font-bold">Conveyor A</option>
                                <option value="B" className="text-white bg-[#101822] font-bold">Conveyor B</option>
                            </select>
                        </div>
                    </Card>

                    <Card title="Tankyard" icon="water_drop" color="blue">
                        <InputField label="Level RCW" unit="m" color="blue" name="tk_rcw" value={tankyardValues.tk_rcw} onChange={onTankyardChange} />
                        <InputField label="Level Demin" unit="m" color="blue" name="tk_demin" value={tankyardValues.tk_demin} onChange={onTankyardChange} />
                        <InputField label="Level Tanki Solar" unit="m" color="blue" name="tk_solar_ab" value={tankyardValues.tk_solar_ab} onChange={onTankyardChange} />
                    </Card>

                    {/* Kedatangan Solar */}
                    <Card title="Kedatangan Solar" icon="download" color="amber">
                        {allInSolar.length > 0 && (
                            <div className="mb-1">
                                <EntryList
                                    entries={solarEntries} savedEntries={savedSolarEntries}
                                    accentColor="amber" labelKey="perusahaan" valueKey="jumlah" unitLabel="L"
                                    onRemove={removeEntry} onDeleteSaved={onDeleteSavedSolar}
                                />
                                <div className="flex justify-between items-center px-1 mt-2 mb-1">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total</span>
                                    <span className="text-sm font-mono font-bold text-amber-300">{totalInSolar.toLocaleString('id-ID')} L</span>
                                </div>
                                <div className="h-px bg-slate-700/40 mb-3" />
                            </div>
                        )}
                        <button type="button" onClick={() => setShowSolarModal(true)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-sm font-bold transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            Tambah Kedatangan
                        </button>
                    </Card>

                    {/* Permintaan Solar */}
                    <Card title="Permintaan Solar" icon="upload" color="rose">
                        {allOutSolar.length > 0 && (
                            <div className="mb-1">
                                <EntryList
                                    entries={outSolarEntries} savedEntries={savedOutSolarEntries}
                                    accentColor="rose" labelKey="tujuan" valueKey="jumlah" unitLabel="L"
                                    onRemove={removeOutEntry} onDeleteSaved={onDeleteSavedOutSolar}
                                />
                                <div className="flex justify-between items-center px-1 mt-2 mb-1">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total</span>
                                    <span className="text-sm font-mono font-bold text-rose-300">{totalOutSolar.toLocaleString('id-ID')} L</span>
                                </div>
                                <div className="h-px bg-slate-700/40 mb-3" />
                            </div>
                        )}
                        <button type="button" onClick={() => setShowOutModal(true)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-sm font-bold transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            Tambah Permintaan
                        </button>
                    </Card>

                </div>
            </div>

            {/* Modal Kedatangan Solar */}
            <Modal open={showSolarModal} onClose={() => { setShowSolarModal(false); setSolarForm(EMPTY_SOLAR); }} title="Kedatangan Solar" color="amber">
                {timeInput(solarForm.jam ?? '', solarForm.jam ?? '', v => setSolarForm({ ...solarForm, jam: v }))}
                <InputField label="Jumlah" unit="Liter" color="amber" name="solar_jumlah" value={solarForm.jumlah} thousands
                    onChange={(_, v) => setSolarForm({ ...solarForm, jumlah: typeof v === 'string' ? parseFloat(v) || null : v as number | null })} />
                <div className="space-y-1.5 w-full">
                    <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Perusahaan</label>
                    <input type="text" value={solarForm.perusahaan} onChange={e => setSolarForm({ ...solarForm, perusahaan: e.target.value })}
                        placeholder="Nama perusahaan..."
                        className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-500 text-sm transition-all" />
                </div>
                <button type="button" onClick={saveSolar} disabled={!solarForm.jam || !solarForm.jumlah || !solarForm.perusahaan}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm transition-colors mt-1">
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Simpan
                </button>
            </Modal>

            {/* Modal Permintaan Solar */}
            <Modal open={showOutModal} onClose={() => { setShowOutModal(false); setOutForm(EMPTY_OUT); setTujuanMode('Bengkel'); }} title="Permintaan Solar" color="rose">
                {timeInput(outForm.jam ?? '', outForm.jam ?? '', v => setOutForm({ ...outForm, jam: v }))}
                <InputField label="Jumlah" unit="Liter" color="rose" name="out_solar_jumlah" value={outForm.jumlah} thousands
                    onChange={(_, v) => setOutForm({ ...outForm, jumlah: typeof v === 'string' ? parseFloat(v) || null : v as number | null })} />
                <div className="space-y-1.5 w-full">
                    <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Tujuan Permintaan</label>
                    <select value={tujuanMode} onChange={e => {
                        const mode = e.target.value as typeof tujuanMode;
                        setTujuanMode(mode);
                        if (mode !== 'Lainnya') setOutForm({ ...outForm, tujuan: mode });
                        else setOutForm({ ...outForm, tujuan: '' });
                    }} className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white focus:ring-1 focus:ring-rose-500 text-sm transition-all">
                        <option value="Bengkel">Bengkel</option>
                        <option value="SA/SU 3B">SA/SU 3B</option>
                        <option value="Lainnya">Lainnya…</option>
                    </select>
                    {tujuanMode === 'Lainnya' && (
                        <input type="text" value={outForm.tujuan} onChange={e => setOutForm({ ...outForm, tujuan: e.target.value })}
                            placeholder="Tulis tujuan..." className="mt-2 w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-rose-500 text-sm transition-all" />
                    )}
                </div>
                <button type="button" onClick={saveOut} disabled={!outForm.jam || !outForm.jumlah || !outForm.tujuan}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors mt-1">
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Simpan
                </button>
            </Modal>
        </>
    );
}
