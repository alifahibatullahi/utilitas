/**
 * Klien E-Logsheet APM (DILOC, apm.petrokimia-gresik.com) — sisi server saja.
 *
 * APM adalah Laravel + Inertia: halaman `/elogsheet/{unitId}?date=YYYY-MM-DD` sudah memuat
 * SELURUH isi logsheet satu hari (slot tiap 2 jam, 00:00…22:00) sebagai JSON di atribut
 * `data-page`. Jadi tidak perlu tombol Export / file Excel — link `blob:` hasil Export
 * hanya hidup di tab browser yang membuatnya dan tidak bisa diambil server.
 *
 * Login lewat OneKey = Keycloak (realm `pkg`, client `apm`, authorization code):
 *   GET  /keycloak/redirect          → 302 ke form Keycloak
 *   POST form #kc-form-login         → 302 ke /keycloak/callback?code=…
 *   GET  /keycloak/callback          → APM memasang cookie sesi Laravel
 * Cookie disimpan (lihat lib/apm/sync.ts) supaya login hanya terjadi saat sesi habis.
 */

export const APM_BASE = 'https://apm.petrokimia-gresik.com';

/** Batas satu request. fetch tanpa timeout pernah membuat cron menggantung (insiden Wablas). */
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 10;

/** Sesi APM tidak berlaku lagi (dialihkan ke halaman masuk) — login ulang lalu coba lagi. */
export class ApmSessionExpired extends Error {
    constructor() {
        super('Sesi APM habis');
        this.name = 'ApmSessionExpired';
    }
}

/**
 * Keycloak menolak kredensial (atau meminta langkah yang tidak bisa diotomasi, mis. OTP).
 * JANGAN dicoba ulang dengan kredensial yang sama: Keycloak mengunci akun setelah beberapa
 * kali gagal, dan ini akun pribadi operator.
 */
export class ApmLoginRejected extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ApmLoginRejected';
    }
}

// ─── Cookie jar ───

interface StoredCookie {
    name: string;
    value: string;
    domain: string;
    /** true = hanya host persis (tanpa atribut Domain). */
    hostOnly: boolean;
    /** epoch ms; null = cookie sesi. */
    expires: number | null;
}

/** Cookie jar minimal: cukup untuk alur APM + Keycloak (path diabaikan). */
export class CookieJar {
    private cookies: StoredCookie[];

    constructor(serialized?: string | null) {
        this.cookies = [];
        if (!serialized) return;
        try {
            const parsed = JSON.parse(serialized);
            if (Array.isArray(parsed)) this.cookies = parsed as StoredCookie[];
        } catch {
            // Isi rusak = mulai dari jar kosong; akibatnya cuma satu kali login ulang.
        }
    }

    serialize(): string {
        return JSON.stringify(this.cookies.filter(c => !this.isExpired(c)));
    }

    header(url: URL): string {
        const host = url.hostname;
        return this.cookies
            .filter(c => !this.isExpired(c))
            .filter(c => (c.hostOnly ? host === c.domain : host === c.domain || host.endsWith('.' + c.domain)))
            .map(c => `${c.name}=${c.value}`)
            .join('; ');
    }

    store(url: URL, res: Response): void {
        for (const raw of res.headers.getSetCookie()) {
            const [pair, ...attrs] = raw.split(';');
            const eq = pair.indexOf('=');
            if (eq <= 0) continue;
            const name = pair.slice(0, eq).trim();
            const value = pair.slice(eq + 1).trim();

            let domain = url.hostname;
            let hostOnly = true;
            let expires: number | null = null;
            for (const attr of attrs) {
                const [k, ...v] = attr.trim().split('=');
                const key = k.toLowerCase();
                const val = v.join('=').trim();
                if (key === 'domain' && val) {
                    domain = val.replace(/^\./, '').toLowerCase();
                    hostOnly = false;
                } else if (key === 'max-age') {
                    expires = Date.now() + Number(val) * 1000;
                } else if (key === 'expires' && expires === null) {
                    const t = Date.parse(val);
                    if (!Number.isNaN(t)) expires = t;
                }
            }

            this.cookies = this.cookies.filter(c => !(c.name === name && c.domain === domain));
            const entry: StoredCookie = { name, value, domain, hostOnly, expires };
            if (!this.isExpired(entry) && value !== '') this.cookies.push(entry);
        }
    }

    private isExpired(c: StoredCookie): boolean {
        return c.expires !== null && c.expires <= Date.now();
    }
}

// ─── Hasil parse logsheet ───

export interface ApmParameter {
    id: number;
    tag: string;
    name: string;
    unit: string | null;
}

export interface ApmReading {
    paramId: number;
    /** "HH:MM" — slot logsheet, waktu WIB pada `date`. */
    slot: string;
    /** Nilai mentah apa adanya ("50", "14.7", "rusak", …). */
    raw: string;
    /** ISO dengan offset WIB; kapan operator mengetik nilainya. */
    recordedAt: string | null;
}

export interface ApmUnitDay {
    unitId: number;
    date: string;
    params: ApmParameter[];
    readings: ApmReading[];
}

// ─── Klien ───

export class ApmClient {
    readonly jar: CookieJar;
    /** Batas waktu total (epoch ms) untuk SEMUA request klien ini. */
    private readonly deadline: number;

    constructor(opts: { cookies?: string | null; budgetMs: number }) {
        this.jar = new CookieJar(opts.cookies);
        this.deadline = Date.now() + opts.budgetMs;
    }

    /** Satu hop tanpa mengikuti redirect, dengan cookie jar dan sisa anggaran waktu. */
    private async hop(url: URL, init: RequestInit = {}): Promise<Response> {
        const sisa = this.deadline - Date.now();
        if (sisa < 1_000) throw new Error('Anggaran waktu sync APM habis');

        const headers = new Headers(init.headers);
        const cookie = this.jar.header(url);
        if (cookie) headers.set('Cookie', cookie);
        headers.set('User-Agent', 'PowerOps-Dashboard/1.0');

        const res = await fetch(url, {
            ...init,
            headers,
            redirect: 'manual',
            signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, sisa)),
        });
        this.jar.store(url, res);
        return res;
    }

    /** Ikuti redirect secara manual supaya cookie tiap hop (APM & Keycloak) tertangkap. */
    private async follow(start: URL, init: RequestInit = {}): Promise<{ res: Response; url: URL }> {
        let url = start;
        let res = await this.hop(url, init);
        for (let i = 0; i < MAX_REDIRECTS && res.status >= 300 && res.status < 400; i++) {
            const loc = res.headers.get('location');
            if (!loc) break;
            await res.body?.cancel();
            url = new URL(loc, url);
            res = await this.hop(url);
        }
        return { res, url };
    }

    /**
     * Login lewat Keycloak. Kalau cookie SSO Keycloak (rememberMe) masih berlaku, Keycloak
     * langsung mengembalikan ke APM tanpa form — password tidak terkirim sama sekali.
     */
    async login(username: string, password: string): Promise<void> {
        const awal = await this.follow(new URL('/keycloak/redirect', APM_BASE));
        if (this.isApmAuthenticated(awal.url, awal.res)) {
            await awal.res.body?.cancel();
            return;
        }

        const html = await awal.res.text();
        const action = extractLoginFormAction(html);
        if (!action) {
            throw new Error(`Form login Keycloak tidak ditemukan (HTTP ${awal.res.status} di ${awal.url.host})`);
        }

        const body = new URLSearchParams({ username, password, rememberMe: 'on', credentialId: '' });
        const hasil = await this.follow(new URL(action, awal.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        // Kembali ke APM = Keycloak menerima kredensial. Sesinya dibuktikan oleh fetch
        // berikutnya (lib/apm/sync.ts), bukan ditebak dari halaman tujuan redirect.
        if (hasil.url.origin === APM_BASE) {
            await hasil.res.body?.cancel();
            return;
        }

        // Hanya form Keycloak yang tampil lagi yang boleh disimpulkan "kredensial ditolak":
        // kesimpulan itu memblokir sync sampai env diganti, jadi jangan dipakai untuk
        // kegagalan lain (Keycloak down, halaman tak dikenal, dsb.).
        const isi = await hasil.res.text();
        if (/name="(otp|totp)"/i.test(isi)) {
            throw new ApmLoginRejected('Akun APM meminta OTP — login otomatis tidak bisa dipakai');
        }
        if (extractLoginFormAction(isi) !== null) {
            const pesan = extractKeycloakError(isi);
            throw new ApmLoginRejected(pesan ? `Login APM ditolak: ${pesan}` : 'Login APM ditolak (form login tampil lagi)');
        }
        throw new Error(`Login APM gagal (HTTP ${hasil.res.status} di ${hasil.url.host}${hasil.url.pathname})`);
    }

    /** Diagnostik tanpa kredensial: apakah alur sampai ke form login Keycloak dari sini? */
    async probeLoginPage(): Promise<{ status: number; host: string; formFound: boolean }> {
        const { res, url } = await this.follow(new URL('/keycloak/redirect', APM_BASE));
        const html = await res.text();
        return { status: res.status, host: url.host, formFound: extractLoginFormAction(html) !== null };
    }

    /** Tiba di APM dan bukan di halaman masuk ("/") = sudah login. */
    private isApmAuthenticated(url: URL, res: Response): boolean {
        return url.origin === APM_BASE && res.status === 200 && url.pathname !== '/' && !url.pathname.startsWith('/keycloak');
    }

    /** Ambil isi logsheet satu unit untuk satu tanggal (YYYY-MM-DD, kalender WIB). */
    async fetchUnitDay(unitId: number, date: string): Promise<ApmUnitDay> {
        const url = new URL(`/elogsheet/${unitId}`, APM_BASE);
        url.searchParams.set('date', date);

        const res = await this.hop(url, { headers: { Accept: 'text/html' } });
        if (res.status >= 300 && res.status < 400) {
            await res.body?.cancel();
            throw new ApmSessionExpired();
        }
        if (!res.ok) {
            await res.body?.cancel();
            throw new Error(`APM /elogsheet/${unitId} HTTP ${res.status}`);
        }
        return parseUnitDay(unitId, date, await res.text());
    }
}

// ─── Parser (diekspor untuk diuji tanpa jaringan) ───

function decodeHtmlAttr(s: string): string {
    return s
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&amp;/g, '&');
}

export function extractLoginFormAction(html: string): string | null {
    const form = html.match(/<form[^>]*id="kc-form-login"[^>]*>/i)?.[0];
    const action = form?.match(/action="([^"]+)"/i)?.[1];
    return action ? decodeHtmlAttr(action) : null;
}

function extractKeycloakError(html: string): string | null {
    const m = html.match(/id="input-error[^"]*"[^>]*>([\s\S]*?)</i)
        ?? html.match(/class="[^"]*(?:kc-feedback-text|alert-error)[^"]*"[^>]*>([\s\S]*?)</i);
    const text = m?.[1]?.replace(/\s+/g, ' ').trim();
    return text ? decodeHtmlAttr(text) : null;
}

/** "2026-10-28 09:13:27" (WIB) → ISO dengan offset +07:00. */
function wibToIso(s: unknown): string | null {
    if (typeof s !== 'string') return null;
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/);
    return m ? `${m[1]}T${m[2].length === 5 ? m[2] + ':00' : m[2]}+07:00` : null;
}

interface InertiaParam { id: number; tag: string | null; name: string; unit: string | null }
interface InertiaPage {
    component: string;
    props: {
        processes?: { parameters?: InertiaParam[] }[];
        existingData?: Record<string, { value?: unknown; recorded_at?: unknown }>;
    };
}

export function parseUnitDay(unitId: number, date: string, html: string): ApmUnitDay {
    const m = html.match(/data-page="([^"]*)"/);
    if (!m) throw new Error(`APM /elogsheet/${unitId}: data-page tidak ditemukan (format halaman berubah?)`);
    const page = JSON.parse(decodeHtmlAttr(m[1])) as InertiaPage;

    const params: ApmParameter[] = (page.props.processes ?? [])
        .flatMap(pr => pr.parameters ?? [])
        .filter(p => typeof p.tag === 'string' && p.tag !== '')
        .map(p => ({ id: p.id, tag: p.tag as string, name: p.name, unit: p.unit }));

    // Kunci nilai = "<paramId>-<HH:MM>"; "status_<paramId>-<HH:MM>" = status sel (diabaikan).
    // Nama operator (recorded_by_name) sengaja tidak dibawa keluar dari sini.
    const readings: ApmReading[] = [];
    for (const [key, cell] of Object.entries(page.props.existingData ?? {})) {
        const km = key.match(/^(\d+)-(\d{2}:\d{2})$/);
        if (!km || cell?.value === null || cell?.value === undefined) continue;
        const raw = String(cell.value).trim();
        if (raw === '') continue;
        readings.push({ paramId: Number(km[1]), slot: km[2], raw, recordedAt: wibToIso(cell.recorded_at) });
    }

    return { unitId, date, params, readings };
}

/** "14,7" / "14.7" → 14.7; selain angka → null (nilai mentah tetap disimpan sebagai teks). */
export function parseApmNumber(raw: string): number | null {
    const s = raw.replace(/\s/g, '').replace(',', '.');
    if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}
