'use client';
import React, { useState } from 'react';
import { Card, InputField, SelectField, CalculatedField, Modal } from './SharedComponents';

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

const EMPTY_ASH: AshUnloadingEntry = { silo: '', perusahaan: '', tujuan: '', ritase: null };

export default function TabESP({ values = {}, onFieldChange, ashEntries = [], onAshEntriesChange, savedAshEntries = [], onDeleteSavedAsh }: TabESPProps) {
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState<AshUnloadingEntry>(EMPTY_ASH);

    const saveEntry = () => {
        if (!form.silo || !form.perusahaan || !form.tujuan || !form.ritase) return;
        onAshEntriesChange?.([...ashEntries, form as AshUnloadingEntry]);
        setForm(EMPTY_ASH);
        setShowModal(false);
    };

    const removeEntry = (idx: number) => onAshEntriesChange?.(ashEntries.filter((_, i) => i !== idx));

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

                    <Card title="Unloading Fly Ash" icon="local_shipping" color="orange">
                        {allAshEntries.length > 0 && (
                            <div className="mb-1 flex flex-col gap-2">
                                {savedAshEntries.map((e) => (
                                    <div key={`saved-${e.id}`} className="relative flex justify-between items-start px-3 py-2 bg-[#101822] border border-orange-500/30 rounded-lg pr-10">
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-orange-300 bg-orange-500/15 px-1.5 py-0.5 rounded">Silo {e.silo}</span>
                                                <span className="text-xs font-mono font-bold text-white">{e.ritase} <span className="text-[10px] text-orange-400">Rit</span></span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 truncate mt-0.5">{e.perusahaan}</span>
                                            <span className="text-[10px] text-slate-500 truncate">{e.tujuan}</span>
                                        </div>
                                        {e.id && onDeleteSavedAsh && (
                                            <button type="button" onClick={() => onDeleteSavedAsh(e.id!)}
                                                className="absolute right-1.5 top-2 w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 flex items-center justify-center transition-colors">
                                                <span className="material-symbols-outlined text-[15px]">delete</span>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {ashEntries.filter(e => e.silo && e.perusahaan).map((e, idx) => (
                                    <div key={`pending-${idx}`} className="relative flex justify-between items-start px-3 py-2 bg-[#101822]/60 border border-amber-500/25 rounded-lg pr-10">
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded">Silo {e.silo}</span>
                                                <span className="text-xs font-mono font-bold text-white">{e.ritase} <span className="text-[10px] text-amber-400">Rit</span></span>
                                                <span className="text-[9px] text-amber-500">(baru)</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 truncate mt-0.5">{e.perusahaan}</span>
                                            <span className="text-[10px] text-slate-500 truncate">{e.tujuan}</span>
                                        </div>
                                        <button type="button" onClick={() => removeEntry(idx)}
                                            className="absolute right-1.5 top-2 w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 flex items-center justify-center transition-colors">
                                            <span className="material-symbols-outlined text-[15px]">delete</span>
                                        </button>
                                    </div>
                                ))}
                                <div className="h-px bg-slate-700/40 mt-1 mb-2" />
                            </div>
                        )}
                        <button type="button" onClick={() => setShowModal(true)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-sm font-bold transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            Tambah Unloading
                        </button>
                    </Card>

                </div>
            </div>

            <div className="w-full xl:w-[240px] shrink-0 h-full flex flex-col">
                <Card title="Summary Fly Ash" icon="assessment" color="emerald" isSidebar={true}>
                    <CalculatedField label="TOTAL SILO A" value={totalAshSiloA.toLocaleString('id-ID')} unit="Rit" variant="primary" />
                    <CalculatedField label="TOTAL SILO B" value={totalAshSiloB.toLocaleString('id-ID')} unit="Rit" variant="transparent" />
                </Card>
            </div>

            {/* Modal Unloading Fly Ash */}
            <Modal open={showModal} onClose={() => { setShowModal(false); setForm(EMPTY_ASH); }} title="Tambah Unloading Fly Ash" color="orange">
                <SelectField
                    label="Sumber Silo" color="orange"
                    value={form.silo}
                    onChange={(_, v) => setForm({ ...form, silo: v as 'A' | 'B' })}
                    options={[{ value: 'A', label: 'Silo A' }, { value: 'B', label: 'Silo B' }]}
                    placeholder="Pilih Silo..."
                />
                <div className="space-y-1.5 w-full">
                    <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Perusahaan</label>
                    <input type="text" value={form.perusahaan} onChange={e => setForm({ ...form, perusahaan: e.target.value })}
                        placeholder="Nama PT..."
                        className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-orange-500 text-sm transition-all" />
                </div>
                <div className="space-y-1.5 w-full">
                    <label className="font-medium text-white uppercase tracking-wider block text-left text-[10px]">Tujuan</label>
                    <input type="text" value={form.tujuan} onChange={e => setForm({ ...form, tujuan: e.target.value })}
                        placeholder="Lokasi tujuan..."
                        className="w-full bg-[#101822]/50 border border-slate-700/80 rounded-lg py-2.5 px-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-orange-500 text-sm transition-all" />
                </div>
                <InputField label="Jumlah Ritase" unit="Rit" color="orange"
                    value={form.ritase}
                    onChange={(_, v) => setForm({ ...form, ritase: typeof v === 'string' ? parseFloat(v) || null : v })} />
                <button type="button" onClick={saveEntry} disabled={!form.silo || !form.perusahaan || !form.tujuan || !form.ritase}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm transition-colors mt-1">
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Simpan
                </button>
            </Modal>
        </>
    );
}
