/** Tipe client untuk viewer /critical-maintenance (item-centric; mirror payload API). */

/**
 * `uid` KOSONG untuk baris yang belum pernah difoto — identitasnya baru lahir saat foto
 * pertama tersimpan. Sampai saat itu barisnya dikenali lewat `rowIndex` + `sig`.
 */
export interface SheetCritical {
    uid: string;
    sig?: string;
    rowIndex: number;
    no: number | null;
    tanggal: string | null;
    tanggalRaw: string;
    pelapor: string;
    item: string;
    varian: string;
    uraian: string;
    notif: string;
    scope: string;
    status: string;
    tanggalOk: string | null;
    tanggalOkRaw: string;
    gabungan?: string;
    linkFoto?: string;
    pengOk: string;
}

export interface SheetMaintenance {
    uid: string;
    sig?: string;
    rowIndex: number;
    no: number | null;
    tanggal: string | null;
    tanggalRaw: string;
    shift: string;
    item: string;
    varian: string;
    uraian: string;
    scope: string;
    status: string;
    notifikasi: string;
    foreman: string;
    gabungan?: string;
    linkFoto?: string;
}

export interface ItemDetailResponse {
    key: string;
    itemName: string;
    variant: string;
    code: string;
    criticals: SheetCritical[];
    maintenances: SheetMaintenance[];
    fetchedAt: string;
    error?: string;
}

export interface SpecLine { label: string; value: string }

export interface ItemSpec {
    id: string;
    item_key: string;
    item_name: string;
    variant: string | null;
    code: string | null;
    description: string | null;
    specs: SpecLine[];
    updated_by: string | null;
    updated_at: string;
}

export interface SheetPhoto {
    id: string;
    parent_kind: 'critical' | 'maintenance';
    row_uid: string;
    /** URL publik R2 (`pub-*.r2.dev`). Disimpan apa adanya, tapi BUKAN sumber utama
     *  <img> — lihat photoSrc(). Dipakai sebagai cadangan bila proxy gagal. */
    url: string;
    filename: string;
    /** Satu record bisa berisi foto DAN video. Baris lama (sebelum video ada) = 'photo'. */
    media_kind: 'photo' | 'video';
    /** MIME asli — menentukan <source type> saat memutar video. Bisa null di baris lama. */
    mime_type: string | null;
    caption: string | null;
    uploaded_by: string | null;
    created_at: string;
}

/** Baris lama bisa belum punya media_kind; anggap foto. */
export function isVideo(p: SheetPhoto): boolean {
    return p.media_kind === 'video';
}

/** "3 foto" / "1 video" / "3 foto, 1 video" — kosong bila tidak ada apa-apa. */
export function mediaSummary(items: SheetPhoto[]): string {
    const video = items.filter(isVideo).length;
    const foto = items.length - video;
    return [foto ? `${foto} foto` : '', video ? `${video} video` : ''].filter(Boolean).join(', ');
}

/**
 * Sumber gambar: PROXY backend dulu (satu origin dengan aplikasi), R2 langsung cuma
 * cadangan — kebalikan dari sebelumnya.
 *
 * `pub-*.r2.dev` adalah endpoint development Cloudflare dan lazim diblokir/di-throttle
 * proxy perusahaan; di jaringan kantor operator, halaman & API lancar (lewat domain
 * aplikasi) tapi foto menggantung lama karena jaringan MEMBUANG paket ke r2.dev tanpa
 * menolaknya, sehingga `onError` di <img> baru menyala setelah TCP timeout. Fitur
 * critical yang lama sudah lebih dulu memakai proxy dengan alasan yang sama
 * (components/critical/PhotoGallery.tsx).
 *
 * Ongkosnya kecil: respons proxy immutable + ter-cache CDN Vercel, jadi hanya
 * permintaan pertama per foto yang membangunkan fungsi.
 */
export function photoSrc(photo: SheetPhoto): string {
    return photoProxySrc(photo.id);
}

/** Cadangan bila proxy gagal: URL R2 langsung (kalau memang tersimpan). */
export function photoDirectSrc(photo: SheetPhoto): string {
    return photo.url || photoProxySrc(photo.id);
}

export function photoProxySrc(id: string): string {
    return `/api/sheet-photos/${id}/file`;
}

/** Satu baris daftar record. Kolom khas satu tab diisi '' di tab lainnya
 *  (shift → maintenance, tanggalOk → critical). */
export interface RecentEntry {
    /** '' selama baris itu belum berfoto. Jangan dipakai sebagai React key — lihat rowKey(). */
    uid: string;
    kind: 'critical' | 'maintenance';
    /** Baris sheet 1-based + sidik jari isinya: identitas baris yang belum punya uid. */
    rowIndex: number;
    sig: string;
    tanggal: string | null;
    tanggalRaw: string;
    shift: string;
    itemName: string;
    variant: string;
    code: string;
    uraian: string;
    notifikasi: string;
    scope: string;
    status: string;
    pelapor: string;
    foreman: string;
    tanggalOkRaw: string;
    itemKey: string;
}

/**
 * Nama item sebagaimana ditulis operator: varian menempel di belakang nama, bukan
 * chip terpisah — "20 P-02.10 Phosphat Pump" + varian "D" → "20 P-02.10 Phosphat Pump D".
 * Varian dipakai apa adanya, jadi record gabungan tampil "… DEF" seperti di sheet.
 */
export function itemLabel(itemName: string, variant: string): string {
    const name = (itemName ?? '').replace(/\s+/g, ' ').trim();
    const v = (variant ?? '').replace(/\s+/g, ' ').trim();
    return v ? `${name} ${v}` : name;
}

export interface RecentResponse {
    items: RecentEntry[];
    total: number;
    page: number;
    pageSize: number;
    fetchedAt: string;
    error?: string;
}

// ─── Deep-link dari spreadsheet ──────────────────────────────────────────────

/**
 * Baris yang ditunjuk tautan dari sel/menu spreadsheet. `uid` ada bila barisnya sudah
 * berfoto; baris yang belum pernah difoto dikenali lewat `kind` + `rowIndex` + `sig`
 * (persis identitas yang dipakai saat foto pertamanya disimpan).
 */
export interface PhotoFocus {
    uid?: string;
    kind?: 'critical' | 'maintenance';
    rowIndex?: number;
    sig?: string;
    itemKey?: string;
    /**
     * Isi baris yang dititipkan menu spreadsheet di URL-nya. Ada = pop up bisa dirakit
     * SEKETIKA tanpa satu pun panggilan API; kosong (tautan lama, atau tautan dari sel
     * Dokumentasi) = jalur `fetchFocusRecord` seperti biasa.
     */
    isi?: { nama: string; varian: string; uraian: string; tanggalRaw: string };
}

/** Baca fokus dari query string; null bila tautannya memang bukan tautan record. */
export function readPhotoFocus(sp: { get(name: string): string | null }): PhotoFocus | null {
    const uid = (sp.get('foto') ?? '').trim();
    const kindRaw = (sp.get('kind') ?? '').trim();
    const kind = kindRaw === 'critical' || kindRaw === 'maintenance' ? kindRaw : undefined;
    const rowRaw = Number(sp.get('row'));
    const rowIndex = Number.isInteger(rowRaw) && rowRaw > 0 ? rowRaw : undefined;
    const sig = (sp.get('sig') ?? '').trim();
    // `ik` = kunci item yang dititipkan menu spreadsheet TANPA membuka halaman itemnya:
    // `item` merangkap penentu halaman, dan memuat seluruh riwayat item di belakang pop up
    // yang akan segera ditutup operator itu pekerjaan yang tidak ia minta. Tautan dari sel
    // Dokumentasi tetap memakai `item` — di situ halaman itemnya memang yang dituju.
    const itemKey = ((sp.get('ik') || sp.get('item')) ?? '').trim();

    const nama = (sp.get('nama') ?? '').trim();
    const uraian = (sp.get('uraian') ?? '').trim();

    // Nomor baris tanpa sidik jari tidak dipakai: nomor baris saja bisa basi begitu ada
    // penyisipan di atasnya, dan salah baris di sini berarti foto menempel ke record lain.
    const punyaBaris = kind !== undefined && rowIndex !== undefined && sig !== '';
    if (!uid && !punyaBaris) return null;

    // Isi hanya dipercaya bila barisnya juga jelas: tanpa row+sig, isi itu tidak punya
    // tujuan upload dan tidak ada yang bisa memverifikasinya nanti.
    const isi = punyaBaris && (nama || uraian)
        ? {
            nama,
            varian: (sp.get('varian') ?? '').trim(),
            uraian,
            tanggalRaw: (sp.get('tgl') ?? '').trim(),
        }
        : undefined;

    return {
        uid: uid || undefined,
        kind: punyaBaris ? kind : undefined,
        rowIndex: punyaBaris ? rowIndex : undefined,
        sig: punyaBaris ? sig : undefined,
        itemKey: itemKey || undefined,
        isi,
    };
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

/**
 * `bust` diisi HANYA setelah "Perbarui data" (atau `?refresh=1` dari spreadsheet).
 *
 * Kenapa perlu: respons daftar dan detail dilayani CDN dengan
 * `s-maxage=30, stale-while-revalidate=120`. Tanpa parameter yang berubah, fetch ulang
 * setelah refresh memakai URL yang sama persis, jadi yang menjawab adalah CDN — data
 * lama, dan tombolnya terasa tidak mempan. Dengan `t` yang berbeda, permintaannya jadi
 * URL baru dan route membalas `no-store`.
 */
export async function fetchRecent(params: {
    kind?: 'all' | 'critical' | 'maintenance'; q?: string; page?: number; pageSize?: number; bust?: number;
}): Promise<RecentResponse> {
    const qs = new URLSearchParams();
    if (params.kind) qs.set('kind', params.kind);
    if (params.q) qs.set('q', params.q);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    if (params.bust) qs.set('t', String(params.bust));
    const res = await fetch(`/api/critical-maintenance/recent?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal memuat aktivitas terbaru');
    return json as RecentResponse;
}

export async function fetchItemDetail(key: string, bust?: number): Promise<ItemDetailResponse> {
    const qs = new URLSearchParams({ key });
    if (bust) qs.set('t', String(bust));
    const res = await fetch(`/api/critical-maintenance/item?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal memuat detail item');
    return json as ItemDetailResponse;
}

/**
 * Barisnya tidak ada di cermin. Dibedakan dari kegagalan lain karena hanya keadaan INI yang
 * masuk akal dicoba ulang setelah sinkronisasi: baris yang baru diketik operator memang
 * belum sempat tercermin.
 */
export class FocusRowMissingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FocusRowMissingError';
    }
}

/**
 * Satu baris yang ditunjuk deep-link. Dipanggil SEBELUM halaman di belakangnya selesai
 * memuat, supaya pop up recordnya yang pertama kali terlihat operator.
 */
export async function fetchFocusRecord(f: PhotoFocus): Promise<RecentEntry> {
    const qs = new URLSearchParams();
    if (f.uid) qs.set('uid', f.uid);
    if (f.kind && f.rowIndex !== undefined && f.sig) {
        qs.set('kind', f.kind);
        qs.set('row', String(f.rowIndex));
        qs.set('sig', f.sig);
    }
    const res = await fetch(`/api/critical-maintenance/row?${qs.toString()}`);
    const json = await res.json();
    if (res.status === 404) throw new FocusRowMissingError(json.error ?? 'Baris tidak ditemukan');
    if (!res.ok) throw new Error(json.error ?? 'Gagal membuka record');
    return json.record as RecentEntry;
}

export async function fetchItemSpec(key: string): Promise<ItemSpec | null> {
    const res = await fetch(`/api/item-specs?key=${encodeURIComponent(key)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal memuat spesifikasi');
    return (json.spec ?? null) as ItemSpec | null;
}

export async function saveItemSpec(payload: {
    item_key: string; item_name: string; variant?: string; code?: string;
    description?: string; specs: SpecLine[]; updated_by?: string;
}): Promise<ItemSpec> {
    const res = await fetch('/api/item-specs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal menyimpan spesifikasi');
    return json.spec as ItemSpec;
}

/**
 * Ambil foto untuk sekumpulan row_uid. POST karena satu item bisa punya ratusan sampai
 * ribuan record — daftar uid sepanjang itu tidak muat di query string.
 */
export async function fetchSheetPhotos(uids: string[]): Promise<SheetPhoto[]> {
    const clean = uids.filter(Boolean);
    if (clean.length === 0) return [];
    const res = await fetch('/api/sheet-photos/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids: clean }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal memuat foto');
    return (json.photos ?? []) as SheetPhoto[];
}
