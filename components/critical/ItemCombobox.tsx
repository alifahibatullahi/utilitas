'use client';

import { useState, useMemo } from 'react';
import EditableCombobox, { type ComboboxItem } from './EditableCombobox';
import MasterDataFormModal from './MasterDataFormModal';
import { useEquipmentItems } from '@/hooks/useMasterData';

interface ItemComboboxProps {
    value: string;
    onChange: (value: string) => void;
    light?: boolean;
}

export default function ItemCombobox({ value, onChange, light = false }: ItemComboboxProps) {
    const { items, createItem, updateItem } = useEquipmentItems();
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const comboboxItems: ComboboxItem[] = useMemo(() =>
        items.map(it => ({
            id: it.id,
            value: `${it.no_item} - ${it.deskripsi}`,
            primary: it.deskripsi,
            secondary: it.no_item,
        })),
    [items]);

    const editing = editingId ? items.find(i => i.id === editingId) : null;
    const initialValues = editing ? { no_item: editing.no_item, deskripsi: editing.deskripsi } : undefined;

    return (
        <>
            <EditableCombobox
                value={value}
                onChange={onChange}
                items={comboboxItems}
                light={light}
                placeholder="Ketik atau pilih item..."
                onAdd={() => { setEditingId(null); setFormOpen(true); }}
                onEdit={(id) => { setEditingId(id); setFormOpen(true); }}
                addLabel="+ Tambahkan item baru"
            />
            <MasterDataFormModal
                open={formOpen}
                title={editing ? `Edit Item — ${editing.no_item}` : 'Tambah Item Baru'}
                fields={[
                    { key: 'no_item', label: 'No Item', placeholder: 'cth: 20 P-09.05 D', required: true },
                    { key: 'deskripsi', label: 'Deskripsi', placeholder: 'cth: Dosing Pump D', required: true },
                ]}
                initial={initialValues}
                onClose={() => { setFormOpen(false); setEditingId(null); }}
                onSubmit={async (data) => {
                    if (editingId) return updateItem(editingId, { no_item: data.no_item, deskripsi: data.deskripsi });
                    return createItem({ no_item: data.no_item, deskripsi: data.deskripsi });
                }}
            />
        </>
    );
}
