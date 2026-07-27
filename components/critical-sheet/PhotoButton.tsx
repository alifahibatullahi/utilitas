'use client';

/**
 * Pintu masuk foto satu record — jalur upload satu-satunya (buka RecordPhotoModal).
 * Dipakai di daftar record (tabel + kartu) dan di riwayat halaman item.
 *
 * Dua keadaannya sengaja dibedakan WARNA, bukan cuma angka: operator memindai kolomnya
 * sekilas untuk tahu baris mana yang sudah ada fotonya. Biru solid = ada foto, kotak
 * garis putus-putus = masih kosong.
 *  - `compact`  : padding lebih rapat untuk sel tabel; labelnya tetap "Foto".
 *  - `disabled` : baris sheet belum punya ID, jadi belum bisa dilampiri foto.
 */
export default function PhotoButton({ count, onClick, disabled = false, compact = false }: {
    count: number;
    onClick: () => void;
    disabled?: boolean;
    compact?: boolean;
}) {
    const has = count > 0;
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center gap-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
            } ${
                has
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                    : 'border border-dashed border-neutral-300 text-neutral-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'
            }`}
            title={disabled
                ? 'Baris ini belum punya ID — muat ulang data dulu'
                : has ? `Lihat ${count} foto record ini` : 'Tambahkan foto untuk record ini'}
        >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                {has ? 'photo_camera' : 'add_a_photo'}
            </span>
            Foto
            {has && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-white/25 text-[10px] leading-none">
                    {count}
                </span>
            )}
        </button>
    );
}
