import { SupabaseClient } from '@supabase/supabase-js';
import { labelAsal, labelLetakCatatan, labelMetode, rankShift } from './coal-storage';
import type { ShiftKey } from './constants';

// ─────────────────────────────────────────────────────────────────────────────
// SUMBER TUNGGAL "Catatan Operasional" shift. Dipakai oleh publish-shift (washift
// text, Review, PDF), laporan-shift view, DAN agregasi harian — supaya isinya IDENTIK.
// Format: SATU blok, tiap baris jadi bullet "• ", tanpa label per-station
// (permintaan user: "semua jadi satu, jangan dibedakan; tiap catatan jadi bullet").
// ─────────────────────────────────────────────────────────────────────────────

const SHIFT_LABEL_PUBLISH: Record<string, string> = { malam: 'Shift Malam', pagi: 'Shift Pagi', sore: 'Shift Sore' };

/** Format {date,shift} → "DD/MM Shift X". */
export function formatBerasapSince(info: { date: string; shift: string } | null | undefined): string {
    if (!info || !info.date) return '';
    const [y, m, d] = info.date.split('-').map(Number);
    if (!y || !m || !d) return '';
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} ${SHIFT_LABEL_PUBLISH[info.shift] || info.shift}`;
}

const STATION_CATATAN_ORDER = ['panel_boiler', 'panel_boiler_a', 'panel_boiler_b', 'panel_turbin'];

/** Gabungkan catatan utama + catatan tiap station jadi satu, tanpa label. */
export function mergeShiftCatatan(mainCatatan: string | null | undefined, stationCatatan: Record<string, string> | null | undefined): string {
    const parts: string[] = [];
    const main = (mainCatatan ?? '').trim();
    if (main) parts.push(main);
    const sc = stationCatatan ?? {};
    for (const key of STATION_CATATAN_ORDER) {
        const note = (sc[key] ?? '').trim();
        if (note) parts.push(note);
    }
    return parts.join('\n');
}

// Baris aktivitas dari tabel: kedatangan/permintaan solar & unloading fly ash.
// PENTING: kalimat di bawah punya DUA salinan lain yang harus ikut kalau diubah —
// pratinjau klien di components/input-shift/TabCatatanOperasional.tsx
// (buildAutoCatatanLines) dan pola RE_FLY_ASH/RE_SOLAR di bawah berkas ini yang
// dipakai memisahkan baris ke kolom sheet-nya masing-masing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildActivityLines(internal: { ash?: any[]; solarIn?: any[]; solarOut?: any[] } | undefined): string[] {
    const lines: string[] = [];
    for (const s of internal?.solarIn ?? []) {
        const liters = Number(s.liters);
        if (liters > 0) lines.push(`Kedatangan solar dari ${s.supplier ?? '-'} sebanyak ${liters.toLocaleString('id-ID')} L`);
    }
    for (const s of internal?.solarOut ?? []) {
        const liters = Number(s.liters);
        if (liters > 0) lines.push(`Permintaan solar ke ${s.tujuan ?? '-'} sebanyak ${liters.toLocaleString('id-ID')} L`);
    }
    for (const a of internal?.ash ?? []) {
        const ritase = Number(a.ritase);
        if (ritase > 0) lines.push(`Unloading fly ash Silo ${a.silo ?? '-'} sebanyak ${ritase}rit ke ${a.tujuan || '-'}`);
    }
    return lines;
}

/** Kolom coal_arrivals yang dibutuhkan blok kolom H. */
export const KOLOM_KEDATANGAN_CATATAN = 'id, batch_id, date, shift, supplier, zona, ton, status, asal, metode_unloading, created_at';

export interface BarisKedatanganCatatan {
    id?: string;
    batch_id: string;
    date: string;
    shift: string;
    supplier: string | null;
    zona: string | null;
    ton: number | string | null;
    status: string | null;
    asal: string | null;
    metode_unloading: string | null;
    created_at: string | null;
}

/** Urutan kronologis satu baris kedatangan: (tanggal, shift malam→pagi→sore), lalu waktu input. */
function bandingkanUrutan(a: BarisKedatanganCatatan, b: BarisKedatanganCatatan): number {
    return rankShift(a.date, a.shift as ShiftKey) - rankShift(b.date, b.shift as ShiftKey)
        || (a.created_at ?? '').localeCompare(b.created_at ?? '');
}

// Blok kedatangan batubara dari coal_arrivals untuk kolom H sheet Catatan. SENGAJA tidak
// masuk buildActivityLines maupun teks kanonik: permintaan user (9 Okt 2026) kedatangan
// hanya ke kolom H, TIDAK ikut WA. Formatnya log yang dipakai user di sheet itu
// (12 Okt 2026), satu blok per PENGIRIMAN per shift, antar blok baris kosong:
//
//   Kedatangan Batubara Tongkang
//   Nama : BG SAKHAMAS
//   Via : Conveyor                          (Conveyor / Dump Truck; darat → Darat)
//   Letak : Close Storage Zona pilar 4–5
//   Tonase : 5.100 ton                      (KUMULATIF pengiriman s.d. shift ini)
//   Status : IP                             (IP / Selesai)
//
// `semuaBarisBatch` = seluruh baris batch-batch yang muncul di shift ini (semua shift),
// bahan tonase kumulatif. Baris penutup (lanjutan bertonase 0) ikut ditulis: di format
// ini justru dialah yang membawa "Status : Selesai".
export function buildCoalArrivalBlocks(
    barisShift: BarisKedatanganCatatan[] | null | undefined,
    semuaBarisBatch: BarisKedatanganCatatan[] | null | undefined = [],
): string[] {
    const perBatch = new Map<string, BarisKedatanganCatatan[]>();
    for (const r of [...(barisShift ?? [])].sort(bandingkanUrutan)) {
        const daftar = perBatch.get(r.batch_id) ?? [];
        daftar.push(r);
        perBatch.set(r.batch_id, daftar);
    }

    const blok: string[] = [];
    for (const [batchId, daftar] of perBatch) {
        const terakhir = daftar[daftar.length - 1];
        // Kumulatif = semua baris batch ini yang tidak lebih baru dari baris terakhirnya di
        // shift ini. Baris shift ini sendiri selalu ikut, walau kueri batch gagal.
        const sebelumnya = (semuaBarisBatch ?? []).filter(r =>
            r.batch_id === batchId && bandingkanUrutan(r, terakhir) <= 0
            && !daftar.some(d => d.id !== undefined && d.id === r.id));
        const kumulatif = [...sebelumnya, ...daftar].reduce((s, r) => s + (Number(r.ton) || 0), 0);

        // Asal milik pengiriman (dikunci untuk lanjutan); metode bisa berganti antar shift,
        // bahkan dalam satu shift kalau conveyor berhenti — tulis semuanya.
        const asal = daftar.find(r => r.asal)?.asal ?? null;
        let metode = [...new Set(daftar.map(r => labelMetode(r.metode_unloading)).filter(Boolean))];
        // Baris penutup tak punya metode sendiri → pakai metode terakhir pengiriman ini.
        if (metode.length === 0) {
            const terakhirBermetode = sebelumnya.filter(r => r.metode_unloading).sort(bandingkanUrutan).pop();
            if (terakhirBermetode) metode = [labelMetode(terakhirBermetode.metode_unloading)];
        }
        const via = asal === 'darat' ? 'Darat' : (metode.join(' + ') || '-');
        const zona = terakhir.zona ?? daftar.find(r => r.zona)?.zona ?? null;

        blok.push([
            `Kedatangan Batubara${asal ? ` ${labelAsal(asal)}` : ''}`,
            `Nama : ${terakhir.supplier || '-'}`,
            `Via : ${via}`,
            `Letak : ${zona ? labelLetakCatatan(zona) : '-'}`,
            `Tonase : ${kumulatif.toLocaleString('id-ID')} ton`,
            `Status : ${terakhir.status === 'selesai' ? 'Selesai' : 'IP'}`,
        ].join('\n'));
    }
    return blok;
}

// Baris "Bunker X berasap sejak ..." dari status bunker + history (berasapSince).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeBunkerBerasapLines(coal: any, date: string, shift: string, berasapSince: Record<string, { date: string; shift: string } | null>): string[] {
    if (!coal) return [];
    return ['a', 'b', 'c', 'd', 'e', 'f']
        .filter(k => String(coal[`status_bunker_${k}`] ?? '').toLowerCase() === 'berasap')
        .map(k => {
            const since = berasapSince[`status_bunker_${k}`] ?? { date, shift };
            const s = formatBerasapSince(since);
            return s ? `Bunker ${k.toUpperCase()} berasap sejak ${s}` : `Bunker ${k.toUpperCase()} berasap`;
        });
}

/** Hitung kapan tiap bunker mulai berasap (walk-back shift berturut berstatus Berasap). */
export async function fetchBunkerBerasapSince(
    supabase: SupabaseClient,
    date: string,
    shift: string,
): Promise<Record<string, { date: string; shift: string } | null>> {
    const BUNKER_KEYS = ['status_bunker_a', 'status_bunker_b', 'status_bunker_c', 'status_bunker_d', 'status_bunker_e', 'status_bunker_f'];
    const { data } = await supabase
        .from('shift_reports')
        .select('date, shift, shift_coal_bunker(status_bunker_a, status_bunker_b, status_bunker_c, status_bunker_d, status_bunker_e, status_bunker_f)')
        .lte('date', date)
        .order('date', { ascending: false })
        .limit(30);
    const shiftOrder: Record<string, number> = { sore: 2, pagi: 1, malam: 0 };
    const sorted = ((data ?? []) as { date: string; shift: string; shift_coal_bunker: Record<string, string | null>[] | Record<string, string | null> | null }[])
        .filter(r => {
            if (r.date === date && r.shift === shift) return false;
            if (r.date === date && (shiftOrder[r.shift] ?? 0) >= (shiftOrder[shift] ?? 0)) return false;
            return true;
        })
        .sort((a, b) => a.date !== b.date ? b.date.localeCompare(a.date) : (shiftOrder[b.shift] || 0) - (shiftOrder[a.shift] || 0));
    const result: Record<string, { date: string; shift: string } | null> = {};
    for (const key of BUNKER_KEYS) {
        let since: { date: string; shift: string } | null = null;
        for (const r of sorted) {
            const cb = Array.isArray(r.shift_coal_bunker) ? r.shift_coal_bunker[0] : r.shift_coal_bunker;
            if (!cb) break;
            if (String(cb[key] ?? '').toLowerCase() === 'berasap') since = { date: r.date, shift: r.shift };
            else break;
        }
        result[key] = since;
    }
    return result;
}

/** Jadikan tiap baris non-kosong sebagai bullet "• " (idempotent — tak dobel kalau sudah bullet). */
export function toBullets(text: string): string {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => (l.startsWith('•') ? l : `• ${l}`)).join('\n');
}

/** Catatan Operasional shift KANONIK = manual (gabungan station) + solar/fly ash + bunker
 *  berasap, satu blok, tiap baris bullet. Dedup terhadap catatan manual. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildOperationalCatatan(report: any, internal: { ash?: any[]; solarIn?: any[]; solarOut?: any[] } | undefined, bunkerLines: string[] = []): string {
    const manual = mergeShiftCatatan(report.catatan as string | null, report.station_catatan as Record<string, string> | null);
    const parts: string[] = [];
    if (manual.trim()) parts.push(manual.trim());
    for (const line of [...buildActivityLines(internal), ...bunkerLines]) {
        if (!manual.includes(line)) parts.push(line);
    }
    return toBullets(parts.join('\n'));
}

const SHIFT_ORD: Record<string, number> = { malam: 0, pagi: 1, sore: 2 };
const SHIFT_LBL: Record<string, string> = { malam: 'Shift Malam', pagi: 'Shift Pagi', sore: 'Shift Sore' };

/** Catatan Operasional level-HARI: blok per-shift berlabel (urut Malam → Pagi → Sore).
 *  Tiap shift: catatan kanonik shift itu (gabungan station + aktivitas, bullet) atau
 *  "tidak ada catatan". `upToShift` membatasi sampai shift tsb (untuk review SHIFT:
 *  tampilkan shift-shift sebelumnya s/d shift berjalan); undefined = ketiga shift (HARIAN). */
export async function buildDayCatatanLabeled(supabase: SupabaseClient, date: string, upToShift?: string): Promise<string> {
    const shifts = ['malam', 'pagi', 'sore'].filter(s => upToShift == null || SHIFT_ORD[s] <= (SHIFT_ORD[upToShift] ?? 2));
    const { data: rows } = await supabase
        .from('shift_reports')
        .select('date, shift, catatan, station_catatan, shift_coal_bunker(*)')
        .eq('date', date)
        .in('shift', shifts);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byShift: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (rows ?? []) as any[]) byShift[r.shift] = r;
    const blocks: string[] = [];
    for (const s of shifts) {
        const row = byShift[s];
        const cat = row ? (await getShiftCatatanCanonical(supabase, row)).trim() : '';
        blocks.push(`*${SHIFT_LBL[s]}:*\n${cat || 'tidak ada catatan'}`);
    }
    return blocks.join('\n\n');
}

/** Catatan Operasional kanonik untuk SATU shift report row — fetch solar/ash + bunker,
 *  lalu rakit lewat builder. shiftRow wajib punya: date, shift, catatan, station_catatan,
 *  shift_coal_bunker. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getShiftCatatanCanonical(supabase: SupabaseClient, shiftRow: any): Promise<string> {
    const date = shiftRow.date as string;
    const shift = shiftRow.shift as string;
    const [{ data: ashRows }, { data: solarInRows }, { data: solarOutRows }] = await Promise.all([
        supabase.from('ash_unloadings').select('silo, perusahaan, tujuan, ritase').eq('date', date).eq('shift', shift),
        supabase.from('solar_unloadings').select('supplier, liters').eq('date', date).eq('shift', shift),
        supabase.from('solar_usages').select('tujuan, liters').eq('date', date).eq('shift', shift),
    ]);
    const internal = { ash: ashRows ?? [], solarIn: solarInRows ?? [], solarOut: solarOutRows ?? [] };
    const berasapSince = await fetchBunkerBerasapSince(supabase, date, shift);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coal = Array.isArray(shiftRow.shift_coal_bunker) ? (shiftRow.shift_coal_bunker as any[])[0] : (shiftRow.shift_coal_bunker ?? null);
    const bunkerLines = computeBunkerBerasapLines(coal, date, shift, berasapSince);
    return buildOperationalCatatan(shiftRow, internal, bunkerLines);
}

// ─── Partisi per kolom sheet Catatan ─────────────────────────────────────────
//
// Sheet Catatan (gid 457458234) berkolom per kategori, bukan satu kolom teks:
//   D = Operasional · E = Switch Equipment · F = Unloading Fly Ash
//   G = In-Out Solar · H = In-Out Batubara
// Dulu semuanya ditumpuk di kolom D. Pemisahan dilakukan di TEKS KANONIK yang
// sudah jadi, bukan di buildActivityLines, karena baris fly ash/solar biasanya
// sudah disuntikkan ke textarea catatan oleh app/input-laporan/page.tsx sebelum
// submit — jadi saat sampai sini ia sudah menyatu dengan catatan manual.
// Mempartisi (bukan membangun ulang dari tabel ash_unloadings) juga menjaga
// catatan fly ash yang diketik operator sendiri tanpa entri tabel tetap terbawa.

/** Pola baris yang punya kolom sendiri. Dicocokkan SETELAH prefiks bullet dilepas.
 *  Diturunkan dari template di buildActivityLines — ubah di sana, ubah juga di sini. */
const RE_FLY_ASH = /^unloading fly ash\b/i;
const RE_SOLAR = /^(kedatangan solar\b|permintaan solar\b)/i;
const RE_BATUBARA = /^kedatangan batubara\b/i;

export interface CatatanPerKolom {
    /** Kolom D — catatan manual operator + bunker berasap + sisanya. */
    operasional: string;
    /** Kolom F — Unloading Fly Ash. */
    flyAsh: string;
    /** Kolom G — In-Out Solar. */
    solar: string;
    /** Kolom H — In-Out Batubara (kedatangan dari coal_arrivals; tidak ikut WA). */
    batubara: string;
}

/** Kolom tujuan satu baris catatan. Dipakai partisi di bawah DAN skrip pemindahan
 *  baris lama, supaya keduanya memakai aturan yang sama persis. */
export function klasifikasiBarisCatatan(line: string): keyof CatatanPerKolom {
    // Lepas bullet (dan sisa penanda zero-width) supaya pola bisa dianchor ke
    // awal kalimat.
    const bare = (line ?? '').replace(/[⁠​‌]/g, '').trim().replace(/^•\s*/, '');
    if (RE_FLY_ASH.test(bare)) return 'flyAsh';
    if (RE_SOLAR.test(bare)) return 'solar';
    if (RE_BATUBARA.test(bare)) return 'batubara';
    return 'operasional';
}

/** Pecah catatan kanonik jadi empat ember sesuai kolomnya di sheet. LOSSLESS:
 *  tiap baris non-kosong masuk tepat satu ember, tidak ada yang dibuang, dan
 *  urutan baris dalam tiap ember tetap seperti aslinya. `blokBatubara` = blok
 *  kedatangan dari tabel (buildCoalArrivalBlocks) yang memang tidak ada di teks
 *  kanonik karena tidak boleh ikut WA. */
export function partisiCatatanPerKolom(canonical: string, blokBatubara: string[] = []): CatatanPerKolom {
    const ember: Record<keyof CatatanPerKolom, string[]> = { operasional: [], flyAsh: [], solar: [], batubara: [] };
    for (const raw of (canonical ?? '').split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        ember[klasifikasiBarisCatatan(line)].push(line);
    }
    const { operasional, flyAsh, solar, batubara } = ember;
    // Blok kedatangan ditempel apa adanya: multi-baris, TANPA bullet (format log user),
    // dipisah baris kosong — tidak boleh lewat toBullets yang mem-bullet tiap barisnya.
    const kolomH = [toBullets(batubara.join('\n')), ...blokBatubara.map(b => b.trim())].filter(Boolean);
    // toBullets idempoten — baris yang sudah ber-bullet dibiarkan apa adanya.
    return {
        operasional: toBullets(operasional.join('\n')),
        flyAsh: toBullets(flyAsh.join('\n')),
        solar: toBullets(solar.join('\n')),
        batubara: kolomH.join('\n\n'),
    };
}

/** Catatan shift, sudah terpisah per kolom sheet. Dibangun di atas
 *  getShiftCatatanCanonical supaya dedup manual-vs-otomatis, urutan station, dan
 *  baris bunker berasap tetap berlaku sama persis. Kedatangan batubara ditambahkan
 *  DI SINI saja (kolom H), bukan di teks kanonik — teks kanonik itulah yang ke WA. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getShiftCatatanPerKolom(supabase: SupabaseClient, shiftRow: any): Promise<CatatanPerKolom> {
    const [canonical, blok] = await Promise.all([
        getShiftCatatanCanonical(supabase, shiftRow),
        blokKedatanganShift(supabase, shiftRow.date as string, shiftRow.shift as string),
    ]);
    return partisiCatatanPerKolom(canonical, blok);
}

/** Blok kolom H (kedatangan batubara) satu shift, langsung dari tabel coal_arrivals —
 *  tidak butuh laporan shift. Dipakai getShiftCatatanPerKolom dan jalur Catatan untuk
 *  shift yang laporannya belum ada (kedatangan dari menu spreadsheet). */
export async function blokKedatanganShift(supabase: SupabaseClient, date: string, shift: string): Promise<string[]> {
    const { data: coalRows } = await supabase.from('coal_arrivals').select(KOLOM_KEDATANGAN_CATATAN)
        .eq('date', date).eq('shift', shift)
        .order('created_at', { ascending: true });
    const barisShift = (coalRows ?? []) as unknown as BarisKedatanganCatatan[];
    // Tonase di blok = kumulatif per pengiriman, jadi butuh baris shift-shift lain dari
    // batch yang sama. Gagal muat → kumulatif cuma dari shift ini, blok tetap tertulis.
    const batchIds = [...new Set(barisShift.map(r => r.batch_id))];
    let semuaBarisBatch: BarisKedatanganCatatan[] = [];
    if (batchIds.length > 0) {
        const { data, error } = await supabase.from('coal_arrivals')
            .select(KOLOM_KEDATANGAN_CATATAN).in('batch_id', batchIds);
        if (error) console.warn('[shift-catatan] baris batch kedatangan gagal dimuat:', error.message);
        else semuaBarisBatch = (data ?? []) as unknown as BarisKedatanganCatatan[];
    }
    return buildCoalArrivalBlocks(barisShift, semuaBarisBatch);
}
