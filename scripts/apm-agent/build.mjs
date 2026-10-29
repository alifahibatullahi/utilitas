// Bundel agen APM (scripts/apm-agent/agent.ts) jadi satu berkas siap salin ke PC kantor.
// Jalankan: npm run build:apm-agent  → dist/apm-agent/ (salin seluruh folder itu).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(src, '..', '..');
const out = path.join(root, 'dist', 'apm-agent');
fs.mkdirSync(out, { recursive: true });

execSync(
    `npx --yes esbuild@0.28.1 "${path.join(src, 'agent.ts')}" --bundle --platform=node --target=node20 ` +
        `--format=cjs --log-level=warning --outfile="${path.join(out, 'apm-agent.js')}"`,
    { stdio: 'inherit', cwd: root },
);

// Berkas pendamping ditulis CRLF: .cmd harus terbaca cmd.exe, .txt/.env rapi di Notepad.
for (const f of ['BACA-SAYA.txt', 'apm-agent.env.example', 'uji-coba.cmd', 'jalankan-sekali.cmd', 'pasang-jadwal.cmd']) {
    const isi = fs.readFileSync(path.join(src, f), 'utf-8').replace(/\r?\n/g, '\r\n');
    fs.writeFileSync(path.join(out, f), isi);
}
console.log(`Siap disalin ke PC kantor: ${out}`);
