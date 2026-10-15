'use client';
import React, { useState } from 'react';
import { Card, InputField, Modal, SectionLabel } from './SharedComponents';
import { TON_PER_SHOVEL, formatTon, labelAsalKedatangan, labelZonaPendek } from '@/lib/coal-storage';
import CoalArrivalModal, { ZONA_OPTIONS, isBarisPenutup, type CoalArrivalEntry, type OpenArrival } from './CoalArrivalModal';

// Tipe & aturan kedatangan tinggal di CoalArrivalModal (dipakai juga review harian);
// diekspor ulang supaya pemanggil lama tidak perlu tahu.
export { isBarisPenutup, isKedatanganLengkap, type CoalArrivalEntry, type OpenArrival } from './CoalArrivalModal';

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

function isiBarisKedatangan(e: CoalArrivalEntry): { utama: React.ReactNode; sub: string } {
    const asal = labelAsalKedatangan(e.asal, e.metode_unloading);
    const lokasi = `${asal ? `${asal} · ` : ''}${e.supplier} · ${labelZonaPendek(e.zona)}`;
    if (isBarisPenutup(e)) {
        return { utama: <span className="text-emerald-300">Tandai selesai</span>, sub: lokasi };
    }
    return {
        utama: <>{(e.ton || 0).toLocaleString('id-ID')} <span className="text-[10px] text-emerald-400">ton</span></>,
        sub: `${lokasi}${e.status === 'progres' ? ' · masih progres' : ''}`,
    };
}

/**
 * Daftar entri batubara (loading / kedatangan). Ditulis terpisah dari EntryList
 * milik solar karena barisnya punya bentuk yang berbeda — dua baris teks bebas
 * plus chip — bukan sekadar jumlah + label.
 */
function CoalEntryList({ rows, onRemove, canEdit }: {
    rows: { key: string; id?: string; utama: React.ReactNode; sub: React.ReactNode; baru?: boolean; accent: string }[];
    onRemove: (row: { id?: string; key: string }) => void;
    canEdit: boolean;
}) {
    if (rows.length === 0) return null;
    return (
        <div className="flex flex-col gap-2">
            {rows.map(r => (
                <div
                    key={r.key}
                    className={`relative flex justify-between items-center px-3 py-2 rounded-lg pr-10 border ${r.baru ? `bg-[#101822]/60 ${r.accent}/20` : `bg-[#101822] ${r.accent}/30`}`}
                >
                    <div className="flex flex-col min-w-0 gap-0.5">
                        <span className="text-xs font-mono font-bold text-slate-200">{r.utama}</span>
                        <span className="text-[10px] text-slate-400 truncate">
                            {r.sub}{r.baru && <span className="text-[9px] text-slate-500"> (baru)</span>}
                        </span>
                    </div>
                    {canEdit && (
                        <button
                            type="button" onClick={() => onRemove(r)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/25 flex items-center justify-center transition-colors"
                        >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
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

    // ── Batubara: rincian loading per pilar + kedatangan ──────────────────────
    /**
     * Semua operator yang login boleh mengisi (sejak 9 Okt 2026 — dulu gerbang
     * rollout khusus admin). BUKAN batas keamanan: RLS proyek ini allow-all dan
     * semua tulis memang dari browser.
     */
    canEditCoal?: boolean;
    /** Tanggal laporan — jadi default "tanggal masuk" kedatangan. */
    reportDate?: string;
    /**
     * Pilar mana saja yang dikeruk shift ini. Operator hanya memilih pilarnya;
     * jumlah shovel per pilar adalah Total Loading dibagi rata, dihitung saat simpan.
     */
    coalZonas?: string[];
    onCoalZonasChange?: (zonas: string[]) => void;
    coalArrivalEntries?: CoalArrivalEntry[];
    onCoalArrivalEntriesChange?: (entries: CoalArrivalEntry[]) => void;
    savedCoalArrivalEntries?: CoalArrivalEntry[];
    onDeleteSavedCoalArrival?: (id: string) => void;
    /** Pengiriman berstatus 'progres' dari shift sebelumnya. */
    openArrivals?: OpenArrival[];
    /** Nama supplier yang pernah dipakai, untuk datalist. */
    supplierOptions?: string[];
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
    canEditCoal = false, reportDate = '',
    coalZonas = [], onCoalZonasChange,
    coalArrivalEntries = [], onCoalArrivalEntriesChange,
    savedCoalArrivalEntries = [], onDeleteSavedCoalArrival,
    openArrivals = [], supplierOptions = [],
}: TabHandlingProps) {
    const [showSolarModal, setShowSolarModal] = useState(false);
    const [showOutModal, setShowOutModal] = useState(false);
    const [solarForm, setSolarForm] = useState<SolarEntry>(EMPTY_SOLAR);
    const [outForm, setOutForm] = useState<OutSolarEntry>(EMPTY_OUT);
    const [tujuanMode, setTujuanMode] = useState<'Boiler A+B' | 'Bengkel' | 'SA/SU 3B' | 'Lainnya'>('Bengkel');

    const [showArrivalModal, setShowArrivalModal] = useState(false);

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

    // ── Batubara ──────────────────────────────────────────────────────────────
    // Operator hanya memilih PILAR-nya; jumlah shovel per pilar adalah Total Loading
    // dibagi rata. Sengaja tidak dibulatkan — 40 shovel dari 3 pilar memang 13,33.
    const totalDiketik = Number(espValues.loading);
    const adaTotal = Number.isFinite(totalDiketik) && totalDiketik > 0;
    const shovelPerPilar = adaTotal && coalZonas.length > 0 ? totalDiketik / coalZonas.length : 0;
    // Aturan yang sama dengan gate kelengkapan tab Handling di app/input-laporan/page.tsx.
    const pilarKurang = adaTotal && coalZonas.length === 0;

    const toggleZona = (zona: string) => onCoalZonasChange?.(
        coalZonas.includes(zona) ? coalZonas.filter(z => z !== zona) : [...coalZonas, zona],
    );

    const allArrivals = [...savedCoalArrivalEntries, ...coalArrivalEntries];
    const totalTonDatang = allArrivals.reduce((s, e) => s + (e.ton || 0), 0);
    const daftarSupplier = [...supplierOptions, ...allArrivals.map(a => a.supplier)];

    const saveArrival = (entry: CoalArrivalEntry) => {
        onCoalArrivalEntriesChange?.([...coalArrivalEntries, entry]);
        setShowArrivalModal(false);
    };

    const removeArrival = (row: { id?: string; key: string }) => {
        if (row.id) return onDeleteSavedCoalArrival?.(row.id);
        const idx = Number(row.key.split('-')[1]);
        onCoalArrivalEntriesChange?.(coalArrivalEntries.filter((_, i) => i !== idx));
    };

    return (
        <>
            <div className="w-full xl:flex-1 xl:overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
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

                        {/* Diambil dari pilar mana. Tiga field di atas tidak berubah sama
                            sekali: itu yang dibaca Sheets dan /logbook. Pilihan di bawah ini
                            hanya dibaca /coal-storage, dan operator cukup menunjuk pilarnya:
                            jumlah shovel per pilar adalah Total Loading dibagi rata. WAJIB
                            begitu Total Loading > 0 (gate kelengkapan tab di page.tsx) —
                            tanpa pilar, stok di denah tidak pernah berkurang. */}
                        <div>
                            <SectionLabel label="Diambil dari pilar" />
                            <div className="flex flex-wrap gap-1.5">
                                {ZONA_OPTIONS.map(z => {
                                    const aktif = coalZonas.includes(z.value);
                                    return (
                                        <button
                                            key={z.value}
                                            type="button"
                                            disabled={!canEditCoal}
                                            onClick={() => toggleZona(z.value)}
                                            aria-pressed={aktif}
                                            className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition-colors
                                                ${!canEditCoal
                                                    ? 'border-slate-700/60 bg-slate-800/40 text-slate-600 cursor-not-allowed'
                                                    : aktif
                                                        ? 'border-orange-500 bg-orange-500/25 text-orange-200 cursor-pointer'
                                                        : 'border-slate-700/80 bg-[#101822] text-slate-400 hover:border-orange-500/50 hover:text-orange-300 cursor-pointer'}`}
                                        >
                                            {z.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {canEditCoal && (
                                <p className={`text-[10px] mt-2 leading-relaxed ${pilarKurang ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                                    {coalZonas.length === 0
                                        ? (pilarKurang ? 'Wajib: pilih minimal satu pilar asal loading.' : 'Belum ada pilar dipilih.')
                                        : !adaTotal
                                            ? `${coalZonas.length} pilar dipilih — isi Total Loading dulu untuk melihat pembagiannya.`
                                            : <>
                                                {totalDiketik} shovel ÷ {coalZonas.length} pilar ={' '}
                                                <span className="text-orange-300 font-bold">
                                                    ±{shovelPerPilar.toLocaleString('id-ID', { maximumFractionDigits: 2 })} shovel
                                                    {' '}({formatTon(shovelPerPilar * TON_PER_SHOVEL)} ton)
                                                </span>{' '}
                                                per pilar
                                            </>}
                                </p>
                            )}
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

                    {/* Kedatangan Batubara — opsional, hanya diisi bila ada kedatangan */}
                    <Card title="Kedatangan Batubara" icon="dock" color="emerald">
                        {allArrivals.length > 0 && (
                            <div className="mb-1">
                                <CoalEntryList
                                    canEdit={canEditCoal}
                                    onRemove={removeArrival}
                                    rows={[
                                        ...savedCoalArrivalEntries.map((e, i) => ({
                                            key: `saved-${e.id ?? i}`, id: e.id, accent: 'border-emerald-500',
                                            ...isiBarisKedatangan(e),
                                        })),
                                        ...coalArrivalEntries.map((e, i) => ({
                                            key: `pending-${i}`, accent: 'border-emerald-500', baru: true,
                                            ...isiBarisKedatangan(e),
                                        })),
                                    ]}
                                />
                                <div className="flex justify-between items-center px-1 mt-2 mb-1">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total</span>
                                    <span className="text-sm font-mono font-bold text-emerald-300">{totalTonDatang.toLocaleString('id-ID')} ton</span>
                                </div>
                                <div className="h-px bg-slate-700/40 mb-3" />
                            </div>
                        )}

                        {canEditCoal ? (
                            <button type="button" onClick={() => setShowArrivalModal(true)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-sm font-bold transition-colors">
                                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                                Tambah Kedatangan
                            </button>
                        ) : (
                            <button type="button" disabled
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/40 text-slate-500 text-sm font-bold cursor-not-allowed">
                                <span className="material-symbols-outlined text-[18px]">lock</span>
                                Tambah Kedatangan
                            </button>
                        )}
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
                        <option value="Boiler A+B">Boiler A+B</option>
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

            {/* Modal Kedatangan Batubara — form yang sama dipakai review harian supervisor. */}
            {showArrivalModal && (
                <CoalArrivalModal
                    onClose={() => setShowArrivalModal(false)}
                    onSave={saveArrival}
                    reportDate={reportDate}
                    openArrivals={openArrivals}
                    supplierOptions={daftarSupplier}
                />
            )}
        </>
    );
}
