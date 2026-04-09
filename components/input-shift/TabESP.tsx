'use client';
import React, { useState } from 'react';
import { Card, InputField, SelectField, CalculatedField } from './SharedComponents';

export interface AshUnloadingEntry {
    id?: string;
    silo: 'A' | 'B' | '';
    perusahaan: string;
    tujuan: string;
    ritase: number | null;
}

interface TabESPProps {
    values?: Record<string, number | string | null>;
    onFieldChange?: (name: string, value: number | string | null) => void;
    ashEntries?: AshUnloadingEntry[];
    onAshEntriesChange?: (entries: AshUnloadingEntry[]) => void;
    savedAshEntries?: AshUnloadingEntry[];
    onDeleteSavedAsh?: (id: string) => void;
}

export default function TabESP({ values = {}, onFieldChange, ashEntries = [], onAshEntriesChange, savedAshEntries = [], onDeleteSavedAsh }: TabESPProps) {
    const [currentEntry, setCurrentEntry] = useState<AshUnloadingEntry>({ silo: '', perusahaan: '', tujuan: '', ritase: null });

    const addEntry = () => {
        if (!currentEntry.silo || !currentEntry.perusahaan || !currentEntry.tujuan || !currentEntry.ritase) {
            alert('Lengkapi semua data unloading ash sebelum menambah.');
            return;
        }
        onAshEntriesChange?.([...ashEntries, currentEntry as AshUnloadingEntry]);
        setCurrentEntry({ silo: '', perusahaan: '', tujuan: '', ritase: null });
    };

    const removeEntry = (idx: number) => {
        const next = ashEntries.filter((_, i) => i !== idx);
        onAshEntriesChange?.(next);
    };

    const allAshEntries = [...savedAshEntries, ...ashEntries.filter(e => e.silo && e.perusahaan)];
    const totalAshSiloA = allAshEntries.filter(e => e.silo === 'A').reduce((sum, e) => sum + (e.ritase || 0), 0);
    const totalAshSiloB = allAshEntries.filter(e => e.silo === 'B').reduce((sum, e) => sum + (e.ritase || 0), 0);

    return (
        <>
        <div className="flex-1 w-full overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">

                <Card title="Trafo A" icon="electrical_services" color="blue">
                    <div className="flex flex-col gap-3">
                        <InputField label="A1" unit="kV" color="blue" name="esp_a1" value={values.esp_a1} onChange={onFieldChange} />
                        <InputField label="A2" unit="kV" color="blue" name="esp_a2" value={values.esp_a2} onChange={onFieldChange} />
                        <InputField label="A3" unit="kV" color="blue" name="esp_a3" value={values.esp_a3} onChange={onFieldChange} />
                    </div>
                </Card>

                <Card title="Trafo B" icon="electrical_services" color="cyan">
                    <div className="flex flex-col gap-3">
                        <InputField label="B1" unit="kV" color="cyan" name="esp_b1" value={values.esp_b1} onChange={onFieldChange} />
                        <InputField label="B2" unit="kV" color="cyan" name="esp_b2" value={values.esp_b2} onChange={onFieldChange} />
                        <InputField label="B3" unit="kV" color="cyan" name="esp_b3" value={values.esp_b3} onChange={onFieldChange} />
                    </div>
                </Card>

                <Card title="Ash Silo" icon="inventory_2" color="emerald">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Level Silo A" unit="%" color="emerald" name="silo_a" value={values.silo_a} onChange={onFieldChange} />
                        <InputField label="Level Silo B" unit="%" color="emerald" name="silo_b" value={values.silo_b} onChange={onFieldChange} />
                    </div>
                </Card>

                <Card title="Input Unloading Fly Ash" icon="local_shipping" color="orange">
                    <div className="space-y-4">
                        {/* Input Form */}
                        <div className="space-y-3 p-3 bg-[#101822]/30 border border-slate-700/50 rounded-lg">
                            <p className="text-xs font-bold text-orange-500 uppercase tracking-wider">Form Unloading</p>
                            
                            <SelectField
                                label="Sumber Silo"
                                color="orange"
                                value={currentEntry.silo}
                                onChange={(_, v) => setCurrentEntry({...currentEntry, silo: v as 'A' | 'B'})}
                                options={[{value: 'A', label: 'Silo A'}, {value: 'B', label: 'Silo B'}]}
                                placeholder="Pilih Silo..."
                            />
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5 w-full">
                                    <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-xs">Perusahaan</label>
                                    <input type="text" value={currentEntry.perusahaan} onChange={e => setCurrentEntry({...currentEntry, perusahaan: e.target.value})} placeholder="Nama PT..." className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-sm transition-all" />
                                </div>
                                <div className="space-y-1.5 w-full">
                                    <label className="font-medium text-[#92a9c9] uppercase tracking-wider block text-left text-xs">Tujuan</label>
                                    <input type="text" value={currentEntry.tujuan} onChange={e => setCurrentEntry({...currentEntry, tujuan: e.target.value})} placeholder="Lokasi tujuan..." className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-sm transition-all" />
                                </div>
                            </div>

                            <InputField label="Jumlah Ritase" unit="Rit" color="orange" value={currentEntry.ritase} onChange={(_, v) => setCurrentEntry({...currentEntry, ritase: typeof v === 'string' ? parseFloat(v) || null : v})} />
                            
                            <button type="button" onClick={addEntry} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-orange-500/50 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-xs font-bold transition-colors mt-2">
                                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                TAMBAH AKTIVITAS
                            </button>
                        </div>

                    </div>
                </Card>

            </div>
        </div>
        
        <div className="w-full xl:w-[240px] shrink-0 h-full flex flex-col">
            <Card title="Unloading Fly Ash" icon="assessment" color="emerald" isSidebar={true}>
                <CalculatedField label="TOTAL SILO A" value={totalAshSiloA.toLocaleString('id-ID')} unit="Rit" variant="primary" />
                <CalculatedField label="TOTAL SILO B" value={totalAshSiloB.toLocaleString('id-ID')} unit="Rit" variant="transparent" />

                {allAshEntries.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                        {/* Saved entries (dari DB) */}
                        {savedAshEntries.map((e) => (
                            <div key={`saved-${e.id}`} className="relative flex flex-col px-2 py-1.5 bg-emerald-900/10 border border-emerald-500/30 rounded-lg pr-8">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-emerald-300">Silo {e.silo}</span>
                                    <span className="text-xs font-mono font-black text-emerald-200">{e.ritase} Rit</span>
                                </div>
                                <span className="text-[10px] text-slate-400 truncate"><span className="text-slate-600">PT:</span> {e.perusahaan}</span>
                                <span className="text-[10px] text-slate-400 truncate"><span className="text-slate-600">Tujuan:</span> {e.tujuan}</span>
                                {e.id && onDeleteSavedAsh && (
                                    <button type="button" onClick={() => onDeleteSavedAsh(e.id!)}
                                        className="absolute top-1 right-1 w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                )}
                            </div>
                        ))}
                        {/* Pending entries (belum disimpan) */}
                        {ashEntries.map((e, idx) => (
                            <div key={`pending-${idx}`} className="relative flex flex-col px-2 py-1.5 bg-[#101822]/50 border border-amber-500/30 rounded-lg pr-8">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-amber-300">Silo {e.silo} <span className="text-[9px] text-amber-500">(pending)</span></span>
                                    <span className="text-xs font-mono font-black text-amber-200">{e.ritase} Rit</span>
                                </div>
                                <span className="text-[10px] text-slate-400 truncate"><span className="text-slate-600">PT:</span> {e.perusahaan}</span>
                                <span className="text-[10px] text-slate-400 truncate"><span className="text-slate-600">Tujuan:</span> {e.tujuan}</span>
                                <button type="button" onClick={() => removeEntry(idx)}
                                    className="absolute top-1 right-1 w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors">
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
