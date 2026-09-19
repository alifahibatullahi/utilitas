/**
 * Pemicu sync Google Sheets dari kode server-side (cron/auto-isi).
 *
 * Sengaja lewat HTTP ke /api/sheets/write, bukan memanggil mapper langsung:
 * route itulah yang membaca ulang seluruh tabel anak dari Supabase dan menyusun
 * baris — jadi satu jalur penulisan saja, apa pun pemicunya.
 */

export async function postSheets(type: string, data: Record<string, unknown>): Promise<void> {
    const base = process.env.NEXT_PUBLIC_APP_URL;
    if (!base) return; // tanpa URL publik, lewati sync (DB tetap tersimpan)
    try {
        await fetch(`${base.replace(/\/$/, '')}/api/sheets/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, data }),
        });
    } catch (e) {
        console.warn('[sheets-sync] sync gagal:', e);
    }
}
