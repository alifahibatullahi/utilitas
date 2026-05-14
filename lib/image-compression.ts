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
    } = opts;

    // Skip kalau bukan image atau sudah sangat kecil
    if (!file.type.startsWith('image/')) return file;
    if (file.size <= 200 * 1024) return file;
    // GIF: skip (compression akan hilangkan animasi)
    if (file.type === 'image/gif') return file;

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
