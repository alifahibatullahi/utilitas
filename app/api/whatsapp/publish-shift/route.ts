import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminClient,
    sendFonnteText,
    sendFonnteFile,
    sendFonnteGroup,
    getWhatsappGroup,
    logNotification,
    renderTemplate,
} from '@/lib/whatsapp';
import { htmlToPdf } from '@/lib/pdf';
import { uploadToR2 } from '@/lib/r2';

// Use node runtime — puppeteer requires it.
export const runtime = 'nodejs';
export const maxDuration = 60;

// GET — returns the suggested text body for the Washift channel.
// Modal calls this to pre-fill the editable textarea.
export async function GET(req: NextRequest) {
    const reportId = req.nextUrl.searchParams.get('reportId');
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: report, error } = await supabase
        .from('shift_reports')
        .select(`
            id, date, shift, group_name, supervisor, catatan,
            shift_turbin (flow_steam, press_steam, vacuum, stream_days, thrust_bearing),
            shift_generator_gi (gen_load, gen_tegangan, gen_frequensi, gi_sum_p),
            shift_boiler (boiler, press_steam, flow_steam, batubara_ton, temp_furnace, temp_flue_gas),
            shift_steam_dist (pabrik1_flow, pabrik3a_flow),
            shift_power_dist (power_ubb, power_pabrik2, power_pabrik3a, power_revamping, power_pie),
            shift_tankyard (tk_rcw, tk_demin)
        `)
        .eq('id', reportId)
        .single();
    if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    const { data: maintenance } = await supabase
        .from('maintenance_logs')
        .select('item, uraian, scope, status, tipe')
        .eq('shift_report_id', reportId)
        .order('item', { ascending: true });

    const summary = buildShiftSummary(report, maintenance ?? []);
    const shiftLabel = (report.shift as string).charAt(0).toUpperCase() + (report.shift as string).slice(1);
    const text = await renderTemplate(supabase, 'shift_share', {
        shift: shiftLabel,
        group: report.group_name as string,
        date: formatDateHariTanggal(report.date as string),
        summary,
    });
    return NextResponse.json({ text });
}

/** Format "2026-05-23" → "Senin, 23 Mei 2026". Parse local agar tidak ke-shift TZ. */
function formatDateHariTanggal(isoDate: string): string {
    const [y, m, d] = (isoDate || '').split('-').map(Number);
    if (!y || !m || !d) return isoDate ?? '';
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Format angka: kalau null/undefined → '-', kalau integer → tampilkan tanpa decimal. */
function fmtNum(v: number | null | undefined, decimals = 1): string {
    if (v == null || v === undefined) return '-';
    const n = Number(v);
    if (isNaN(n)) return '-';
    return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

interface PublishBody {
    reportId: string;
    washiftMessage: string;
    washiftTarget: string;       // raw fonnte target (number) OR group key resolved client-side
    washiftIsGroupKey?: boolean; // if true, resolve via whatsapp_groups
    pdfGroupKey?: string;        // default 'management'
}

export async function POST(req: NextRequest) {
    let body: PublishBody;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
    const { reportId, washiftMessage, washiftTarget, washiftIsGroupKey, pdfGroupKey = 'management' } = body;
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 });

    const supabase = createAdminClient();

    // ── Fetch full shift report ──
    const { data: report, error } = await supabase
        .from('shift_reports')
        .select(`
            id, date, shift, group_name, supervisor, catatan,
            shift_turbin (*),
            shift_generator_gi (*),
            shift_boiler (*),
            shift_steam_dist (*),
            shift_power_dist (*),
            shift_water_quality (*)
        `)
        .eq('id', reportId)
        .single();
    if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    // ── Maintenance for THIS shift report only ──
    const { data: maintenance } = await supabase
        .from('maintenance_logs')
        .select('item, uraian, scope, foreman, tipe, status, notif')
        .eq('shift_report_id', reportId)
        .order('item', { ascending: true });

    // ────────── Run both sends in parallel ──────────
    const pdfResult = sendPdf(supabase, report, maintenance ?? [], pdfGroupKey);
    const textResult = sendText(supabase, washiftMessage, washiftTarget, washiftIsGroupKey ?? false, report);

    const [pdf, text] = await Promise.allSettled([pdfResult, textResult]);

    return NextResponse.json({
        pdf: pdf.status === 'fulfilled' ? pdf.value : { ok: false, error: String(pdf.reason) },
        text: text.status === 'fulfilled' ? text.value : { ok: false, error: String(text.reason) },
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendPdf(supabase: ReturnType<typeof createAdminClient>, report: any, maintenance: any[], pdfGroupKey: string) {
    const group = await getWhatsappGroup(supabase, pdfGroupKey);
    if (!group) return { ok: false, error: `Group "${pdfGroupKey}" tidak ditemukan` };

    // Build HTML
    const html = buildShiftReportHtml(report, maintenance);
    let pdfBuf: Buffer;
    try {
        pdfBuf = await htmlToPdf(html);
    } catch (err) {
        return { ok: false, error: `PDF render gagal: ${err instanceof Error ? err.message : String(err)}` };
    }

    // Upload to R2
    const filename = `laporan-shift-${report.date}-${report.shift}-${report.group_name}.pdf`;
    const r2Key = `reports/shift/${report.id}/${Date.now()}-${filename}`;
    let pdfUrl: string;
    try {
        pdfUrl = await uploadToR2(r2Key, pdfBuf, 'application/pdf');
    } catch (err) {
        return { ok: false, error: `R2 upload gagal: ${err instanceof Error ? err.message : String(err)}` };
    }

    // Send via Fonnte (file URL, no caption per user spec: "yang dikirim ke group hanya berupa PDF tanpa text")
    const send = await sendFonnteFile(group.fonnte_target, pdfUrl, undefined, filename);
    await logNotification(supabase, {
        kind: 'shift_share',
        target_date: report.date,
        target_shift: report.shift,
        target_group: report.group_name,
        sent_to: group.fonnte_target,
        payload: `[PDF] ${pdfUrl}`,
    });

    return { ok: send.ok, status: send.status, pdfUrl };
}

async function sendText(
    supabase: ReturnType<typeof createAdminClient>,
    message: string,
    target: string,
    isGroupKey: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    report: any,
) {
    if (!message?.trim()) return { ok: false, error: 'Pesan kosong' };

    let fonnteTarget = target;
    if (isGroupKey) {
        const group = await getWhatsappGroup(supabase, target);
        if (!group) return { ok: false, error: `Group "${target}" tidak ditemukan` };
        fonnteTarget = group.fonnte_target;
    }
    if (!fonnteTarget) return { ok: false, error: 'Target kosong' };

    const send = isGroupKey
        ? await sendFonnteGroup(fonnteTarget, message)
        : await sendFonnteText(fonnteTarget, message);
    await logNotification(supabase, {
        kind: 'shift_share',
        target_date: report.date,
        target_shift: report.shift,
        target_group: report.group_name,
        sent_to: fonnteTarget,
        payload: message,
    });
    return { ok: send.ok, status: send.status };
}

// ────────────────── HTML PDF Template ──────────────────
// Simple table-style report optimized for A4 print.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildShiftReportHtml(report: any, maintenance: any[]): string {
    const shiftLabel = (report.shift as string).charAt(0).toUpperCase() + (report.shift as string).slice(1);
    const turbin = (report.shift_turbin?.[0]) ?? null;
    const gen = (report.shift_generator_gi?.[0]) ?? null;
    const boilers = (report.shift_boiler ?? []).sort((a: any, b: any) => (a.boiler ?? '').localeCompare(b.boiler ?? ''));
    const steam = (report.shift_steam_dist?.[0]) ?? null;
    const power = (report.shift_power_dist?.[0]) ?? null;
    const water = (report.shift_water_quality?.[0]) ?? null;

    const cell = (v: unknown) => v == null || v === '' ? '—' : String(v);

    const boilerRows = boilers.map((b: any) => `
        <tr>
            <td><b>Boiler ${cell(b.boiler)}</b></td>
            <td>${cell(b.flow_steam)}</td>
            <td>${cell(b.press_steam)}</td>
            <td>${cell(b.temp_steam)}</td>
            <td>${cell(b.temp_furnace)}</td>
            <td>${cell(b.temp_flue_gas)}</td>
            <td>${cell(b.batubara_ton)}</td>
            <td>${cell(b.flow_bfw)}</td>
        </tr>
    `).join('');

    const maintRows = maintenance.length === 0
        ? '<tr><td colspan="6" style="text-align:center;color:#666">— Tidak ada item maintenance —</td></tr>'
        : maintenance.map((m, i) => `
            <tr>
                <td>${i + 1}</td>
                <td><b>${cell(m.item)}</b></td>
                <td>${cell(m.uraian)}</td>
                <td>${cell(m.scope)}</td>
                <td>${cell(m.tipe)}</td>
                <td><span class="status status-${cell(m.status).toLowerCase()}">${cell(m.status)}</span></td>
            </tr>
        `).join('');

    return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Laporan Shift ${shiftLabel} — ${report.date}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 16px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 2px solid #2b7cee; color: #2b7cee; }
  .meta { display: flex; gap: 16px; font-size: 11px; color: #475569; margin-bottom: 8px; }
  .meta b { color: #1e293b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .status { padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; }
  .status-open { background: #fee2e2; color: #b91c1c; }
  .status-ip { background: #fef3c7; color: #b45309; }
  .status-ok { background: #d1fae5; color: #065f46; }
  .catatan { padding: 8px; background: #f8fafc; border-left: 3px solid #2b7cee; white-space: pre-wrap; font-size: 11px; }
  .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #cbd5e1; text-align: center; color: #94a3b8; font-size: 9px; }
</style>
</head>
<body>
  <h1>Laporan Shift ${shiftLabel}</h1>
  <div class="meta">
    <div><b>Tanggal:</b> ${report.date}</div>
    <div><b>Grup:</b> ${report.group_name}</div>
    <div><b>Supervisor:</b> ${cell(report.supervisor)}</div>
  </div>

  <h2>Boiler</h2>
  <table>
    <thead><tr>
      <th></th><th>Flow Steam (t/h)</th><th>Press (bar)</th><th>Temp Steam (°C)</th>
      <th>Furnace (°C)</th><th>Flue Gas (°C)</th><th>BB (t)</th><th>Flow BFW (t/h)</th>
    </tr></thead>
    <tbody>${boilerRows}</tbody>
  </table>

  <div class="two-col">
    <div>
      <h2>Turbin</h2>
      <table>
        <tr><td>Flow Steam</td><td>${cell(turbin?.flow_steam)} t/h</td></tr>
        <tr><td>Press Steam</td><td>${cell(turbin?.press_steam)} bar</td></tr>
        <tr><td>Temp Steam</td><td>${cell(turbin?.temp_steam)} °C</td></tr>
        <tr><td>Vacuum</td><td>${cell(turbin?.vacuum)}</td></tr>
        <tr><td>Thrust Bearing</td><td>${cell(turbin?.thrust_bearing)} °C</td></tr>
        <tr><td>Vibrasi</td><td>${cell(turbin?.vibrasi)}</td></tr>
        <tr><td>Stream Days</td><td>${cell(turbin?.stream_days)}</td></tr>
      </table>
    </div>
    <div>
      <h2>Generator</h2>
      <table>
        <tr><td>Load</td><td>${cell(gen?.gen_load)} MW</td></tr>
        <tr><td>Tegangan</td><td>${cell(gen?.gen_tegangan)} V</td></tr>
        <tr><td>Frekuensi</td><td>${cell(gen?.gen_frequensi)} Hz</td></tr>
        <tr><td>Cos Phi</td><td>${cell(gen?.gen_cos_phi)}</td></tr>
        <tr><td>GI Sum P</td><td>${cell(gen?.gi_sum_p)} MW</td></tr>
        <tr><td>GI Sum Q</td><td>${cell(gen?.gi_sum_q)}</td></tr>
      </table>
    </div>
  </div>

  <div class="two-col">
    <div>
      <h2>Distribusi Steam</h2>
      <table>
        <tr><th>Lokasi</th><th>Flow (t/h)</th><th>Temp (°C)</th></tr>
        <tr><td>Pabrik 1</td><td>${cell(steam?.pabrik1_flow)}</td><td>${cell(steam?.pabrik1_temp)}</td></tr>
        <tr><td>Pabrik 2</td><td>${cell(steam?.pabrik2_flow)}</td><td>${cell(steam?.pabrik2_temp)}</td></tr>
        <tr><td>Pabrik 3A</td><td>${cell(steam?.pabrik3a_flow)}</td><td>${cell(steam?.pabrik3a_temp)}</td></tr>
        <tr><td>Pabrik 3B</td><td>${cell(steam?.pabrik3b_flow)}</td><td>${cell(steam?.pabrik3b_temp)}</td></tr>
      </table>
    </div>
    <div>
      <h2>Distribusi Power</h2>
      <table>
        <tr><th>Lokasi</th><th>MW</th></tr>
        <tr><td>UBB</td><td>${cell(power?.power_ubb)}</td></tr>
        <tr><td>Pabrik 2</td><td>${cell(power?.power_pabrik2)}</td></tr>
        <tr><td>Pabrik 3A</td><td>${cell(power?.power_pabrik3a)}</td></tr>
        <tr><td>Pabrik 3B</td><td>${cell(power?.power_pabrik3b)}</td></tr>
        <tr><td>PIE</td><td>${cell(power?.power_pie)}</td></tr>
      </table>
    </div>
  </div>

  ${water ? `
  <h2>Lab / Water Quality</h2>
  <table>
    <tr><th>Sample</th><th>pH</th><th>Conduct</th><th>SiO₂</th><th>Lainnya</th></tr>
    <tr><td>Demin TK 1250</td><td>${cell(water.demin_1250_ph)}</td><td>${cell(water.demin_1250_conduct)}</td><td>${cell(water.demin_1250_sio2)}</td><td>TH ${cell(water.demin_1250_th)}</td></tr>
    <tr><td>Demin TK 750</td><td>${cell(water.demin_750_ph)}</td><td>${cell(water.demin_750_conduct)}</td><td>${cell(water.demin_750_sio2)}</td><td>TH ${cell(water.demin_750_th)}</td></tr>
    <tr><td>BFW</td><td>${cell(water.bfw_ph)}</td><td>${cell(water.bfw_conduct)}</td><td>${cell(water.bfw_sio2)}</td><td>NH₄ ${cell(water.bfw_nh4)} · ChZ ${cell(water.bfw_chz)}</td></tr>
    <tr><td>Boiler Water A</td><td>${cell(water.boiler_water_a_ph)}</td><td>${cell(water.boiler_water_a_conduct)}</td><td>${cell(water.boiler_water_a_sio2)}</td><td>PO₄ ${cell(water.boiler_water_a_po4)}</td></tr>
    <tr><td>Boiler Water B</td><td>${cell(water.boiler_water_b_ph)}</td><td>${cell(water.boiler_water_b_conduct)}</td><td>${cell(water.boiler_water_b_sio2)}</td><td>PO₄ ${cell(water.boiler_water_b_po4)}</td></tr>
  </table>
  ` : ''}

  <h2>Critical &amp; Maintenance</h2>
  <table>
    <thead><tr><th>No</th><th>Item</th><th>Uraian</th><th>Scope</th><th>Tipe</th><th>Status</th></tr></thead>
    <tbody>${maintRows}</tbody>
  </table>

  ${report.catatan ? `<h2>Catatan Shift</h2><div class="catatan">${escapeHtml(report.catatan)}</div>` : ''}

  <div class="footer">PowerOps — Laporan Shift ${shiftLabel} ${report.date} · Grup ${report.group_name}</div>
</body>
</html>`;
}

// Returns the `{{summary}}` content for the shift_share template:
// parameters + maintenance + catatan shift. The template provides the header
// (e.g. "*Laporan Shift {{shift}} — {{date}}*").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildShiftSummary(report: any, maintenance: any[]): string {
    // PostgREST nested SELECT untuk 1-to-1 relation return single object, untuk 1-to-many
    // return array. Helper untuk ambil first regardless.
    const first = (x: any) => Array.isArray(x) ? x[0] : (x ?? undefined);
    const turbin = first(report.shift_turbin);
    const gen = first(report.shift_generator_gi);
    const steamDist = first(report.shift_steam_dist);
    const powerDist = first(report.shift_power_dist);
    const tankyard = first(report.shift_tankyard);
    const boilers = (report.shift_boiler ?? []).sort((a: any, b: any) => (a.boiler ?? '').localeCompare(b.boiler ?? ''));
    const boilerA = boilers.find((b: any) => b.boiler === 'A');
    const boilerB = boilers.find((b: any) => b.boiler === 'B');

    const lines: string[] = [];
    lines.push(`Supervisor: ${report.supervisor ?? '-'}`);
    lines.push('');
    lines.push('━━━ *PARAMETER OPERASI* ━━━');

    // Boiler A & B — unit di setiap value supaya konsisten kalau salah satu kosong.
    if (boilerA || boilerB) {
        lines.push('');
        lines.push('*Boiler A & B*');
        lines.push(`  Flow Steam     : A ${fmtNum(boilerA?.flow_steam)} t/h | B ${fmtNum(boilerB?.flow_steam)} t/h`);
        lines.push(`  Total Batubara : A ${fmtNum(boilerA?.batubara_ton)} Ton | B ${fmtNum(boilerB?.batubara_ton)} Ton`);
        lines.push(`  Temp. Furnace  : A ${fmtNum(boilerA?.temp_furnace)} °C | B ${fmtNum(boilerB?.temp_furnace)} °C`);
    }

    // Turbin
    if (turbin) {
        lines.push('');
        lines.push('*Turbin*');
        lines.push(`  Steam Inlet         : ${fmtNum(turbin.flow_steam)} t/h`);
        lines.push(`  Temp. Thrust Bearing: ${fmtNum(turbin.thrust_bearing)} °C`);
    }

    // Distribusi Steam
    if (steamDist) {
        lines.push('');
        lines.push('*Distribusi Steam*');
        lines.push(`  Pabrik 1 : ${fmtNum(steamDist.pabrik1_flow)} t/h`);
        lines.push(`  Pabrik 3 : ${fmtNum(steamDist.pabrik3a_flow)} t/h`);
    }

    // Power
    if (gen || powerDist) {
        lines.push('');
        lines.push('*Power*');
        lines.push(`  STG UBB     : ${fmtNum(gen?.gen_load)} MW`);
        lines.push(`  Internal UBB: ${fmtNum(powerDist?.power_ubb)} MW`);
        lines.push(`  Pabrik 2    : ${fmtNum(powerDist?.power_pabrik2)} MW`);
        lines.push(`  Pabrik 3A   : ${fmtNum(powerDist?.power_pabrik3a)} MW`);
        lines.push(`  Pabrik 3B   : ${fmtNum(powerDist?.power_revamping)} MW`);
        lines.push(`  PIU         : ${fmtNum(powerDist?.power_pie)} MW`);
        lines.push(`  PLN         : ${fmtNum(gen?.gi_sum_p)} MW`);
    }

    // Tank Yard — Level RCW & Demin
    if (tankyard) {
        lines.push('');
        lines.push(`Level RCW   : ${fmtNum(tankyard.tk_rcw)} m³`);
        lines.push(`Level Demin : ${fmtNum(tankyard.tk_demin)} m³`);
    }

    lines.push('');
    lines.push('━━━ *MAINTENANCE* ━━━');
    if (maintenance.length === 0) {
        lines.push('  (tidak ada item)');
    } else {
        // Sort by item ascending, then number sequentially.
        const sorted = [...maintenance].sort((a, b) => String(a.item ?? '').localeCompare(String(b.item ?? '')));
        sorted.forEach((m, i) => {
            lines.push(`${i + 1} - ${m.item ?? '-'} + ${m.scope ?? '-'} + ${m.uraian ?? '-'} + ${m.status ?? '-'}`);
        });
    }

    if (report.catatan) {
        lines.push('');
        lines.push('━━━ *CATATAN SHIFT* ━━━');
        lines.push(report.catatan);
    }

    return lines.join('\n');
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}
