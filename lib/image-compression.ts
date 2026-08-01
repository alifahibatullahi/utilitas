/**
 * Client-side image compression menggunakan Canvas API (no library).
 * Compress + resize image File jadi JPEG kecil sebelum di-upload ke server.
 *
 * Default target: max 1600px sisi terpanjang, JPEG quality 0.8 → biasanya
 * file 4MB jadi 200-500KB tanpa kehilangan detail visual signifikan.
 */

export interface CompressOptions {
    /** Max sisi terpanjang dalam pixel. Default 1600. */
    maxDimension?: number;
    /** JPEG quality (0..1). Default 0.8. */
    quality?: number;
    /** Force output format. Default 'image/jpeg'. */
    mimeType?: string;
    /**
     * Lewati jalan pintas "sudah kecil" dan "GIF dibiarkan". Dipakai compressImageToFit,
     * yang justru dipanggil ketika berkasnya TERLALU BESAR — di situ mempertahankan
     * animasi GIF kalah penting dibanding upload yang berhasil sama sekali.
     */
    paksa?: boolean;
}

/**
 * Compress image file. Returns a new File with compressed JPEG content.
 * Skip compression untuk file yang sudah kecil (<= 200KB) atau bukan image yang bisa di-decode.
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
    const {
        maxDimension = 1600,
        quality = 0.8,
        mimeType = 'image/jpeg',
        paksa = false,
    } = opts;

    // Skip kalau bukan image atau sudah sangat kecil
    if (!file.type.startsWith('image/')) return file;
    if (!paksa && file.size <= 200 * 1024) return file;
    // GIF: skip (compression akan hilangkan animasi)
    if (!paksa && file.type === 'image/gif') return file;

    try {
        const bitmap = await loadBitmap(file);

        // Hitung ukuran target dengan preserve aspect ratio
        const { width, height } = computeTargetSize(bitmap.width, bitmap.height, maxDimension);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            bitmap.close?.();
            return file;
        }

        // Background putih untuk image dengan transparansi (PNG → JPEG)
        if (mimeType === 'image/jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close?.();

        const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, mimeType, quality));
        if (!blob) return file;

        // Kalau hasil compress lebih besar dari original (rare), pakai original
        if (blob.size >= file.size) return file;

        const ext = mimeType === 'image/jpeg' ? 'jpg' : (mimeType.split('/')[1] || 'jpg');
        const newName = file.name.replace(/\.[^/.]+$/, '') + `.${ext}`;
        return new File([blob], newName, { type: mimeType, lastModified: Date.now() });
    } catch {
        // Fallback ke original kalau compression error
        return file;
    }
}

/**
 * Kompres sampai benar-benar MUAT di bawah `maxBytes`, bukan sekadar "dikecilkan".
 *
 * compressImage() saja tidak cukup karena tiga jalan keluarnya mengembalikan berkas ASLI
 * apa adanya, dan semuanya berakhir sebagai 413 mentah dari Vercel yang tak bisa dibaca
 * operator:
 *   - HEIC (foto bawaan iPhone) tidak bisa di-decode Chrome/Firefox → masuk `catch`;
 *   - GIF sengaja dilewati agar animasinya tidak hilang;
 *   - hasil kompresi yang ternyata lebih besar dari aslinya.
 *
 * Di sini setiap percobaan diperiksa ukurannya, dan mutunya diturunkan bertahap sampai
 * muat. Yang gagal total dikembalikan apa adanya — pemanggil yang memutuskan menolaknya
 * dengan pesan yang jelas, karena hanya dia yang tahu konteksnya.
 */
export async function compressImageToFit(file: File, maxBytes: number): Promise<File> {
    if (file.size <= maxBytes && file.type !== 'image/heic') return file;
    if (!file.type.startsWith('image/')) return file;   // video tidak di-transcode di browser

    // Turun bertahap: jaga mutu selama masih muat, baru korbankan kalau perlu.
    const tahap: CompressOptions[] = [
        { maxDimension: 1600, quality: 0.8 },
        { maxDimension: 1280, quality: 0.7 },
        { maxDimension: 1024, quality: 0.6 },
        { maxDimension: 800,  quality: 0.5 },
    ];

    let terkecil = file;
    for (const opts of tahap) {
        // paksaKompresi: lewati jalan pintas "sudah kecil"/"GIF" di compressImage —
        // di sini justru berkas besar itulah yang harus ditangani.
        const hasil = await compressImage(file, { ...opts, paksa: true }).catch(() => file);
        if (hasil.size < terkecil.size) terkecil = hasil;
        if (hasil.size <= maxBytes) return hasil;
    }
    return terkecil;
}

interface BitmapLike {
    width: number;
    height: number;
    close?: () => void;
}

async function loadBitmap(file: File): Promise<CanvasImageSource & BitmapLike> {
    // Coba createImageBitmap dulu (lebih cepat, off-thread)
    if (typeof createImageBitmap === 'function') {
        try {
            return await createImageBitmap(file) as unknown as CanvasImageSource & BitmapLike;
        } catch {
            // Fall through ke HTMLImageElement
        }
    }
    // Fallback: HTMLImageElement via URL.createObjectURL
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error('Failed to decode image'));
            i.src = url;
        });
        return img as unknown as CanvasImageSource & BitmapLike;
    } finally {
        URL.revokeObjectURL(url);
    }
}

function computeTargetSize(w: number, h: number, maxDim: number): { width: number; height: number } {
    if (w <= maxDim && h <= maxDim) return { width: w, height: h };
    const ratio = w / h;
    if (w >= h) return { width: maxDim, height: Math.round(maxDim / ratio) };
    return { width: Math.round(maxDim * ratio), height: maxDim };
}
