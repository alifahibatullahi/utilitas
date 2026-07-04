import { NextRequest, NextResponse } from 'next/server';
import {
    createAdminClient,
    sendFonnteText,
    sendFonnteFile,
    sendFonnteGroup,
    getWhatsappGroup,
    logNotification,
    renderTemplate,
    buildOperasiParams,
} from '@/lib/whatsapp';
import { htmlToPdf } from '@/lib/pdf';
import { uploadToR2 } from '@/lib/r2';
import {
    computeBunkerBerasapLines,
    fetchBunkerBerasapSince,
    buildDayCatatanLabeled,
    getShiftCatatanCanonical,
} from '@/lib/shift-catatan';

// Use node runtime — puppeteer requires it.
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Compute shift window (ISO 8601 with WIB offset).
 * KONVENSI: ENDING — shift malam D = window 23:00 D-1 → 07:00 D (submit pada hari D).
 * Sinkron dengan `getShiftWindow` di lib/constants.ts yang dipakai web.
 */
function getShiftWindowIso(date: string, shift: string): { start: string; end: string } {
    if (shift === 'pagi') return { start: `${date}T07:00:00+07:00`, end: `${date}T15:00:00+07:00` };
    if (shift === 'sore') return { start: `${date}T15:00:00+07:00`, end: `${date}T23:00:00+07:00` };
    // malam D (ENDING): 23:00 D-1 → 07:00 D
    const [y, m, d] = date.split('-').map(Number);
    const prev = new Date(y, m - 1, d - 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    const prevDate = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`;
    return { start: `${prevDate}T23:00:00+07:00`, end: `${date}T07:00:00+07:00` };
}

/**
 * Shift kronologis sebelumnya (sinkron dengan getPreviousShift di hooks/useShiftReport):
 * malam → sore (kemarin), pagi → malam (hari sama), sore → pagi (hari sama).
 * Dipakai untuk ambil totalizer_steam shift sebelumnya → hitung consumption rate.
 */
function getPreviousShift(date: string, shift: string): { prevDate: string; prevShift: string } {
    if (shift === 'malam') {
        const d = new Date(date + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        const pad = (n: number) => String(n).padStart(2, '0');
        const prevDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        return { prevDate, prevShift: 'sore' };
    }
    if (shift === 'pagi') return { prevDate: date, prevShift: 'malam' };
    return { prevDate: date, prevShift: 'pagi' };
}

// GET — returns the suggested text body for the Washift channel + structured summary
// untuk Review tab. Modal calls this to pre-fill review cards & editable textarea.
export async function GET(req: NextRequest) {
    const reportId = req.nextUrl.searchParams.get('reportId');
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: report, error } = await supabase
        .from('shift_reports')
        .select(`
            id, date, shift, group_name, supervisor, catatan, station_catatan,
            shift_turbin (flow_steam, press_steam, temp_steam, vacuum, stream_days, thrust_bearing),
            shift_generator_gi (gen_load, gen_tegangan, gen_frequensi, gi_sum_p),
            shift_boiler (boiler, press_steam, flow_steam, temp_steam, batubara_ton, temp_furnace, temp_flue_gas, totalizer_steam, status_boiler),
            shift_steam_dist (pabrik1_flow, pabrik2_flow, pabrik3a_flow, pabrik3b_flow),
            shift_power_dist (power_ubb, power_pabrik2, power_pabrik3a, power_revamping, power_pie, power_pabrik3b),
            shift_tankyard (tk_rcw, tk_demin),
            shift_personnel (turbin_karu, boiler_karu),
            shift_coal_bunker (status_bunker_a, status_bunker_b, status_bunker_c, status_bunker_d, status_bunker_e, status_bunker_f)
        `)
        .eq('id', reportId)
        .single();
    if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    // Maintenance untuk shift ini: status IP/OK dengan updated_at di window shift (sinkron dengan tampilan laporan-shift page).
    // Exclude sticky notes (item='NOTE' atau keterangan='IS_NOTE').
    const win = getShiftWindowIso(report.date as string, report.shift as string);
    const { data: maintenance } = await supabase
        .from('maintenance_logs')
        .select('item, uraian, scope, status, tipe, keterangan, updated_at')
        .in('status', ['IP', 'OK'])
        .gte('updated_at', win.start)
        .lte('updated_at', win.end)
        .neq('item', 'NOTE')
        .order('item', { ascending: true });

    // Critical equipment di window shift yang sama
    const { data: critical } = await supabase
        .from('critical_equipment')
        .select('date, item, deskripsi, scope, foreman')
        .gte('date', (report.date as string))
        .lte('date', (report.date as string))
        .order('item', { ascending: true });

    // Data tambahan catatan shift (unloading silo, kedatangan & permintaan solar).
    // By date+shift. Sekarang ikut ke teks washift (Catatan Shift) DAN Review.
    const [{ data: ashRows }, { data: solarInRows }, { data: solarOutRows }] = await Promise.all([
        supabase.from('ash_unloadings').select('silo, perusahaan, tujuan, ritase').eq('date', report.date).eq('shift', report.shift),
        supabase.from('solar_unloadings').select('supplier, liters').eq('date', report.date).eq('shift', report.shift),
        supabase.from('solar_usages').select('tujuan, liters').eq('date', report.date).eq('shift', report.shift),
    ]);
    const internal = { ash: ashRows ?? [], solarIn: solarInRows ?? [], solarOut: solarOutRows ?? [] };

    // Level RCW & Demin diambil dari data TERAKHIR di tank_levels (bukan shift_tankyard).
    const { data: tankRows } = await supabase
        .from('tank_levels')
        .select('tank_id, level_m3, created_at')
        .in('tank_id', ['RCW', 'DEMIN'])
        .order('created_at', { ascending: false });
    const latestTank = {
        rcw: (tankRows?.find(t => t.tank_id === 'RCW')?.level_m3 as number | null) ?? null,
        demin: (tankRows?.find(t => t.tank_id === 'DEMIN')?.level_m3 as number | null) ?? null,
    };

    // Bunker berasap "sejak ..." — untuk metadata summary.internal (tak dirender, tapi
    // tetap dihitung dari shift berjalan).
    const berasapSince = await fetchBunkerBerasapSince(supabase, report.date as string, report.shift as string);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coalRow = Array.isArray(report.shift_coal_bunker) ? (report.shift_coal_bunker as any[])[0] : ((report.shift_coal_bunker as any) ?? null);
    const bunkerLines = computeBunkerBerasapLines(coalRow, report.date as string, report.shift as string, berasapSince);

    // Catatan Operasional — DUA varian:
    //  - REVIEW (kartu): blok per-shift hari ini DARI Malam s/d shift berjalan, berlabel
    //    (konteks; mis. review Sore → Malam+Pagi+Sore).
    //  - WASHIFT (teks publish) & PDF: HANYA catatan shift INI saja (permintaan user).
    const catatanShiftIni = await getShiftCatatanCanonical(supabase, report);
    const catatanDayLabeled = await buildDayCatatanLabeled(supabase, report.date as string, report.shift as string);

    const summaryText = buildShiftSummary(report, latestTank, catatanShiftIni);
    const shiftLabel = (report.shift as string).charAt(0).toUpperCase() + (report.shift as string).slice(1);
    const text = await renderTemplate(supabase, 'shift_share', {
        shift: shiftLabel,
        group: report.group_name as string,
        date: formatDateHariTanggal(report.date as string),
        summary: summaryText,
    });
    // Totalizer steam shift sebelumnya per boiler → untuk hitung consumption rate
    // (batubara_ton / produksi steam), sinkron dengan kalkulasi di form TabBoiler.
    const prev = getPreviousShift(report.date as string, report.shift as string);
    const { data: prevReport } = await supabase
        .from('shift_reports')
        .select('shift_boiler (boiler, totalizer_steam)')
        .eq('date', prev.prevDate)
        .eq('shift', prev.prevShift)
        .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prevBoilers: any[] = (prevReport?.shift_boiler as any[]) ?? [];
    const prevTotalizer = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        A: (prevBoilers.find((b: any) => b.boiler === 'A')?.totalizer_steam as number | null) ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        B: (prevBoilers.find((b: any) => b.boiler === 'B')?.totalizer_steam as number | null) ?? null,
    };

    const summary = buildShiftReviewSummary(report, maintenance ?? [], critical ?? [], prevTotalizer, internal, latestTank, bunkerLines, catatanDayLabeled);
    return NextResponse.json({ text, summary });
}

/** Format "2026-05-23" → "Senin, 23 Mei 2026". Parse local agar tidak ke-shift TZ. */
function formatDateHariTanggal(isoDate: string): string {
    const [y, m, d] = (isoDate || '').split('-').map(Number);
    if (!y || !m || !d) return isoDate ?? '';
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
            id, date, shift, group_name, supervisor, catatan, station_catatan,
            shift_turbin (*),
            shift_generator_gi (*),
            shift_boiler (*),
            shift_steam_dist (*),
            shift_power_dist (*),
            shift_water_quality (*),
            shift_coal_bunker (*)
        `)
        .eq('id', reportId)
        .single();
    if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    // ── Maintenance untuk shift ini — timestamp-based (sinkron dengan tampilan laporan-shift page). Exclude sticky notes. ──
    const win = getShiftWindowIso(report.date as string, report.shift as string);
    const { data: maintenance } = await supabase
        .from('maintenance_logs')
        .select('item, uraian, scope, foreman, tipe, status, notif, keterangan')
        .in('status', ['IP', 'OK'])
        .gte('updated_at', win.start)
        .lte('updated_at', win.end)
        .neq('item', 'NOTE')
        .order('item', { ascending: true });

    // ── Catatan Operasional untuk PDF = HANYA shift ini (sama dengan teks washift). ──
    const catatanText = await getShiftCatatanCanonical(supabase, report);

    // ────────── Run both sends in parallel ──────────
    const pdfResult = sendPdf(supabase, report, maintenance ?? [], pdfGroupKey, catatanText);
    const textResult = sendText(supabase, washiftMessage, washiftTarget, washiftIsGroupKey ?? false, report);

    const [pdf, text] = await Promise.allSettled([pdfResult, textResult]);

    return NextResponse.json({
        pdf: pdf.status === 'fulfilled' ? pdf.value : { ok: false, error: String(pdf.reason) },
        text: text.status === 'fulfilled' ? text.value : { ok: false, error: String(text.reason) },
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendPdf(supabase: ReturnType<typeof createAdminClient>, report: any, maintenance: any[], pdfGroupKey: string, catatanText: string) {
    const group = await getWhatsappGroup(supabase, pdfGroupKey);
    if (!group) return { ok: false, error: `Group "${pdfGroupKey}" tidak ditemukan` };

    // Build HTML
    const html = buildShiftReportHtml(report, maintenance, catatanText);
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
    // Akun 'publish' — publish laporan dikirim dari nomor WA publish (bukan nomor notif).
    const send = await sendFonnteFile(group.fonnte_target, pdfUrl, undefined, filename, 'publish');
    await logNotification(supabase, {
        kind: 'shift_share',
        target_date: report.date,
        target_shift: report.shift,
        target_group: report.group_name,
        sent_to: group.fonnte_target,
        payload: `[PDF] ${pdfUrl}`,
        result: send,
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
        ? await sendFonnteGroup(fonnteTarget, message, 'publish')
        : await sendFonnteText(fonnteTarget, message, 'publish');
    await logNotification(supabase, {
        kind: 'shift_share',
        target_date: report.date,
        target_shift: report.shift,
        target_group: report.group_name,
        sent_to: fonnteTarget,
        payload: message,
        result: send,
    });
    return { ok: send.ok, status: send.status };
}

// ────────────────── HTML PDF Template ──────────────────
// Simple table-style report optimized for A4 print.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildShiftReportHtml(report: any, maintenance: any[], catatanText: string): string {
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

  ${catatanText.trim() ? `<h2>Catatan Operasional</h2><div class="catatan">${escapeHtml(catatanText)}</div>` : ''}

  <div class="footer">Web Utilitas Batubara — Laporan Shift ${shiftLabel} ${report.date} · Grup ${report.group_name}</div>
</body>
</html>`;
}

// Returns the `{{summary}}` content for the shift_share template:
// parameters + maintenance + catatan shift. The template provides the header
// (e.g. "*Laporan Shift {{shift}} — {{date}}*").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildShiftSummary(report: any, latestTank: { rcw: number | null; demin: number | null }, catatanText: string): string {
    const lines: string[] = [];
    lines.push(`Supervisor: ${report.supervisor ?? '-'}`);
    lines.push('');
    // Blok parameter operasi dibangun oleh helper bersama (lib/whatsapp).
    // Level RCW/Demin pakai data terakhir dari tank_levels.
    lines.push(buildOperasiParams(report, latestTank));

    // Catatan Operasional = blok per-shift berlabel (dari buildDayCatatanLabeled).
    // Blok Maintenance tetap tidak disertakan ke teks washift (hanya untuk PDF & Review).
    const catatan = catatanText;
    if (catatan.trim()) {
        lines.push('');
        lines.push('*Catatan Operasional*');
        lines.push(catatan.trim());
    }

    return lines.join('\n');
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}

// ────────────────── Structured JSON Summary untuk Review tab di PublishReportModal ──────────────────
// Dipakai untuk render kartu mini per area di tab Review Summary. Sumber data sama dengan
// buildShiftSummary text, tapi lebih kaya field (semua angka raw, status, dst) supaya
// modal bisa render flexible.

export interface ShiftReviewSummary {
    header: {
        date: string;            // YYYY-MM-DD
        dateHumanized: string;   // "Senin, 26 Mei 2026"
        shift: string;
        group: string;
        supervisor: string | null;
        foremanBoiler: string | null;
        foremanTurbin: string | null;
    };
    boilerA: BoilerSummary | null;
    boilerB: BoilerSummary | null;
    turbin: TurbinSummary | null;
    steamDist: SteamDistSummary | null;
    power: PowerSummary | null;
    tankLevels: { rcw: number | null; demin: number | null } | null;
    catatan: string;
    maintenance: MaintItem[];
    critical: CriticalItem[];
    // Data internal (Review only — tidak dikirim ke Washift).
    internal: {
        ashUnloadings: { silo: string; perusahaan: string; tujuan: string; ritase: number }[];
        solarMasuk: { supplier: string; liters: number }[];
        solarKeluar: { tujuan: string; liters: number }[];
        bunkerBerasap: string[];
    };
}
interface BoilerSummary {
    flow: number | null;
    pressSteam: number | null;
    tempSteam: number | null;
    tempFurnace: number | null;
    tempFlueGas: number | null;
    batubara: number | null;
    consumptionRate: number | null;   // batubara_ton / produksi steam (selisih totalizer vs shift sebelumnya)
    status: string | null;
}
interface TurbinSummary {
    flowSteam: number | null;
    pressSteam: number | null;
    tempSteam: number | null;
    thrustBearing: number | null;
    vacuum: number | null;
    streamDays: number | null;
}
interface SteamDistSummary {
    pabrik1: number | null;
    pabrik2: number | null;
    pabrik3a: number | null;
    pabrik3b: number | null;
}
interface PowerSummary {
    stgUbb: number | null;
    internalUbb: number | null;
    pabrik2: number | null;
    pabrik3a: number | null;
    pabrik3b: number | null;
    piu: number | null;
    pln: number | null;
}
interface MaintItem {
    item: string;
    uraian: string;
    scope: string;
    tipe: string;
    status: string;
}
interface CriticalItem {
    date: string;
    item: string;
    deskripsi: string;
    scope: string;
    foreman: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildShiftReviewSummary(report: any, maintenance: any[], critical: any[], prevTotalizer: { A: number | null; B: number | null }, internal: { ash: any[]; solarIn: any[]; solarOut: any[] }, latestTank: { rcw: number | null; demin: number | null }, bunkerLines: string[], catatanText: string): ShiftReviewSummary {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = (x: any) => Array.isArray(x) ? x[0] : (x ?? undefined);
    const turbin = first(report.shift_turbin);
    const gen = first(report.shift_generator_gi);
    const steamDist = first(report.shift_steam_dist);
    const powerDist = first(report.shift_power_dist);
    const personnel = first(report.shift_personnel);
    // Bunker berasap lines dihitung di pemanggil (computeBunkerBerasapLines) supaya identik
    // dengan teks washift & PDF.
    const bunkerBerasap = bunkerLines;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boilers: any[] = (report.shift_boiler ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boilerA = boilers.find((b: any) => b.boiler === 'A');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boilerB = boilers.find((b: any) => b.boiler === 'B');

    // Consumption rate = batubara_ton / produksi steam (selisih totalizer vs shift
    // sebelumnya). null kalau totalizer/prev tidak valid (mis. shift pertama / shutdown).
    const consumptionRate = (b: { batubara_ton?: number | null; totalizer_steam?: number | null } | undefined, prevTot: number | null): number | null => {
        const batubara = Number(b?.batubara_ton);
        const now = Number(b?.totalizer_steam);
        const prev = Number(prevTot);
        if (!Number.isFinite(batubara) || !Number.isFinite(now) || !Number.isFinite(prev) || prev <= 0) return null;
        const produksi = now - prev;
        return produksi > 0 ? batubara / produksi : null;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toBoilerSummary = (b: any | undefined, prevTot: number | null): BoilerSummary | null => b ? {
        flow: b.flow_steam ?? null,
        pressSteam: b.press_steam ?? null,
        tempSteam: b.temp_steam ?? null,
        tempFurnace: b.temp_furnace ?? null,
        tempFlueGas: b.temp_flue_gas ?? null,
        batubara: b.batubara_ton ?? null,
        consumptionRate: consumptionRate(b, prevTot),
        status: b.status_boiler ?? null,
    } : null;

    return {
        header: {
            date: report.date as string,
            dateHumanized: formatDateHariTanggal(report.date as string),
            shift: (report.shift as string).charAt(0).toUpperCase() + (report.shift as string).slice(1),
            group: report.group_name as string,
            supervisor: (report.supervisor as string | null) ?? null,
            foremanBoiler: personnel?.boiler_karu ?? null,
            foremanTurbin: personnel?.turbin_karu ?? null,
        },
        boilerA: toBoilerSummary(boilerA, prevTotalizer.A),
        boilerB: toBoilerSummary(boilerB, prevTotalizer.B),
        turbin: turbin ? {
            flowSteam: turbin.flow_steam ?? null,
            pressSteam: turbin.press_steam ?? null,
            tempSteam: turbin.temp_steam ?? null,
            thrustBearing: turbin.thrust_bearing ?? null,
            vacuum: turbin.vacuum ?? null,
            streamDays: turbin.stream_days ?? null,
        } : null,
        steamDist: steamDist ? {
            pabrik1: steamDist.pabrik1_flow ?? null,
            pabrik2: steamDist.pabrik2_flow ?? null,
            pabrik3a: steamDist.pabrik3a_flow ?? null,
            pabrik3b: steamDist.pabrik3b_flow ?? null,
        } : null,
        power: (gen || powerDist) ? {
            stgUbb: gen?.gen_load ?? null,
            internalUbb: powerDist?.power_ubb ?? null,
            pabrik2: powerDist?.power_pabrik2 ?? null,
            pabrik3a: powerDist?.power_pabrik3a ?? null,
            // Pabrik 3B = revamping (legacy column power_pabrik3b kosong)
            pabrik3b: powerDist?.power_revamping ?? null,
            piu: powerDist?.power_pie ?? null,
            pln: gen?.gi_sum_p ?? null,
        } : null,
        // Level RCW/Demin dari data terakhir di tank_levels (bukan shift_tankyard).
        tankLevels: { rcw: latestTank.rcw, demin: latestTank.demin },
        catatan: catatanText,
        maintenance: maintenance.map(m => ({
            item: String(m.item ?? '-'),
            uraian: String(m.uraian ?? '-'),
            scope: String(m.scope ?? '-'),
            tipe: String(m.tipe ?? '-'),
            status: String(m.status ?? '-'),
        })),
        critical: critical.map(c => ({
            date: String(c.date ?? '-'),
            item: String(c.item ?? '-'),
            deskripsi: String(c.deskripsi ?? '-'),
            scope: String(c.scope ?? '-'),
            foreman: String(c.foreman ?? '-'),
        })),
        internal: {
            ashUnloadings: (internal.ash ?? []).map(a => ({
                silo: String(a.silo ?? '-'),
                perusahaan: String(a.perusahaan ?? '-'),
                tujuan: String(a.tujuan ?? '-'),
                ritase: Number(a.ritase ?? 0),
            })),
            solarMasuk: (internal.solarIn ?? []).map(s => ({
                supplier: String(s.supplier ?? '-'),
                liters: Number(s.liters ?? 0),
            })),
            solarKeluar: (internal.solarOut ?? []).map(s => ({
                tujuan: String(s.tujuan ?? '-'),
                liters: Number(s.liters ?? 0),
            })),
            bunkerBerasap,
        },
    };
}
