/**
 * Menu "Kedatangan Batubara" di spreadsheet DATA OPERASIONAL
 * (apps-script/critical-maintenance-foto/Batubara.gs + KedatanganBatubara.html).
 *
 * Dialog Apps Script memanggil route ini LANGSUNG dari browser (fetch + CORS), bukan lewat
 * UrlFetchApp — supaya project Apps Script tidak butuh izin baru; tambahan scope membuat
 * semua pemakai menu Upload Foto diminta otorisasi ulang.
 *
 *   GET  → bahan form: default tanggal/shift (WIB), pilar, pengiriman berjalan, supplier.
 *   POST → satu baris coal_arrivals + tulis ulang kolom H sheet Catatan shift itu (dan shift
 *          sesudahnya di pengiriman yang sama — tonase di sana kumulatif).
 *
 * Auth `Authorization: Bearer <KEDATANGAN_SHEET_SECRET>`, disimpan di Script Properties
 * (`batubaraSecret`). Secret ini terlihat oleh siapa pun yang bisa membuka dialognya — ia
 * cuma penyaring dari luar, bukan batas hak: tabel coal_arrivals memang bisa ditulis dari
 * aplikasi web oleh operator mana pun.
 */

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/whatsapp';
import { fetchInfoKedatangan } from '@/lib/coal-storage-query';
import {
    ASAL_KEDATANGAN, METODE_UNLOADING, TOTAL_KAPASITAS_TON, labelZonaPendek,
    type AsalKedatangan, type MetodeUnloading,
} from '@/lib/coal-storage';
import { ZONA_OPTIONS, isKedatanganLengkap, type CoalArrivalEntry } from '@/lib/coal-arrival';
import { shiftTerdampakKedatangan } from '@/lib/coal-arrival-sync';
import { tulisCatatanShift } from '@/lib/catatan-sheet-sync';
import { detectCurrentShift, type ShiftKey } from '@/lib/constants';
import { nowWIB } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Penanda sumber di kolom keterangan (tak dipakai jalur lain) — jejak entri dari menu. */
const KETERANGAN_SUMBER = 'Menu spreadsheet';
/** Kirim ulang yang identik dalam jendela ini dianggap klik/permintaan ganda, bukan entri baru. */
const JENDELA_DOBEL_MS = 2 * 60_000;

const SHIFTS: ShiftKey[] = ['malam', 'pagi', 'sore'];
const ZONA_VALID = new Set(ZONA_OPTIONS.map(z => z.value));
const RE_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Iframe dialog Apps Script disajikan dari n-…-script.googleusercontent.com. localhost hanya
// di dev, untuk mencoba berkas HTML dialog di luar Google.
const ORIGIN_GOOGLE = /^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/;
const ORIGIN_DEV = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function corsHeaders(req: NextRequest): Record<string, string> {
    const origin = req.headers.get('origin');
    const izin = !!origin && (ORIGIN_GOOGLE.test(origin)
        || (process.env.NODE_ENV !== 'production' && ORIGIN_DEV.test(origin)));
    if (!izin) return { Vary: 'Origin' };
    return {
        Vary: 'Origin',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
    };
}

function balas(req: NextRequest, body: unknown, status = 200) {
    return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

function secretCocok(authHeader: string | null, secret: string): boolean {
    const diberikan = Buffer.from(authHeader?.replace(/^Bearer\s+/i, '') ?? '');
    const harapan = Buffer.from(secret);
    return diberikan.length === harapan.length && timingSafeEqual(diberikan, harapan);
}

/** null = lolos; selain itu respons galat yang langsung dikembalikan. */
function tolakAuth(req: NextRequest): NextResponse | null {
    const secret = process.env.KEDATANGAN_SHEET_SECRET;
    if (!secret) return balas(req, { error: 'KEDATANGAN_SHEET_SECRET belum diisi di env server' }, 503);
    if (!secretCocok(req.headers.get('authorization'), secret)) return balas(req, { error: 'Unauthorized' }, 401);
    return null;
}

function tanggalValid(s: unknown): s is string {
    if (typeof s !== 'string' || !RE_TANGGAL.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function OPTIONS(req: NextRequest) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
    const ditolak = tolakAuth(req);
    if (ditolak) return ditolak;
    try {
        const { berjalan, suppliers } = await fetchInfoKedatangan(createAdminClient());
        return balas(req, {
            default: detectCurrentShift(nowWIB()),
            zona: ZONA_OPTIONS,
            asal: ASAL_KEDATANGAN,
            metode: METODE_UNLOADING,
            berjalan,
            suppliers,
        });
    } catch (err) {
        console.error('[kedatangan-batubara] GET gagal:', err);
        return balas(req, { error: `Data pengiriman gagal dimuat: ${err instanceof Error ? err.message : String(err)}` }, 500);
    }
}

interface BodyPost {
    date?: unknown;
    shift?: unknown;
    lanjutan_batch_id?: unknown;
    entry?: Partial<Record<keyof CoalArrivalEntry, unknown>>;
}

export async function POST(req: NextRequest) {
    const ditolak = tolakAuth(req);
    if (ditolak) return ditolak;

    let body: BodyPost;
    try {
        body = await req.json();
    } catch {
        return balas(req, { error: 'body bukan JSON' }, 400);
    }

    const { date, shift, lanjutan_batch_id: lanjutanId } = body;
    const e = body.entry ?? {};
    if (!tanggalValid(date)) return balas(req, { error: 'Tanggal laporan tidak valid' }, 400);
    if (typeof shift !== 'string' || !SHIFTS.includes(shift as ShiftKey)) return balas(req, { error: 'Shift tidak valid' }, 400);
    const ton = typeof e.ton === 'number' ? e.ton : e.ton == null || e.ton === '' ? 0 : Number(e.ton);
    if (!Number.isFinite(ton) || ton < 0 || ton > TOTAL_KAPASITAS_TON) {
        return balas(req, { error: `Tonase harus angka 0–${TOTAL_KAPASITAS_TON.toLocaleString('id-ID')} ton` }, 400);
    }
    const status = e.status === 'selesai' ? 'selesai' : e.status === 'progres' ? 'progres' : null;
    if (!status) return balas(req, { error: 'Status tidak valid' }, 400);

    const supabase = createAdminClient();

    // Lanjutan: identitas tumpukan (supplier, pilar, tanggal masuk, asal) DIWARISI dari
    // induknya di server, bukan dipercaya dari dialog — sama seperti modal web yang
    // menguncinya, supaya pengiriman tetap satu tumpukan di denah.
    let entry: CoalArrivalEntry;
    if (lanjutanId != null && lanjutanId !== '') {
        if (typeof lanjutanId !== 'string') return balas(req, { error: 'Pengiriman lanjutan tidak valid' }, 400);
        let induk;
        try {
            induk = (await fetchInfoKedatangan(supabase)).berjalan.find(b => b.batch_id === lanjutanId);
        } catch (err) {
            return balas(req, { error: `Data pengiriman gagal dimuat: ${err instanceof Error ? err.message : String(err)}` }, 500);
        }
        if (!induk) {
            return balas(req, { error: 'Pengiriman itu sudah selesai atau dihapus di denah. Tutup lalu buka lagi form-nya.' }, 409);
        }
        const asal = (induk.asal ?? e.asal) as AsalKedatangan | null;
        entry = {
            batch_id: induk.batch_id,
            supplier: induk.supplier,
            zona: induk.zona,
            ton,
            tanggal_masuk: induk.tanggal_masuk,
            status,
            asal: asal === 'tongkang' || asal === 'darat' ? asal : null,
            metode_unloading: null,
        };
    } else {
        if (typeof e.batch_id !== 'string' || !RE_UUID.test(e.batch_id)) {
            return balas(req, { error: 'batch_id pengiriman baru harus UUID' }, 400);
        }
        if (!tanggalValid(e.tanggal_masuk)) return balas(req, { error: 'Tanggal mulai masuk storage tidak valid' }, 400);
        entry = {
            batch_id: e.batch_id.toLowerCase(),
            supplier: typeof e.supplier === 'string' ? e.supplier.trim() : '',
            zona: typeof e.zona === 'string' ? e.zona : '',
            ton,
            tanggal_masuk: e.tanggal_masuk,
            status,
            asal: e.asal === 'tongkang' || e.asal === 'darat' ? e.asal : null,
            metode_unloading: null,
        };
    }
    const metode = e.metode_unloading;
    entry.metode_unloading = entry.asal === 'tongkang' && (metode === 'conveyor' || metode === 'dump_truck')
        ? metode as MetodeUnloading : null;

    if (!ZONA_VALID.has(entry.zona)) return balas(req, { error: 'Pilar tidak dikenal' }, 400);
    if (!isKedatanganLengkap(entry)) {
        return balas(req, { error: 'Isian belum lengkap: asal, supplier, pilar, tonase (dan unloading via untuk tongkang) wajib' }, 400);
    }

    // Klik ganda / kirim ulang: baris identik barusan → pakai baris itu, jangan dobel.
    const sejak = new Date(Date.now() - JENDELA_DOBEL_MS).toISOString();
    const { data: kembar, error: errKembar } = await supabase.from('coal_arrivals')
        .select('id')
        .eq('batch_id', entry.batch_id).eq('date', date).eq('shift', shift)
        .eq('ton', entry.ton ?? 0).eq('status', entry.status)
        .gte('created_at', sejak)
        .limit(1);
    if (errKembar) console.warn('[kedatangan-batubara] cek dobel gagal:', errKembar.message);

    let id = (kembar ?? [])[0]?.id as string | undefined;
    if (!id) {
        const { data: baru, error } = await supabase.from('coal_arrivals').insert({
            batch_id: entry.batch_id, date, shift,
            supplier: entry.supplier, zona: entry.zona, ton: entry.ton ?? 0,
            tanggal_masuk: entry.tanggal_masuk, status: entry.status,
            asal: entry.asal, metode_unloading: entry.metode_unloading,
            keterangan: KETERANGAN_SUMBER, operator_id: null,
        }).select('id').single();
        if (error || !baru) {
            console.error('[kedatangan-batubara] insert gagal:', error);
            return balas(req, { error: `Gagal menyimpan: ${error?.message ?? 'tanpa id'}` }, 500);
        }
        id = baru.id as string;
    }

    // Tonase kumulatif pengiriman — yang juga tertulis di kolom H.
    const { data: barisBatch } = await supabase.from('coal_arrivals').select('ton').eq('batch_id', entry.batch_id);
    const tonKumulatif = (barisBatch ?? []).reduce((s, r) => s + (Number(r.ton) || 0), 0);

    // Kolom H Catatan: shift ini + shift sesudahnya di batch yang sama. BERURUTAN — dua
    // shift tanpa baris Catatan yang ditulis serentak bisa memilih nomor baris baru yang sama.
    const catatan: { date: string; shift: string; action: string; rowIndex?: number; reason?: string }[] = [];
    const galatCatatan: string[] = [];
    for (const t of await shiftTerdampakKedatangan(supabase, { date, shift }, [entry.batch_id])) {
        try {
            const r = await tulisCatatanShift(supabase, t.date, t.shift as ShiftKey);
            catatan.push({ date: t.date, shift: t.shift, action: r.action, rowIndex: r.rowIndex, reason: r.reason });
        } catch (err) {
            console.error(`[kedatangan-batubara] Catatan ${t.date}/${t.shift} gagal:`, err);
            galatCatatan.push(`${t.date}/${t.shift}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    return balas(req, {
        ok: true,
        id,
        batch_id: entry.batch_id,
        dobel: !!(kembar ?? [])[0],
        ringkasan: {
            date, shift,
            supplier: entry.supplier,
            zona: entry.zona,
            zonaLabel: labelZonaPendek(entry.zona),
            ton: entry.ton ?? 0,
            tonKumulatif,
            status: entry.status,
            asal: entry.asal,
            metode_unloading: entry.metode_unloading,
        },
        catatan,
        ...(galatCatatan.length > 0 && {
            warning: `Tersimpan di aplikasi, tapi kolom H Catatan gagal ditulis (${galatCatatan.join('; ')}). Akan ikut tertulis saat laporan shift disimpan.`,
        }),
    });
}
