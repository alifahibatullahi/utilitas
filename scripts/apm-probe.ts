/**
 * Uji koneksi ke E-Logsheet APM dari mesin ini.
 *
 * Jalankan:  npx tsx scripts/apm-probe.ts          (login + baca Panel Boiler A hari ini, TANPA menulis DB)
 *            npx tsx scripts/apm-probe.ts --sync   (sync penuh ke apm_readings, sama seperti cron)
 *
 * Butuh APM_USERNAME & APM_PASSWORD di .env.local. Tanpa itu hanya dicek apakah form
 * login Keycloak bisa dicapai (tidak ada kredensial yang dikirim).
 */

import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(__dirname, '..', '.env.local');
for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
}

async function main() {
    const { ApmClient } = await import('../lib/apm/client');
    const { APM_UNIT } = await import('../lib/apm/tags');
    const { nowWIB } = await import('../lib/whatsapp');

    if (process.argv.includes('--sync')) {
        const { syncApmIfStale } = await import('../lib/apm/sync');
        console.log(JSON.stringify(await syncApmIfStale(0), null, 2));
        return;
    }

    const client = new ApmClient({ budgetMs: 60_000 });
    const username = process.env.APM_USERNAME;
    const password = process.env.APM_PASSWORD;
    if (!username || !password) {
        console.log('APM_USERNAME / APM_PASSWORD belum ada di .env.local — hanya cek form login.');
        console.log(await client.probeLoginPage());
        return;
    }

    const t0 = Date.now();
    await client.login(username, password);
    console.log(`Login OK (${Date.now() - t0} ms)`);

    const date = nowWIB().date;
    const day = await client.fetchUnitDay(APM_UNIT.PANEL_BOILER_A, date);
    const steam = day.params.find(p => p.tag === '1FI102');
    console.log(`Panel Boiler A ${date}: ${day.params.length} parameter, ${day.readings.length} nilai`);
    console.log('FLOW MAIN STEAM (1FI102):');
    for (const r of day.readings.filter(r => r.paramId === steam?.id).sort((a, b) => a.slot.localeCompare(b.slot))) {
        console.log(`  ${r.slot}  ${r.raw.padStart(6)} ${steam?.unit ?? ''}   dicatat ${r.recordedAt}`);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
