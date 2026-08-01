/**
 * Batas & tipe berkas unggahan — SENGAJA tanpa impor apa pun.
 *
 * Konstanta ini dipakai di dua sisi: API route (server) dan komponen upload (browser).
 * Kalau ia tinggal di lib/r2.ts, komponen browser yang mengimpornya ikut menyeret
 * @aws-sdk/client-s3 ke dalam bundle. Karena itu ia berdiri sendiri di sini, dan
 * lib/r2.ts hanya meneruskannya kembali agar impor lama tetap jalan.
 */

export const ALLOWED_IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
];

// Satu record boleh berisi foto DAN video. quicktime = .mov bawaan iPhone, 3gpp = HP lawas.
export const ALLOWED_VIDEO_MIME_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/3gpp',
];

export const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_VIDEO_MIME_TYPES];

export type MediaKind = 'photo' | 'video';

/** Jenis media dari MIME-nya; null = tipe yang tidak diterima. */
export function mediaKindOf(mime: string): MediaKind | null {
    const m = (mime ?? '').toLowerCase().split(';')[0].trim();
    if (ALLOWED_IMAGE_MIME_TYPES.includes(m)) return 'photo';
    if (ALLOWED_VIDEO_MIME_TYPES.includes(m)) return 'video';
    return null;
}

/**
 * Batas berkas yang diunggah DARI BROWSER lewat API route.
 *
 * Angkanya bukan pilihan kita: Vercel menolak request body di atas 4,5 MB sebelum kode
 * kita sempat berjalan, jadi berkas yang lebih besar gagal dengan 413 mentah tanpa pesan
 * yang bisa dibaca operator. Dulu batas ini 10 MB — artinya foto HP 5-8 MB "lolos"
 * validasi kita tapi tetap ditolak Vercel, dan operator hanya melihat gagal tanpa sebab.
 *
 * Disisakan margin dari 4,5 MB untuk overhead multipart (boundary + field lain).
 * JANGAN dinaikkan tanpa memindahkan upload keluar dari API route Vercel — dan itu butuh
 * custom domain R2, yang belum ada karena aplikasi masih di domain vercel.app.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Batas media yang diambil SERVER sendiri (mis. unduhan dari gateway WhatsApp).
 * Tidak lewat request body Vercel, jadi tidak terkena plafon 4,5 MB itu.
 */
export const MAX_SERVER_FETCH_BYTES = 10 * 1024 * 1024; // 10 MB

/** "3,4 MB" — untuk pesan yang dibaca operator. */
export function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
