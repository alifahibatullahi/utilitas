'use client';

/**
 * Pintu masuk foto satu record — jalur upload satu-satunya (buka RecordPhotoModal).
 * Dipakai di daftar record (tabel + kartu) dan di riwayat halaman item.
 *  - `compact`  : label pendek untuk sel tabel yang padat ("3" / "Foto").
 *  - `disabled` : baris sheet belum punya web_uid, jadi belum bisa dilampiri foto.
 */
export default function PhotoButton({ count, onClick, disabled = false, compact = false }: {
    count: number;
    onClick: () => void;
    disabled?: boolean;
    compact?: boolean;
}) {
    const has = count > 0;
    const label = compact
        ? (has ? String(count) : 'Foto')
        : (has ? `${count} foto` : 'Tambah foto');
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                has
                    ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
            }`}
            title={disabled
                ? 'Baris ini belum punya web_uid — muat ulang data dulu'
                : has ? `Lihat ${count} foto record ini` : 'Tambahkan foto untuk record ini'}
        >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                {has ? 'photo_camera' : 'add_a_photo'}
            </span>
            {label}
        </button>
    );
}
