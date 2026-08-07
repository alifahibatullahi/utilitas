'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOperator } from '@/hooks/useOperator';
import { compressImageToFit } from '@/lib/image-compression';
import { MAX_UPLOAD_BYTES, mediaKindOf, formatBytes } from '@/lib/upload-limits';
import { fetchSheetPhotos, itemLabel, mediaSummary, type PhotoFocus, type RecentEntry, type SheetPhoto } from './types';
import { SheetScopeBadge, SheetStatusBadge } from './SheetBadges';
import { MediaThumb, PhotoLightbox, PHOTO_KIND, type PhotoRecordInfo } from './PhotoViewer';
import PolaroidCamera from './PolaroidCamera';

/** Berapa unggahan berjalan bersamaan dalam satu batch. Cukup untuk menutup latensi tanpa
 *  membuat jaringan lapangan tersedak — operator jarang mengirim lebih dari 3-4 berkas. */
const PARALEL = 3;

/** Record (satu baris sheet) yang jadi pemilik foto. */
export interface PhotoRecordTarget extends PhotoRecordInfo {
    /** '' bila baris ini belum punya foto sama sekali — uid-nya lahir saat upload pertama. */
    uid: string;
    /** Identitas cadangan untuk baris ber-uid kosong: nomor baris + sidik jari isinya. */
    rowIndex?: number;
    sig?: string;
    itemKey: string;
    itemName: string;
    /** Varian mentah baris itu (kolom "Varian") — bisa gabungan seperti "DEF". */
    variant: string;
}

/**
 * Target modal langsung dari tautan menu spreadsheet — tanpa satu pun panggilan API.
 *
 * Menu itu sudah membaca isi barisnya untuk menyusun `sig`, jadi isinya ikut dititipkan di
 * URL. Cukup untuk MENAMPILKAN; yang MENGIKAT foto ke barisnya tetap `rowIndex` + `sig`,
 * diverifikasi ulang ke spreadsheet oleh server saat fotonya benar-benar disimpan.
 *
 * null bila tautannya tidak membawa isi (mis. tautan dari sel Dokumentasi yang hanya
 * ber-uid) — pemanggil harus jatuh ke `fetchFocusRecord`.
 */
export function photoTargetFromFocus(f: PhotoFocus): PhotoRecordTarget | null {
    if (!f.isi || !f.kind || f.rowIndex === undefined || !f.sig) return null;
    return {
        uid: f.uid ?? '',
        rowIndex: f.rowIndex,
        sig: f.sig,
        kind: f.kind,
        itemKey: f.itemKey ?? '',
        itemName: f.isi.nama,
        variant: f.isi.varian,
        tanggalRaw: f.isi.tanggalRaw,
        uraian: f.isi.uraian,
        // Sengaja kosong DAN ditandai ringkas: lihat catatan `ringkas` di PhotoRecordInfo.
        pelapor: '',
        scope: '',
        status: '',
        ringkas: true,
    };
}

/**
 * Satu baris daftar → target modal fotonya. Ketiga pemanggil modal (daftar record, riwayat
 * item, deep-link dari spreadsheet) memakai ini supaya isi headernya tidak pelan-pelan
 * berbeda antar halaman.
 */
export function photoTargetOf(e: RecentEntry): PhotoRecordTarget {
    return {
        uid: e.uid,
        rowIndex: e.rowIndex,
        sig: e.sig,
        kind: e.kind,
        itemKey: e.itemKey,
        itemName: e.itemName,
        variant: e.variant,
        tanggalRaw: e.tanggalRaw,
        uraian: e.uraian,
        pelapor: e.pelapor,
        scope: e.scope,
        status: e.status,
    };
}

interface RecordPhotoModalProps {
    record: PhotoRecordTarget;
    onClose: () => void;
    /** Dipanggil tiap jumlah foto berubah, supaya daftar di belakang ikut ter-update. */
    onCountChange?: (uid: string, count: number) => void;
}

/**
 * Galeri + upload foto untuk SATU record critical/maintenance.
 *
 * Ini jalur upload satu-satunya: operator sampai ke sini dari tombol Foto di tabel
 * atau deep-link `?foto=<uid>` dari sel spreadsheet. Setelah upload, API menulis balik
 * kolom "Dokumentasi" baris tersebut di spreadsheet.
 */
export default function RecordPhotoModal({ record, onClose, onCountChange }: RecordPhotoModalProps) {
    const { operator } = useOperator();
    const [photos, setPhotos] = useState<SheetPhoto[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    /** Berapa berkas yang masih mengantre diupload — dirender jadi ubin berdenyut. */
    const [pending, setPending] = useState(0);
    /** Foto yang sedang dihapus: ubinnya diredupkan sampai server menjawab. */
    const [deleting, setDeleting] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const kind = PHOTO_KIND[record.kind];

    // Foto baru diambil saat modal dibuka — bukan saat daftar dirender — supaya
    // membuka halaman daftar tidak menarik seluruh foto sekaligus.
    // Pemanggil memberi key={record.uid} sehingga ganti record = remount; `loading`
    // sudah true dari state awal dan tidak perlu di-set ulang di dalam effect.
    /**
     * uid record ini. Baris yang belum pernah difoto memulainya dengan '' dan baru
     * mendapatkannya dari server saat foto pertama tersimpan — sejak itu foto berikutnya
     * di modal yang sama menempel ke uid tersebut, bukan membuat identitas baru lagi.
     */
    const [uid, setUid] = useState(record.uid);

    useEffect(() => {
        let cancelled = false;
        // Belum punya uid = dipastikan belum punya foto; tak ada yang perlu diambil.
        if (!record.uid) { setLoading(false); return; }
        fetchSheetPhotos([record.uid])
            .then(p => { if (!cancelled) setPhotos(p); })
            .catch(() => { if (!cancelled) setError('Gagal memuat foto'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [record.uid]);

    const handleFiles = useCallback(async (files: FileList | File[] | null) => {
        // Foto DAN video sama-sama diterima; yang tipenya di luar keduanya diabaikan diam-diam
        // (mis. operator tak sengaja menjatuhkan PDF ke area unggah).
        const list = files ? Array.from(files).filter(f => mediaKindOf(f.type) !== null) : [];
        if (list.length === 0) return;
        setError(null);
        setUploading(true);
        setPending(list.length);

        const galat: string[] = [];
        const kurangiAntre = () => setPending(p => Math.max(0, p - 1));

        // Kecilkan semuanya dulu. Yang tetap kebesaran disaring DI SINI, bukan dibiarkan ke
        // server: Vercel menolak body di atas 4,5 MB sebelum kode server berjalan, jadi
        // operator hanya akan melihat kegagalan tanpa sebab. Satu berkas bermasalah tidak
        // lagi menghentikan sisa antreannya.
        const siap: (File | null)[] = await Promise.all(list.map(async file => {
            const hasil = await compressImageToFit(file, MAX_UPLOAD_BYTES).catch(() => file);
            if (hasil.size <= MAX_UPLOAD_BYTES) return hasil;
            galat.push(
                mediaKindOf(file.type) === 'video'
                    ? `Video "${file.name}" ${formatBytes(hasil.size)} — maksimal ${formatBytes(MAX_UPLOAD_BYTES)}. `
                      + 'Rekam lebih pendek (±15 detik) atau turunkan resolusi kamera ke 720p.'
                    : `Foto "${file.name}" tetap ${formatBytes(hasil.size)} setelah dikecilkan — maksimal ${formatBytes(MAX_UPLOAD_BYTES)}.`,
            );
            kurangiAntre();
            return null;
        }));
        const antre = siap.filter((f): f is File => f !== null);

        let uidSaatIni = uid;
        let terkirim = 0;

        // `sync_cell=0` di SEMUA permintaan: selnya ditulis sekali di akhir, dengan jumlah
        // akhir. Kalau tiap berkas menulisnya sendiri, dua unggahan paralel bisa saling
        // menimpa dengan hitungan yang sudah basi.
        const kirim = async (file: File, pakaiSidikJari: boolean) => {
            const form = new FormData();
            form.append('file', file);
            form.append('parent_kind', record.kind);
            form.append('sync_cell', '0');
            if (pakaiSidikJari) {
                form.append('row_index', String(record.rowIndex));
                form.append('sig', record.sig as string);
            } else {
                form.append('row_uid', uidSaatIni);
            }
            if (operator?.name) form.append('uploaded_by', operator.name);

            const res = await fetch('/api/sheet-photos', { method: 'POST', body: form });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Upload gagal');
            // Foto pertama sebuah baris melahirkan uid-nya; berkas berikutnya harus menempel
            // ke uid yang sama, bukan membuat identitas baru lagi.
            if (!uidSaatIni && json.rowUid) { uidSaatIni = json.rowUid as string; setUid(uidSaatIni); }
            setPhotos(prev => [...prev, json.photo as SheetPhoto]);
            terkirim++;
            kurangiAntre();
        };

        const catat = (err: unknown) => {
            galat.push(err instanceof Error && err.message ? err.message : 'Gagal terhubung ke server');
            kurangiAntre();
        };

        let mulaiDari = 0;
        if (!uidSaatIni) {
            if (record.rowIndex === undefined || !record.sig) {
                setError('Baris ini tidak bisa dikenali — tekan "Perbarui data" lalu coba lagi.');
                setUploading(false);
                setPending(0);
                return;
            }
            // Berkas pertama berjalan SENDIRIAN: dialah yang menerbitkan uid baris ini. Kalau
            // ikut paralel, dua permintaan akan menerbitkan dua uid berbeda untuk satu baris.
            if (antre.length > 0) {
                try { await kirim(antre[0], true); } catch (err) { catat(err); }
                mulaiDari = 1;
            }
        }

        const sisa = uidSaatIni ? antre.slice(mulaiDari) : [];
        if (mulaiDari === 1 && !uidSaatIni && antre.length > 1) {
            // Berkas pertama gagal → uid belum lahir, sisanya tidak punya tujuan.
            galat.push('Sisa berkas tidak diunggah karena berkas pertama gagal.');
            for (let i = 1; i < antre.length; i++) kurangiAntre();
        }

        let berikutnya = 0;
        await Promise.all(
            Array.from({ length: Math.min(PARALEL, sisa.length) }, async () => {
                while (berikutnya < sisa.length) {
                    const file = sisa[berikutnya++];
                    try { await kirim(file, false); } catch (err) { catat(err); }
                }
            }),
        );

        if (terkirim > 0 && uidSaatIni) {
            onCountChange?.(uidSaatIni, photos.length + terkirim);
            // Penutup batch: satu penulisan sel "Dokumentasi" dengan jumlah akhir. Tidak
            // ditunggu — server pun mengerjakannya setelah respons, dan cron menyusulkan yang
            // terlewat (repairMissingPhotoCells).
            void fetch('/api/sheet-photos/sync-cell', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ row_uid: uidSaatIni }),
            }).catch(() => { /* sel menyusul lewat cron */ });
        }

        if (galat.length > 0) setError(galat[0]);
        setUploading(false);
        setPending(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [photos.length, record.kind, record.rowIndex, record.sig, uid, operator?.name, onCountChange]);

    const pickFiles = useCallback(() => fileInputRef.current?.click(), []);

    const handleDelete = useCallback(async (id: string) => {
        setDeleting(prev => [...prev, id]);
        let ok = false;
        try {
            const res = await fetch(`/api/sheet-photos/${id}`, { method: 'DELETE' });
            ok = res.ok;
        } catch { /* ok tetap false */ }
        if (!ok) {
            setError('Gagal menghapus foto');
            setDeleting(prev => prev.filter(x => x !== id));
            return;
        }
        setPhotos(prev => {
            const next = prev.filter(p => p.id !== id);
            onCountChange?.(uid, next.length);
            return next;
        });
        setDeleting(prev => prev.filter(x => x !== id));
        setLightboxIdx(null);
    }, [onCountChange, uid]);

    async function copyLink() {
        const url = `${window.location.origin}/critical-maintenance?item=${encodeURIComponent(record.itemKey)}&foto=${encodeURIComponent(uid)}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            setError('Browser menolak akses clipboard — salin manual dari address bar.');
        }
    }

    // Esc menutup modal. Saat lightbox terbuka, dialah yang menangani Esc-nya sendiri.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape' && lightboxIdx == null) onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxIdx, onClose]);

    /** Seluruh isi modal jadi area jatuh (drop zone) — operator tidak perlu membidik kotak kecil. */
    function onDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer?.files ?? null);
    }

    const infoFor = useCallback(() => record as PhotoRecordInfo, [record]);

    return (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
            <div
                className={`relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl transition-shadow ${
                    dragging ? 'ring-4 ring-blue-500 ring-offset-2' : ''
                }`}
                onClick={e => e.stopPropagation()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={e => { if (e.currentTarget === e.target) setDragging(false); }}
                onDrop={onDrop}
            >
                {/* Header record — informasinya sengaja ditonjolkan: operator sampai di sini
                    lewat deep-link dari spreadsheet dan perlu yakin ini baris yang benar. */}
                <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 sm:px-5 py-3">
                    <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${kind.chip}`}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{kind.icon}</span>
                                    {kind.label}
                                </span>
                                <span className="text-xs font-bold text-neutral-600">{record.tanggalRaw || '—'}</span>
                                {/* Status disembunyikan untuk record ringkas — lihat catatan
                                    `ringkas` di PhotoRecordInfo. */}
                                {!record.ringkas && <SheetStatusBadge status={record.status} />}
                                <SheetScopeBadge scope={record.scope} />
                            </div>

                            {/* Uraian = pekerjaannya, jadi paling besar. Labelnya memakai JENIS
                                record ("Critical: …" / "Maintenance: …") — sama seperti sel Link
                                Foto di spreadsheet, supaya yang dibaca operator di kedua tempat
                                berbunyi sama. */}
                            <p className="text-base font-bold text-neutral-900 mt-2 leading-snug">
                                <span className="text-neutral-400 font-bold">{kind.label}: </span>
                                {record.uraian || '(tanpa uraian)'}
                            </p>

                            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1.5 text-[11px] font-semibold">
                                {record.itemName && (
                                    <span className="inline-flex items-center gap-1 text-neutral-600">
                                        <span className="material-symbols-outlined text-neutral-400" style={{ fontSize: 14 }}>precision_manufacturing</span>
                                        {itemLabel(record.itemName, record.variant)}
                                    </span>
                                )}
                                {record.pelapor && (
                                    <span className="inline-flex items-center gap-1 text-neutral-600">
                                        <span className="material-symbols-outlined text-neutral-400" style={{ fontSize: 14 }}>person</span>
                                        {record.pelapor}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 shrink-0 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 flex items-center justify-center cursor-pointer transition-colors"
                            aria-label="Tutup"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mt-3">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            className="hidden"
                            onChange={e => handleFiles(e.target.files)}
                        />
                        <button
                            onClick={pickFiles}
                            disabled={uploading}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm active:scale-95 cursor-pointer transition-all"
                        >
                            <span className={`material-symbols-outlined ${uploading ? 'animate-spin' : ''}`} style={{ fontSize: 18 }}>
                                {uploading ? 'progress_activity' : 'add_a_photo'}
                            </span>
                            {uploading ? 'Mengupload…' : 'Upload foto / video'}
                        </button>
                        {photos.length > 0 && (
                            <button
                                onClick={copyLink}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-neutral-100 border border-neutral-300 text-neutral-600 hover:bg-neutral-200 cursor-pointer transition-colors"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{copied ? 'check' : 'link'}</span>
                                {copied ? 'Tersalin' : 'Salin link'}
                            </button>
                        )}
                        <span className="text-[11px] font-bold text-neutral-400">
                            {loading ? 'Memuat…' : (mediaSummary(photos) || 'Belum ada')}
                        </span>
                        {error && <span className="text-[11px] text-red-600 font-semibold">{error}</span>}
                    </div>
                </div>

                {/* Grid foto */}
                <div className="px-4 sm:px-5 py-4">
                    {loading ? (
                        // Satu-satunya tunggu yang tersisa di alur ini (pop up-nya sendiri
                        // sudah lengkap sejak render pertama), jadi di sinilah kameranya.
                        <div className="flex flex-col items-center gap-2 py-6" aria-busy="true">
                            <PolaroidCamera className="w-[132px] h-auto" />
                            <p className="text-xs font-bold text-neutral-500 animate-pulse">Memuat foto…</p>
                        </div>
                    ) : photos.length === 0 && pending === 0 ? (
                        // Kotak kosong ini sekaligus tombolnya — tidak ada lagi "mau klik apa".
                        <button
                            onClick={pickFiles}
                            disabled={uploading}
                            className="w-full py-10 rounded-2xl border-2 border-dashed border-neutral-300 text-center hover:border-blue-400 hover:bg-blue-50/50 disabled:opacity-50 cursor-pointer transition-colors"
                        >
                            <span className="material-symbols-outlined text-neutral-300" style={{ fontSize: 44 }}>add_a_photo</span>
                            <p className="text-sm font-bold text-neutral-600 mt-1">Klik untuk pilih foto</p>
                            <p className="text-[11px] text-neutral-400 mt-0.5">atau seret berkasnya ke sini</p>
                            <p className="text-[11px] text-neutral-400 mt-2">
                                Setelah upload, kolom <span className="font-semibold">Dokumentasi</span> di spreadsheet terisi otomatis.
                            </p>
                        </button>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {photos.map((photo, idx) => {
                                const isDeleting = deleting.includes(photo.id);
                                return (
                                    <div key={photo.id} className="relative group aspect-square">
                                        <button
                                            onClick={() => setLightboxIdx(idx)}
                                            disabled={isDeleting}
                                            className={`block w-full h-full rounded-xl overflow-hidden border-2 ${kind.frame} hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 bg-neutral-100 cursor-pointer ${
                                                isDeleting ? 'opacity-40' : ''
                                            }`}
                                            title={photo.caption || photo.filename}
                                        >
                                            <MediaThumb photo={photo} className="w-full h-full object-cover" eager />
                                        </button>
                                        {isDeleting ? (
                                            // Menghapus perlu jalan bolak-balik ke server + tulis ulang sel
                                            // spreadsheet; tanpa penanda, foto terlihat "tidak bereaksi".
                                            <div className="absolute inset-0 rounded-xl bg-white/50 flex items-center justify-center pointer-events-none">
                                                <span className="material-symbols-outlined animate-spin text-red-600" style={{ fontSize: 26 }}>progress_activity</span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleDelete(photo.id)}
                                                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 scale-90 group-hover:scale-100 transition-all hover:bg-red-600 cursor-pointer"
                                                title="Hapus foto"
                                            >
                                                <span className="material-symbols-outlined font-bold" style={{ fontSize: 14 }}>close</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Ubin untuk berkas yang sedang diupload — foto barunya nanti
                                muncul menggantikan ubin ini satu per satu. */}
                            {Array.from({ length: pending }).map((_, i) => (
                                <div key={`pending-${i}`} className="aspect-square rounded-xl bg-neutral-200 animate-pulse flex flex-col items-center justify-center gap-1 text-neutral-500">
                                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: 24 }}>progress_activity</span>
                                    <span className="text-[10px] font-bold">Mengupload…</span>
                                </div>
                            ))}
                            {/* Kotak tambah di ujung grid: sejajar dengan foto lain, mudah dituju. */}
                            <button
                                onClick={pickFiles}
                                disabled={uploading}
                                className="aspect-square rounded-xl border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center gap-1 text-neutral-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 disabled:opacity-50 cursor-pointer transition-colors"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>add_a_photo</span>
                                <span className="text-[11px] font-bold">Tambah</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Petunjuk saat berkas diseret ke atas modal. */}
                {dragging && (
                    <div className="absolute inset-0 z-20 rounded-t-2xl sm:rounded-2xl bg-blue-50/90 border-2 border-dashed border-blue-500 flex flex-col items-center justify-center pointer-events-none">
                        <span className="material-symbols-outlined text-blue-600" style={{ fontSize: 48 }}>upload</span>
                        <p className="text-sm font-bold text-blue-700 mt-1">Lepaskan untuk mengupload</p>
                    </div>
                )}
            </div>

            {lightboxIdx != null && photos[lightboxIdx] && (
                <PhotoLightbox
                    photos={photos}
                    index={lightboxIdx}
                    onIndexChange={setLightboxIdx}
                    onClose={() => setLightboxIdx(null)}
                    infoFor={infoFor}
                />
            )}
        </div>
    );
}
