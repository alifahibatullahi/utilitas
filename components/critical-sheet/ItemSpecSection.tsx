'use client';

import { useEffect, useState } from 'react';
import { useOperator } from '@/hooks/useOperator';
import type { ItemSpec, SpecLine } from './types';
import { fetchItemSpec, saveItemSpec } from './types';

interface ItemSpecSectionProps {
    itemKey: string;
    itemName: string;
    variant: string;
    code: string;
}

/**
 * Spesifikasi item (kartu Tech Specs): tampil untuk semua, diedit admin. Data di Supabase
 * (item_specs). Bentuk fleksibel: deskripsi bebas + baris label/value dinamis (beda jenis
 * equipment beda field).
 */
export default function ItemSpecSection({ itemKey, itemName, variant, code }: ItemSpecSectionProps) {
    const { operator, isAdmin } = useOperator();
    const [spec, setSpec] = useState<ItemSpec | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Draft edit
    const [draftDesc, setDraftDesc] = useState('');
    const [draftLines, setDraftLines] = useState<SpecLine[]>([]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchItemSpec(itemKey)
            .then(s => { if (!cancelled) setSpec(s); })
            .catch(() => { /* anggap belum ada */ })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [itemKey]);

    function startEdit() {
        setDraftDesc(spec?.description ?? '');
        setDraftLines(spec?.specs?.length ? spec.specs.map(s => ({ ...s })) : [{ label: '', value: '' }]);
        setError(null);
        setEditing(true);
    }

    async function handleSave() {
        setSaving(true);
        setError(null);
        try {
            const saved = await saveItemSpec({
                item_key: itemKey,
                item_name: itemName,
                variant,
                code,
                description: draftDesc,
                specs: draftLines,
                updated_by: operator?.name,
            });
            setSpec(saved);
            setEditing(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal menyimpan');
        } finally {
            setSaving(false);
        }
    }

    const updateLine = (i: number, patch: Partial<SpecLine>) =>
        setDraftLines(lines => lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    const addLine = () => setDraftLines(lines => [...lines, { label: '', value: '' }]);
    const removeLine = (i: number) => setDraftLines(lines => lines.filter((_, idx) => idx !== i));

    const hasContent = spec && (spec.description || (spec.specs && spec.specs.length > 0));

    return (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3 border-b border-neutral-100 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-neutral-400" style={{ fontSize: 16 }}>settings_applications</span>
                    Spesifikasi
                </h3>
                {isAdmin && !editing && (
                    <button
                        onClick={startEdit}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer transition-colors"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                        {hasContent ? 'Edit' : 'Tambah'}
                    </button>
                )}
            </div>

            {loading ? (
                <p className="text-xs text-neutral-400 italic">Memuat…</p>
            ) : editing ? (
                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Deskripsi</label>
                        <textarea
                            value={draftDesc}
                            onChange={e => setDraftDesc(e.target.value)}
                            rows={2}
                            placeholder="Ringkasan / catatan item…"
                            className="mt-1 w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 outline-none focus:ring-2 focus:ring-neutral-400/40"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Field Spesifikasi</label>
                        {draftLines.map((line, i) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    value={line.label}
                                    onChange={e => updateLine(i, { label: e.target.value })}
                                    placeholder="Label (mis. Kapasitas)"
                                    className="w-2/5 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 outline-none focus:ring-2 focus:ring-neutral-400/40"
                                />
                                <input
                                    value={line.value}
                                    onChange={e => updateLine(i, { value: e.target.value })}
                                    placeholder="Nilai (mis. 500 m³/h)"
                                    className="flex-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 outline-none focus:ring-2 focus:ring-neutral-400/40"
                                />
                                <button
                                    onClick={() => removeLine(i)}
                                    className="w-8 shrink-0 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center cursor-pointer transition-colors"
                                    aria-label="Hapus baris"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={addLine}
                            className="flex items-center gap-1 text-[11px] font-bold text-neutral-700 hover:bg-neutral-100 rounded-lg px-2 py-1 cursor-pointer transition-colors"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                            Tambah field
                        </button>
                    </div>
                    {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-800 text-white hover:bg-neutral-900 disabled:opacity-50 cursor-pointer transition-colors"
                        >
                            {saving ? 'Menyimpan…' : 'Simpan'}
                        </button>
                        <button
                            onClick={() => setEditing(false)}
                            disabled={saving}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-500 hover:bg-neutral-100 cursor-pointer transition-colors"
                        >
                            Batal
                        </button>
                    </div>
                </div>
            ) : hasContent ? (
                <div className="space-y-3">
                    {spec!.description && <p className="text-sm text-neutral-600">{spec!.description}</p>}
                    {spec!.specs && spec!.specs.length > 0 && (
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                            {spec!.specs.map((s, i) => (
                                <div key={i} className="flex flex-col gap-0.5">
                                    <dt className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{s.label}</dt>
                                    <dd className="font-mono text-sm font-medium text-neutral-800">{s.value}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                    {spec!.updated_by && (
                        <p className="text-[10px] text-neutral-300">Diperbarui oleh {spec!.updated_by}</p>
                    )}
                </div>
            ) : (
                <p className="text-xs text-neutral-400 italic">
                    Belum ada spesifikasi.{isAdmin ? ' Klik "Tambah" untuk mengisi.' : ''}
                </p>
            )}
        </div>
    );
}
