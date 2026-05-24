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

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
    const reportId = req.nextUrl.searchParams.get('reportId');
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: report, error } = await supabase
        .from('daily_reports')
        .select(`
            id, date, notes,
            daily_report_steam (prod_boiler_a_00, prod_boiler_b_00, inlet_turbine_00, mps_i_00, mps_3a_00),
            daily_report_power (gen_00, power_ubb, power_pabrik2, power_pabrik3a, power_revamping, power_pie),
            daily_report_coal (total_boiler_a_24, total_boiler_b_24),
            daily_report_turbine_misc (temp_furnace_a, temp_furnace_b, thrust_bearing_temp, gi_sum_p),
            daily_report_stock_tank (rcw_level_00, demin_level_00)
        `)
        .eq('id', reportId)
        .single();
    if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    const { data: maintenance } = await supabase
        .from('maintenance_logs')
        .select('item, uraian, scope, status, tipe')
        .eq('date', report.date as string)
        .order('item', { ascending: true });

    const summary = buildDailySummary(report, maintenance ?? []);
    const text = await renderTemplate(supabase, 'daily_share', {
        date: formatDateHariTanggal(report.date as string),
        summary,
    });
    return NextResponse.json({ text });
}

/** Format "2026-05-23" → "Senin, 23 Mei 2026". */
function formatDateHariTanggal(isoDate: string): string {
    const [y, m, d] = (isoDate || '').split('-').map(Number);
    if (!y || !m || !d) return isoDate ?? '';
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtNum(v: number | null | undefined, decimals = 1): string {
    if (v == null) return '-';
    const n = Number(v);
    if (isNaN(n)) return '-';
    return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

interface PublishBody {
    reportId: string;
    washiftMessage: string;
    washiftTarget: string;
    washiftIsGroupKey?: boolean;
    pdfGroupKey?: string;
}

export async function POST(req: NextRequest) {
    let body: PublishBody;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
    const { reportId, washiftMessage, washiftTarget, washiftIsGroupKey, pdfGroupKey = 'management' } = body;
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 });

    const supabase = createAdminClient();

    const { data: report, error } = await supabase
        .from('daily_reports')
        .select(`
            id, date, notes,
            daily_report_steam (*),
            daily_report_power (*),
            daily_report_coal (*),
            daily_report_turbine_misc (*),
            daily_report_stock_tank (*),
            daily_report_totalizer (*)
        `)
        .eq('id', reportId)
        .single();
    if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    const { data: maintenance } = await supabase
        .from('maintenance_logs')
        .select('item, uraian, scope, foreman, tipe, status, notif')
        .eq('date', report.date as string)
        .order('item', { ascending: true });

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

    const html = buildDailyReportHtml(report, maintenance);
    let pdfBuf: Buffer;
    try { pdfBuf = await htmlToPdf(html); }
    catch (err) { return { ok: false, error: `PDF render gagal: ${err instanceof Error ? err.message : String(err)}` }; }

    const filename = `laporan-harian-${report.date}.pdf`;
    const r2Key = `reports/daily/${report.id}/${Date.now()}-${filename}`;
    let pdfUrl: string;
    try { pdfUrl = await uploadToR2(r2Key, pdfBuf, 'application/pdf'); }
    catch (err) { return { ok: false, error: `R2 upload gagal: ${err instanceof Error ? err.message : String(err)}` }; }

    const send = await sendFonnteFile(group.fonnte_target, pdfUrl, undefined, filename);
    await logNotification(supabase, {
        kind: 'daily_share',
        target_date: report.date,
        sent_to: group.fonnte_target,
        payload: `[PDF] ${pdfUrl}`,
    });

    return { ok: send.ok, status: send.status, pdfUrl };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendText(supabase: ReturnType<typeof createAdminClient>, message: string, target: string, isGroupKey: boolean, report: any) {
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
        kind: 'daily_share',
        target_date: report.date,
        sent_to: fonnteTarget,
        payload: message,
    });
    return { ok: send.ok, status: send.status };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDailyReportHtml(report: any, maintenance: any[]): string {
    const stm = report.daily_report_steam?.[0];
    const pwr = report.daily_report_power?.[0];
    const coal = report.daily_report_coal?.[0];
    const turb = report.daily_report_turbine_misc?.[0];
    const tank = report.daily_report_stock_tank?.[0];
    const tot = report.daily_report_totalizer?.[0];
    const cell = (v: unknown) => v == null || v === '' ? '—' : String(v);

    const maintRows = maintenance.length === 0
        ? '<tr><td colspan="6" style="text-align:center;color:#666">— Tidak ada item maintenance —</td></tr>'
        : maintenance.map((m, i) => `
            <tr>
                <td>${i + 1}</td>
                <td><b>${cell(m.item)}</b></td>
                <td>${cell(m.uraian)}</td>
                <td>${cell(m.scope)}</td>
                <td>${cell(m.tipe)}</td>
                <td>${cell(m.status)}</td>
            </tr>
        `).join('');

    return `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<title>Laporan Harian LHUBB — ${report.date}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 16px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 2px solid #2b7cee; color: #2b7cee; }
  .meta { font-size: 11px; color: #475569; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .catatan { padding: 8px; background: #f8fafc; border-left: 3px solid #2b7cee; white-space: pre-wrap; }
  .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #cbd5e1; text-align: center; color: #94a3b8; font-size: 9px; }
</style></head><body>
  <h1>Laporan Harian (LHUBB)</h1>
  <div class="meta"><b>Tanggal:</b> ${report.date}</div>

  <div class="two-col">
    <div>
      <h2>Produksi Steam 24 Jam</h2>
      <table>
        <tr><td>Boiler A</td><td>${cell(stm?.prod_boiler_a_24)} t</td></tr>
        <tr><td>Boiler B</td><td>${cell(stm?.prod_boiler_b_24)} t</td></tr>
        <tr><td>Total</td><td><b>${cell(stm?.prod_total_24)} t</b></td></tr>
        <tr><td>Inlet Turbine</td><td>${cell(stm?.inlet_turbine_24)} t</td></tr>
        <tr><td>Fully Condens</td><td>${cell(stm?.fully_condens_24)} t</td></tr>
        <tr><td>MPS Pabrik 1B</td><td>${cell(stm?.mps_i_24)} t</td></tr>
        <tr><td>MPS Pabrik 3A</td><td>${cell(stm?.mps_3a_24)} t</td></tr>
      </table>
    </div>
    <div>
      <h2>Power 24 Jam</h2>
      <table>
        <tr><td>Generator</td><td>${cell(pwr?.gen_24)} MWh</td></tr>
        <tr><td>Internal Bus 1</td><td>${cell(pwr?.internal_bus1_24)} MWh</td></tr>
        <tr><td>Export</td><td>${cell(pwr?.exsport_24)} MWh</td></tr>
        <tr><td>Distribusi II</td><td>${cell(pwr?.dist_ii_24)} MWh</td></tr>
        <tr><td>Distribusi 3A</td><td>${cell(pwr?.dist_3a_24)} MWh</td></tr>
      </table>
    </div>
  </div>

  <div class="two-col">
    <div>
      <h2>Konsumsi Coal</h2>
      <table>
        <tr><th>Feeder</th><th>24h</th></tr>
        <tr><td>A</td><td>${cell(coal?.coal_a_24)} t</td></tr>
        <tr><td>B</td><td>${cell(coal?.coal_b_24)} t</td></tr>
        <tr><td>C</td><td>${cell(coal?.coal_c_24)} t</td></tr>
        <tr><td>D</td><td>${cell(coal?.coal_d_24)} t</td></tr>
        <tr><td>E</td><td>${cell(coal?.coal_e_24)} t</td></tr>
        <tr><td>F</td><td>${cell(coal?.coal_f_24)} t</td></tr>
      </table>
    </div>
    <div>
      <h2>Stock Tank</h2>
      <table>
        <tr><td>RCW Level</td><td>${cell(tank?.rcw_level_00)}</td></tr>
        <tr><td>Demin Level</td><td>${cell(tank?.demin_level_00)}</td></tr>
        <tr><td>Solar Tank A</td><td>${cell(tank?.solar_tank_a)}</td></tr>
        <tr><td>Solar Tank B</td><td>${cell(tank?.solar_tank_b)}</td></tr>
        <tr><td>BFW Total</td><td>${cell(tank?.bfw_total)} m³</td></tr>
        <tr><td>Phosphat</td><td>${cell(tank?.chemical_phosphat)} L</td></tr>
        <tr><td>Amin</td><td>${cell(tank?.chemical_amin)} L</td></tr>
        <tr><td>Hydrasin</td><td>${cell(tank?.chemical_hydrasin)} L</td></tr>
      </table>
    </div>
  </div>

  ${turb || tot ? `
  <h2>Turbin & Totalizer</h2>
  <table>
    <tr><td>Steam Inlet Press</td><td>${cell(turb?.steam_inlet_press)} bar</td><td>Totalizer Export</td><td>${cell(turb?.totalizer_export)} kWh</td></tr>
    <tr><td>Steam Inlet Temp</td><td>${cell(turb?.steam_inlet_temp)} °C</td><td>Totalizer Import</td><td>${cell(turb?.totalizer_import)} kWh</td></tr>
    <tr><td>Axial Displacement</td><td>${cell(turb?.axial_displacement)}</td><td>Stock Batubara</td><td>${cell(tank?.stock_batubara)} t</td></tr>
  </table>` : ''}

  <h2>Critical &amp; Maintenance</h2>
  <table>
    <thead><tr><th>No</th><th>Item</th><th>Uraian</th><th>Scope</th><th>Tipe</th><th>Status</th></tr></thead>
    <tbody>${maintRows}</tbody>
  </table>

  ${report.notes ? `<h2>Catatan Harian</h2><div class="catatan">${escapeHtml(report.notes)}</div>` : ''}

  <div class="footer">PowerOps — Laporan Harian (LHUBB) ${report.date}</div>
</body></html>`;
}

// Returns the `{{summary}}` content for the daily_share template.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDailySummary(report: any, maintenance: any[]): string {
    const stm  = report.daily_report_steam?.[0];
    const pwr  = report.daily_report_power?.[0];
    const coal = report.daily_report_coal?.[0];
    const turb = report.daily_report_turbine_misc?.[0];
    const tank = report.daily_report_stock_tank?.[0];

    const lines: string[] = [];
    lines.push('━━━ *PARAMETER OPERASI* ━━━');

    // Boiler A & B (snapshot 00:00 untuk flow, 24h total untuk batubara). Unit di setiap value.
    lines.push('');
    lines.push('*Boiler A & B*');
    lines.push(`  Flow Steam     : A ${fmtNum(stm?.prod_boiler_a_00)} t/h | B ${fmtNum(stm?.prod_boiler_b_00)} t/h`);
    lines.push(`  Total Batubara : A ${fmtNum(coal?.total_boiler_a_24)} Ton | B ${fmtNum(coal?.total_boiler_b_24)} Ton`);
    lines.push(`  Temp. Furnace  : A ${fmtNum(turb?.temp_furnace_a)} °C | B ${fmtNum(turb?.temp_furnace_b)} °C`);

    // Turbin
    lines.push('');
    lines.push('*Turbin*');
    lines.push(`  Steam Inlet         : ${fmtNum(stm?.inlet_turbine_00)} t/h`);
    lines.push(`  Temp. Thrust Bearing: ${fmtNum(turb?.thrust_bearing_temp)} °C`);

    // Distribusi Steam (snapshot 00:00)
    lines.push('');
    lines.push('*Distribusi Steam*');
    lines.push(`  Pabrik 1 : ${fmtNum(stm?.mps_i_00)} t/h`);
    lines.push(`  Pabrik 3 : ${fmtNum(stm?.mps_3a_00)} t/h`);

    // Power (snapshot 00:00 MW aktual)
    lines.push('');
    lines.push('*Power*');
    lines.push(`  STG UBB     : ${fmtNum(pwr?.gen_00)} MW`);
    lines.push(`  Internal UBB: ${fmtNum(pwr?.power_ubb)} MW`);
    lines.push(`  Pabrik 2    : ${fmtNum(pwr?.power_pabrik2)} MW`);
    lines.push(`  Pabrik 3A   : ${fmtNum(pwr?.power_pabrik3a)} MW`);
    lines.push(`  Pabrik 3B   : ${fmtNum(pwr?.power_revamping)} MW`);
    lines.push(`  PIU         : ${fmtNum(pwr?.power_pie)} MW`);
    lines.push(`  PLN         : ${fmtNum(turb?.gi_sum_p)} MW`);

    // Tank levels (snapshot 00:00)
    lines.push('');
    lines.push(`Level RCW   : ${fmtNum(tank?.rcw_level_00)} m³`);
    lines.push(`Level Demin : ${fmtNum(tank?.demin_level_00)} m³`);

    lines.push('');
    lines.push('━━━ *MAINTENANCE* ━━━');
    if (maintenance.length === 0) {
        lines.push('  (tidak ada item)');
    } else {
        const sorted = [...maintenance].sort((a, b) => String(a.item ?? '').localeCompare(String(b.item ?? '')));
        sorted.forEach((m, i) => {
            lines.push(`${i + 1} - ${m.item ?? '-'} + ${m.scope ?? '-'} + ${m.uraian ?? '-'} + ${m.status ?? '-'}`);
        });
    }

    if (report.notes) {
        lines.push('');
        lines.push('━━━ *CATATAN HARIAN* ━━━');
        lines.push(report.notes);
    }

    return lines.join('\n');
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}
