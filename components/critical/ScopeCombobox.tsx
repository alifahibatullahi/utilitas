'use client';

import { useState, useMemo } from 'react';
import EditableCombobox, { type ComboboxItem } from './EditableCombobox';
import MasterDataFormModal from './MasterDataFormModal';
import { useHarScopes } from '@/hooks/useMasterData';
import type { HarScope } from '@/lib/supabase/types';

interface ScopeComboboxProps {
    value: HarScope | '';
    onChange: (value: HarScope) => void;
    light?: boolean;
}

export default function ScopeCombobox({ value, onChange, light = true }: ScopeComboboxProps) {
    const { scopes, createScope, updateScope } = useHarScopes();
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const comboboxItems: ComboboxItem[] = useMemo(() => scopes.map(s => ({
        id: s.id,
        value: s.value,
        primary: s.label,
    })), [scopes]);

    // Tampilkan label di input, simpan value (slug) ke parent
    const currentLabel = scopes.find(s => s.value === value)?.label ?? value;

    const editing = editingId ? scopes.find(s => s.id === editingId) : null;
    const initialValues = editing ? { label: editing.label } : undefined;

    return (
        <>
            <EditableCombobox
                value={currentLabel}
                onChange={(v) => {
                    // v bisa berupa slug (value) atau teks bebas; cek match exact
                    const match = scopes.find(s => s.value === v || s.label === v);
                    if (match) onChange(match.value as HarScope);
                    else onChange(v as HarScope);
                }}
                items={comboboxItems}
                light={light}
                placeholder="Pilih scope..."
                onAdd={() => { setEditingId(null); setFormOpen(true); }}
                onEdit={(id) => { setEditingId(id); setFormOpen(true); }}
                addLabel="+ Tambahkan scope baru"
                showSecondary={false}
            />
            <MasterDataFormModal
                open={formOpen}
                title={editing ? `Edit Scope — ${editing.label}` : 'Tambah Scope Baru'}
                fields={editing
                    ? [{ key: 'label', label: 'Nama Scope', placeholder: 'cth: Mekanik', required: true }]
                    : [
                        { key: 'value', label: 'Slug (huruf kecil, tanpa spasi)', placeholder: 'cth: instrumentasi', required: true },
                        { key: 'label', label: 'Nama Scope (tampilan)', placeholder: 'cth: Instrumentasi', required: true },
                    ]
                }
                initial={initialValues}
                onClose={() => { setFormOpen(false); setEditingId(null); }}
                onSubmit={async (data) => {
                    if (editingId) return updateScope(editingId, { label: data.label });
                    return createScope({ value: data.value, label: data.label });
                }}
            />
        </>
    );
}
