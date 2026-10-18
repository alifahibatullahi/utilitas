'use client';
import React, { useState } from 'react';
import { Card, InputField, SectionLabel } from '@/components/input-shift/SharedComponents';
import CoalArrivalModal, { type CoalArrivalEntry } from '@/components/input-shift/CoalArrivalModal';
import type { CoalArrivalHarian, CoalReviewProps } from './types';
import { formatTon, kedatanganHarianDariEntri, labelAsalKedatangan, labelZonaPendek } from '@/lib/coal-storage';
import type { ShiftKey } from '@/lib/constants';
import { SolarOriginBadge } from './SolarOriginBadge';

// Pemindahan (OUT) rit + ton, input langsung. Tiap field default 0 & editable.
const OUT_CATS = [
    { label: 'Pabrik 2 · PF1', rit: 'pb2_pf1_rit', ton: 'pb2_pf1_ton' },
    { label: 'Pabrik 2 · PF2', rit: 'pb2_pf2_rit', ton: 'pb2_pf2_ton' },
    { label: 'Pabrik 3 · Calsinasi', rit: 'pb3_calc_rit', ton: 'pb3_calc_ton' },
] as const;

const keEntry = (a: CoalArrivalHarian): CoalArrivalEntry => ({
    id: a.id, batch_id: a.batch_id, supplier: a.supplier, zona: a.zona, ton: a.ton,
    tanggal_masuk: a.tanggal_masuk, status: a.status === 'selesai' ? 'selesai' : 'progres',
    asal: a.asal, metode_unloading: a.metode_unloading,
});

/** Form In/Out batubara.
 *  - Kedatangan (IN): SATU data dengan tab Handling laporan shift (coal_arrivals). Via Laut
 *    = Σ tongkang, Via Darat = Σ darat (rekapKedatanganHarian — rumus yang sama dipakai saat
 *    menulis LHUBB DK/DM). Tidak ada angka ketikan terpisah; koreksi lewat entrinya. Dengan
 *    handler CRUD (review supervisor) entri bisa ditambah/diedit/dihapus; tanpa → baca-saja.
 *  - Pemindahan (OUT): input langsung per kategori, default 0, tetap tersimpan 0 ke Sheets. */
export default function TabStockBatubara({
    coalTransfer = {}, onCoalTransferChange, coalArrivals = [],
    reportDate = '', coalOpenArrivals = [], coalSupplierOptions = [],
    onAddCoalArrival, onEditCoalArrival, onDeleteCoalArrival,
}: CoalReviewProps) {
    const val = (name: string) => coalTransfer[name] ?? 0;
    const [modal, setModal] = useState<{ edit: CoalArrivalHarian | null } | null>(null);

    // Tanpa entri berasal (tanggal lama, atau entri dari aplikasi lama yang belum punya asal)
    // yang berlaku di LHUBB adalah angka tersimpan — ketikan supervisor — jadi itu yang tampil.
    const tersimpan = { darat: Number(coalTransfer.darat_24_ton) || 0, laut: Number(coalTransfer.laut_24_ton) || 0 };
    const rekapEntri = kedatanganHarianDariEntri(coalArrivals);
    const { darat, laut } = rekapEntri ?? tersimpan;
    const angkaLama = !rekapEntri && (tersimpan.darat > 0 || tersimpan.laut > 0 || coalArrivals.length > 0);
    const tanpaAsal = coalArrivals.filter(a => !a.asal && a.ton > 0);
    const bisaUbah = !!onEditCoalArrival;

    const simpan = async (entry: CoalArrivalEntry, shift: ShiftKey | null) => {
        if (modal?.edit?.id) await onEditCoalArrival?.(modal.edit.id, entry);
        else if (shift) await onAddCoalArrival?.(entry, shift);
        setModal(null);
    };

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

            {/* ═══ Kedatangan Batubara (IN) ═══ */}
            <Card title="Kedatangan Batubara" icon="download" area="coal">
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { label: 'Via Laut · Tongkang', ton: laut, icon: 'directions_boat' },
                        { label: 'Via Darat', ton: darat, icon: 'local_shipping' },
                    ].map(k => (
                        <div key={k.label} className="rounded-lg border border-slate-700/40 bg-bg-dark/40 px-3 py-2.5">
                            <p className="text-[9px] text-(--area-ink) uppercase tracking-wider flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">{k.icon}</span>{k.label}
                            </p>
                            <p className="text-lg font-mono font-bold text-amber-300">{formatTon(k.ton)} <span className="text-[10px] text-slate-500">ton</span></p>
                        </div>
                    ))}
                </div>
                <p className="text-[10px] text-slate-500 -mt-1">
                    {angkaLama
                        ? 'Angka tersimpan — belum ada entri ber-asal (tongkang/darat). Begitu ada, angka ini diganti jumlah entri.'
                        : 'Jumlah entri kedatangan dari laporan shift (tab Handling). Koreksi lewat entrinya di bawah.'}
                </p>
                {tanpaAsal.length > 0 && (
                    <p className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                        {tanpaAsal.length} entri belum punya asal (tongkang/darat) dan belum terhitung di atas{bisaUbah ? ' — edit untuk melengkapi.' : '.'}
                    </p>
                )}

                <div className="pt-2 mt-1 border-t border-slate-700/50">
                    <SectionLabel label="Detail Entri" badge={`${coalArrivals.length} entri`} />
                    {coalArrivals.length > 0 ? (
                        <div className="space-y-2">
                            {coalArrivals.map((item, i) => {
                                const asal = labelAsalKedatangan(item.asal, item.metode_unloading);
                                return (
                                    <div key={item.id ?? i} className={`relative flex items-center gap-2 bg-bg-dark/50 border border-amber-500/30 rounded-lg px-3 py-2 min-w-0 ${bisaUbah ? 'pr-16' : ''}`}>
                                        <span className="material-symbols-outlined text-amber-400 text-[15px]">{item.asal === 'darat' ? 'local_shipping' : 'directions_boat'}</span>
                                        <div className="flex flex-col min-w-0 gap-0.5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {/* Baris penutup (lanjutan bertonase 0) cuma menandai pengiriman tuntas. */}
                                                {item.ton === 0 && item.status === 'selesai'
                                                    ?<span className="text-amber-200 font-medium text-sm">Pengiriman selesai</span>
                                                    : <span className="text-white font-medium text-sm font-mono">{formatTon(item.ton)} <span className="text-amber-400 text-xs">ton</span></span>}
                                                <SolarOriginBadge shift={item.shift} />
                                                {item.status === 'progres' && (
                                                    <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-medium">IP</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-slate-400 truncate">
                                                {asal ? `${asal} · ` : ''}{item.supplier} · {labelZonaPendek(item.zona)}
                                            </span>
                                        </div>
                                        {bisaUbah && item.id && (
                                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                <button type="button" aria-label="Edit kedatangan" onClick={() => setModal({ edit: item })} className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center"><span className="material-symbols-outlined text-[13px]">edit</span></button>
                                                <button type="button" aria-label="Hapus kedatangan" onClick={() => onDeleteCoalArrival?.(item.id!)} className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center"><span className="material-symbols-outlined text-[13px]">delete</span></button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : <p className="text-[11px] text-slate-500 italic">Belum ada kedatangan batubara hari ini.</p>}
                    {onAddCoalArrival && (
                        <button type="button" onClick={() => setModal({ edit: null })}
                            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm font-bold transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>Tambah Kedatangan
                        </button>
                    )}
                </div>
            </Card>

            {/* ═══ Pemindahan Batubara (OUT) ═══ */}
            <Card title="Pemindahan Batubara" icon="upload" area="ash">
                <p className="text-[10px] text-slate-500 -mt-1">Default 0 — isi bila ada pemindahan. Nilai 0 tetap tersimpan ke Sheets.</p>
                <div className="space-y-3">
                    {OUT_CATS.map(c => (
                        <div key={c.ton}>
                            <SectionLabel label={c.label} />
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="Rit" unit="Rit" color="rose" name={c.rit}
                                    value={val(c.rit)} onChange={onCoalTransferChange} />
                                <InputField label="Tonase" unit="Ton" color="rose" name={c.ton} thousands
                                    value={val(c.ton)} onChange={onCoalTransferChange} />
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {modal && (
                <CoalArrivalModal
                    onClose={() => setModal(null)}
                    onSave={simpan}
                    reportDate={reportDate}
                    openArrivals={coalOpenArrivals}
                    supplierOptions={coalSupplierOptions}
                    edit={modal.edit ? keEntry(modal.edit) : null}
                    editShift={modal.edit?.shift ?? null}
                    pilihShift={!modal.edit}
                />
            )}
        </div>
    );
}
