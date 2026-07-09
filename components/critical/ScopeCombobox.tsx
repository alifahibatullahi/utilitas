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
    placeholder?: string;
}

export default function ScopeCombobox({ value, onChange, light = true, placeholder }: ScopeComboboxProps) {
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
                dropUp
                value={currentLabel}
                onChange={(v) => {
                    // v bisa berupa slug (value) atau teks bebas; cek match exact
                    const match = scopes.find(s => s.value === v || s.label === v);
                    if (match) onChange(match.value as HarScope);
                    else onChange(v as HarScope);
                }}
                items={comboboxItems}
                light={light}
                placeholder={placeholder || "Pilih scope HAR"}
                onAdd={() => { setEditingId(null); setFormOpen(true); }}
                onEdit={(id) => { setEditingId(id); setFormOpen(true); }}
                addLabel="+ Tambahkan scope baru"
                showSecondary={false}
            />
            <MasterDataFormModal
                open={formOpen}
                title={editing ? `Edit Scope — ${editing.label}` : 'Tambah Scope Baru'}
                fields={[{ key: 'label', label: 'Nama Scope', placeholder: 'cth: Instrumentasi', required: true }]}
                initial={initialValues}
                onClose={() => { setFormOpen(false); setEditingId(null); }}
                onSubmit={async (data) => {
                    if (editingId) return updateScope(editingId, { label: data.label });
                    // Auto-generate slug dari nama: lowercase, ganti spasi/non-alphanumeric jadi underscore
                    const slug = data.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                    return createScope({ value: slug, label: data.label });
                }}
            />
        </>
    );
}
