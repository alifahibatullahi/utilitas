import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadToR2, deleteFromR2, MAX_UPLOAD_BYTES, mediaKindOf, formatBytes } from '@/lib/r2';
import { syncPhotoCell } from '@/lib/sheet-photo-sync';
import { resolveRowForUpload, ringkasBaris, uidsTerpakai } from '@/lib/critical-sheet-db';
import { buildRowUid } from '@/lib/critical-sheet';

/**
 * Foto fitur Critical Maintenance berbasis Sheets (/critical-maintenance).
 * POST: upload foto → R2 + insert row `sheet_photos` (parent = row_uid baris sheet).
 * Untuk MEMBACA foto sekumpulan baris: POST /api/sheet-photos/query. Dulu ada GET
 * ?uids=a,b,c di sini, tapi daftar uid satu item bisa ribuan — tidak muat di URL dan
 * batas 100 uid-nya diam-diam menyembunyikan foto record lama.
 */

function getAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function POST(req: NextRequest) {
    const missing: string[] = [];
    if (!process.env.R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
    if (!process.env.R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
    if (!process.env.R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
    if (!process.env.R2_BUCKET_NAME) missing.push('R2_BUCKET_NAME');
    if (!process.env.R2_PUBLIC_URL) missing.push('R2_PUBLIC_URL');
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (missing.length > 0) {
        return NextResponse.json({
            error: `Konfigurasi server belum lengkap. Env hilang: ${missing.join(', ')}. Hubungi admin untuk set env di Vercel/deployment.`,
        }, { status: 500 });
    }

    try {
        const formData   = await req.formData();
        const file       = formData.get('file')        as File   | null;
        const parentKind = formData.get('parent_kind') as string | null;
        const caption    = formData.get('caption')     as string | null;
        const uploadedBy = formData.get('uploaded_by') as string | null;
        const rowIndex   = parseInt((formData.get('row_index') as string) ?? '', 10);
        const sig        = ((formData.get('sig') as string) ?? '').trim();
        let   rowUid     = ((formData.get('row_uid') as string) ?? '').trim();

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }
        if (parentKind !== 'critical' && parentKind !== 'maintenance') {
            return NextResponse.json({ error: 'parent_kind harus critical atau maintenance' }, { status: 400 });
        }

        // ── Baris yang belum pernah difoto ───────────────────────────────────
        // Identitas baris lahir DI SINI, bukan saat sheet dibaca: app tidak lagi menulis
        // ID ke 27rb baris hanya supaya segelintir di antaranya bisa dilampiri foto.
        let barisBaru: Awaited<ReturnType<typeof resolveRowForUpload>> = null;
        if (!rowUid) {
            if (!Number.isFinite(rowIndex) || !sig) {
                return NextResponse.json(
                    { error: 'row_uid, atau row_index + sig, wajib diisi' },
                    { status: 400 },
                );
            }
            barisBaru = await resolveRowForUpload(parentKind, rowIndex, sig);
            if (!barisBaru) {
                return NextResponse.json({
                    error: 'Baris tidak ditemukan lagi di spreadsheet — mungkin sudah diubah atau dihapus. '
                         + 'Tekan "Perbarui data" lalu coba lagi.',
                }, { status: 404 });
            }
            if ('ambigu' in barisBaru) {
                return NextResponse.json({
                    error: 'Ada beberapa baris dengan isi yang sama persis — pilih barisnya lewat spreadsheet.',
                    kandidat: barisBaru.kandidat.map(ringkasBaris),
                }, { status: 409 });
            }
            rowUid = buildRowUid(barisBaru.row.item, barisBaru.row.varian, await uidsTerpakai());
        }
        const mediaKind = mediaKindOf(file.type);
        if (mediaKind === null) {
            return NextResponse.json(
                { error: 'Tipe file tidak didukung. Foto: JPEG, PNG, WebP, GIF. Video: MP4, WebM, MOV.' },
                { status: 415 },
            );
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            // Jarang tercapai: klien sudah menyaringnya lebih dulu, dan body di atas 4,5 MB
            // malah ditolak Vercel sebelum sampai sini. Tetap dijaga karena API ini publik.
            return NextResponse.json(
                { error: `Ukuran file terlalu besar (${formatBytes(file.size)}). Maksimal ${formatBytes(MAX_UPLOAD_BYTES)}.` },
                { status: 413 },
            );
        }

        const ext        = file.name.split('.').pop()?.toLowerCase() ?? (mediaKind === 'video' ? 'mp4' : 'jpg');
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const r2Key      = `photos/sheet-${parentKind}/${rowUid}/${uniqueName}`;

        const buffer    = Buffer.from(await file.arrayBuffer());
        const publicUrl = await uploadToR2(r2Key, buffer, file.type);

        // Sidik jari isi baris ikut disimpan: kalau kelak sel Dokumentasi terhapus atau
        // tergeser, inilah satu-satunya cara mengetahui foto ini milik baris yang mana.
        const sidikJari = barisBaru && !('ambigu' in barisBaru)
            ? {
                row_index:   barisBaru.row.row_index,
                row_item:    barisBaru.row.item,
                row_varian:  barisBaru.row.varian,
                row_uraian:  barisBaru.row.uraian,
                row_tanggal: barisBaru.row.tanggal_raw,
            }
            : {};

        const { data, error: dbErr } = await getAdmin()
            .from('sheet_photos')
            .insert({
                parent_kind: parentKind,
                row_uid:     rowUid,
                url:         publicUrl,
                filename:    file.name,
                media_kind:  mediaKind,
                mime_type:   file.type,
                caption:     caption?.trim() || null,
                uploaded_via: 'app',
                uploaded_by: uploadedBy ?? null,
                ...sidikJari,
            })
            .select()
            .single();

        if (dbErr) {
            try { await deleteFromR2(r2Key); } catch { /* best effort */ }
            return NextResponse.json({ error: dbErr.message }, { status: 500 });
        }

        // Cermin ke kolom "Dokumentasi" di spreadsheet. Menelan errornya sendiri.
        await syncPhotoCell(rowUid);

        // `rowUid` dikembalikan supaya klien tahu uid yang baru saja lahir untuk baris
        // yang tadinya belum punya — foto berikutnya di baris itu langsung memakainya.
        return NextResponse.json({ photo: data, rowUid }, { status: 201 });
    } catch (err) {
        console.error('[sheet-photos/POST]', err);
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message || 'Internal server error' }, { status: 500 });
    }
}
