/**
 * Agen PC kantor: salin E-Logsheet APM ke PowerOps (dijalankan Task Scheduler tiap jam).
 *
 * APM hanya bisa dibuka dari IP Indonesia — server Vercel ditolak 403 — jadi login dan
 * pengambilan dijalankan di sini, lalu hasilnya dikirim ke /api/apm/ingest. Dibundel jadi
 * satu berkas oleh `npm run build:apm-agent` (dist/apm-agent/, lihat BACA-SAYA.txt).
 *
 *   node apm-agent.js                 ambil dari APM + kirim ke PowerOps
 *   node apm-agent.js --coba          login + baca saja, TIDAK mengirim apa pun
 *   node apm-agent.js --env <berkas>  pakai berkas env lain (default: apm-agent.env di
 *                                     folder ini); state & log ditulis di samping berkas itu
 *
 * Pengaman akun: kredensial yang pernah DITOLAK OneKey dicatat sidik jarinya di
 * apm-agent-state.json dan tidak dicoba lagi sampai APM_PASSWORD diganti, supaya akun
 * pribadi operator tidak terkunci karena login gagal berulang tiap jam.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ApmClient } from '../../lib/apm/client';
import { collectApm, sidikJariKredensial, type ApmReadingRow } from '../../lib/apm/collect';

/** Di PC tidak ada batas 60 detik seperti fungsi Vercel; cukup longgar untuk APM yang lambat. */
const BUDGET_MS = 120_000;
const KIRIM_TIMEOUT_MS = 30_000;
const LOG_MAKS_BYTE = 1_000_000;
const DEFAULT_URL = 'https://utilitas.vercel.app';

interface AgentState {
    cookies: string | null;
    failedCredFp: string | null;
}

function jamWIB(): string {
    return new Date(Date.now() + 7 * 3_600_000).toISOString().replace('T', ' ').slice(0, 19) + ' WIB';
}

function buatLog(file: string) {
    try {
        // Potong log lama supaya tidak membengkak di PC yang menyala bertahun-tahun.
        if (fs.statSync(file).size > LOG_MAKS_BYTE) {
            const isi = fs.readFileSync(file, 'utf-8');
            fs.writeFileSync(file, isi.slice(-LOG_MAKS_BYTE / 4));
        }
    } catch {
        // belum ada log
    }
    return (msg: string) => {
        const baris = `[${jamWIB()}] ${msg}`;
        console.log(baris);
        try {
            fs.appendFileSync(file, baris + '\r\n');
        } catch {
            // log ke berkas hanya bantuan; jangan gagalkan sync karenanya
        }
    };
}

function bacaEnv(file: string): Record<string, string> {
    const env: Record<string, string> = {};
    for (const line of fs.readFileSync(file, 'utf-8').replace(/^﻿/, '').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx <= 0) continue;
        let val = trimmed.slice(eqIdx + 1).trim();
        if (val.length >= 2 && (val[0] === '"' || val[0] === "'") && val.endsWith(val[0])) val = val.slice(1, -1);
        env[trimmed.slice(0, eqIdx).trim()] = val;
    }
    return env;
}

function bacaState(file: string): AgentState {
    try {
        const s = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<AgentState>;
        return { cookies: s.cookies ?? null, failedCredFp: s.failedCredFp ?? null };
    } catch {
        return { cookies: null, failedCredFp: null };
    }
}

async function kirim(url: string, secret: string, body: { rows: ApmReadingRow[]; error: string | null }): Promise<string> {
    let terakhir = '';
    for (let percobaan = 1; percobaan <= 2; percobaan++) {
        try {
            const res = await fetch(`${url}/api/apm/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(KIRIM_TIMEOUT_MS),
            });
            const teks = await res.text();
            if (res.ok) return teks;
            terakhir = `HTTP ${res.status} ${teks.slice(0, 300)}`;
            // 4xx = isi/secret salah; mengulang tidak akan menolong.
            if (res.status < 500) break;
        } catch (e) {
            terakhir = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        }
        if (percobaan === 1) await new Promise(r => setTimeout(r, 5_000));
    }
    throw new Error(`Gagal mengirim ke PowerOps (${url}): ${terakhir}`);
}

function ringkasan(rows: ApmReadingRow[]): string[] {
    const perUnit = new Map<number, number>();
    for (const r of rows) perUnit.set(r.unit_id, (perUnit.get(r.unit_id) ?? 0) + 1);
    const baris = [...perUnit].map(([unit, n]) => `  unit ${unit}: ${n} nilai`);
    const steamA = rows.filter(r => r.tag === '1FI102').sort((a, b) => a.reading_at.localeCompare(b.reading_at));
    if (steamA.length) {
        baris.push('  Steam flow Boiler A (1FI102):');
        for (const r of steamA) baris.push(`    ${r.reading_at.slice(0, 16).replace('T', ' ')}  ${r.value ?? r.value_text}`);
    }
    return baris;
}

async function main(): Promise<number> {
    const args = process.argv.slice(2);
    const coba = args.includes('--coba');
    const envIdx = args.indexOf('--env');
    const envPath = path.resolve(envIdx >= 0 && args[envIdx + 1] ? args[envIdx + 1] : path.join(__dirname, 'apm-agent.env'));
    const folder = path.dirname(envPath);
    const log = buatLog(path.join(folder, 'apm-agent.log'));

    if (typeof Headers === 'undefined' || typeof Headers.prototype.getSetCookie !== 'function') {
        log(`Butuh Node.js 20 atau lebih baru (terpasang ${process.version}).`);
        return 1;
    }
    if (!fs.existsSync(envPath)) {
        log(`Berkas ${envPath} tidak ada. Salin apm-agent.env.example jadi apm-agent.env lalu isi.`);
        return 1;
    }

    const env = bacaEnv(envPath);
    const username = env.APM_USERNAME;
    const password = env.APM_PASSWORD;
    const secret = env.APM_INGEST_SECRET;
    const url = (env.POWEROPS_URL || DEFAULT_URL).replace(/\/+$/, '');

    // Laporkan kegagalan ke PowerOps juga, supaya terlihat di banner dashboard.
    const gagal = async (msg: string) => {
        log(`GAGAL: ${msg}`);
        if (coba || !secret) return 1;
        try {
            await kirim(url, secret, { rows: [], error: msg });
        } catch (e) {
            log(e instanceof Error ? e.message : String(e));
        }
        return 1;
    };

    if (!coba && !secret) return gagal('APM_INGEST_SECRET belum diisi di apm-agent.env');
    if (!username || !password) {
        if (coba) {
            log('APM_USERNAME / APM_PASSWORD belum diisi — hanya cek apakah form login OneKey bisa dicapai.');
            const hasil = await new ApmClient({ budgetMs: 60_000 }).probeLoginPage();
            log(`Form login ${hasil.formFound ? 'DITEMUKAN' : 'TIDAK ditemukan'} (HTTP ${hasil.status} di ${hasil.host}).`);
            return hasil.formFound ? 0 : 1;
        }
        return gagal('APM_USERNAME / APM_PASSWORD belum diisi di apm-agent.env (PC agen APM)');
    }

    const statePath = path.join(folder, 'apm-agent-state.json');
    const state = bacaState(statePath);
    const fp = sidikJariKredensial(username, password);
    if (state.failedCredFp === fp) {
        return gagal('Password APM pernah ditolak OneKey — perbarui APM_PASSWORD di apm-agent.env (PC agen APM)');
    }

    const hasil = await collectApm({ username, password, cookies: state.cookies, budgetMs: BUDGET_MS });
    const stateBaru: AgentState = {
        cookies: hasil.cookies,
        failedCredFp: hasil.ok ? null : hasil.loginRejected ? fp : state.failedCredFp,
    };
    fs.writeFileSync(statePath, JSON.stringify(stateBaru));

    if (!hasil.ok) return gagal(hasil.error);
    for (const w of hasil.warnings) log(`Peringatan: ${w}`);
    const info = `${hasil.rows.length} nilai (${hasil.dates.join(', ')}), ${hasil.login ? 'login ulang' : 'sesi tersimpan'}, ${hasil.ms} ms`;

    if (coba) {
        log(`Uji coba OK: ${info}. Tidak ada yang dikirim ke PowerOps.`);
        for (const b of ringkasan(hasil.rows)) console.log(b);
        return 0;
    }

    try {
        const jawab = await kirim(url, secret!, { rows: hasil.rows, error: null });
        log(`OK: ${info} → PowerOps ${jawab}`);
        return 0;
    } catch (e) {
        log(`GAGAL: ${e instanceof Error ? e.message : String(e)}`);
        return 1;
    }
}

main().then(
    code => {
        process.exitCode = code;
    },
    err => {
        console.error(err);
        process.exitCode = 1;
    },
);
