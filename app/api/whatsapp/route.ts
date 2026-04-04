import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadToR2, MAX_FILE_SIZE_BYTES } from '@/lib/r2';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── POST — Fonnte webhook (incoming message) ───
// Fonnte mengirim POST ke URL ini setiap ada pesan masuk
export async function POST(req: NextRequest) {
  let body: FonnteWebhookBody;
  try {
    body = await req.json();
  } catch {
    // Fonnte kadang kirim form-data, coba parse sebagai form
    try {
      const form = await req.formData();
      body = Object.fromEntries(form.entries()) as unknown as FonnteWebhookBody;
    } catch {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
  }

  try {
    await processMessage(body);
  } catch (err) {
    console.error('[fonnte/POST]', err);
  }

  // Fonnte expects 200
  return NextResponse.json({ status: 'ok' });
}

// ─── Core processing ───
async function processMessage(body: FonnteWebhookBody) {
  const { sender, message, file, type } = body;

  if (!sender) return;

  // Hanya proses pesan yang punya file (foto)
  if (!file || !type?.toLowerCase().includes('image')) {
    // Kalau pesan teks biasa, balas dengan petunjuk format
    if (type === 'text' && message) {
      await sendFonnteText(sender,
        '📷 *PowerOps Photo Bot*\n\nKirim foto dengan caption:\n  `critical-{id}`\n  `maintenance-{id}`\n\nContoh:\n  `critical-550e8400-e29b-41d4-a716-446655440000`'
      );
    }
    return;
  }

  const caption = message ?? '';

  // ── Parse caption: "critical-{uuid}" atau "maintenance-{uuid}" ──
  const criticalMatch    = caption.match(/critical[- ]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const maintenanceMatch = caption.match(/maintenance[- ]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);

  const criticalId    = criticalMatch?.[1]    ?? null;
  const maintenanceId = maintenanceMatch?.[1] ?? null;

  if (!criticalId && !maintenanceId) {
    await sendFonnteText(sender,
      '❌ Format caption tidak dikenali.\n\nGunakan:\n  `critical-{id}`\n  `maintenance-{id}`'
    );
    return;
  }

  // ── Validasi parent record ada di DB ──
  if (criticalId) {
    const { data } = await supabaseAdmin
      .from('critical_equipment').select('id').eq('id', criticalId).single();
    if (!data) {
      await sendFonnteText(sender, `❌ Critical ID tidak ditemukan:\n${criticalId}`);
      return;
    }
  }
  if (maintenanceId) {
    const { data } = await supabaseAdmin
      .from('maintenance_logs').select('id').eq('id', maintenanceId).single();
    if (!data) {
      await sendFonnteText(sender, `❌ Maintenance ID tidak ditemukan:\n${maintenanceId}`);
      return;
    }
  }

  // ── Download foto dari URL Fonnte ──
  let imageBuffer: Buffer;
  let mimeType: string;
  try {
    ({ buffer: imageBuffer, mimeType } = await downloadFonnteMedia(file));
  } catch (err) {
    console.error('[fonnte] Media download failed:', err);
    await sendFonnteText(sender, '❌ Gagal mengunduh foto. Coba kirim ulang.');
    return;
  }

  // ── Validasi ukuran ──
  if (imageBuffer.length > MAX_FILE_SIZE_BYTES) {
    await sendFonnteText(sender, '❌ Ukuran foto terlalu besar (max 10MB).');
    return;
  }

  // ── Upload ke R2 ──
  const ext        = mimeType.split('/')[1]?.split(';')[0] ?? 'jpg';
  const prefix     = criticalId ? 'critical' : 'maintenance';
  const parentId   = criticalId ?? maintenanceId;
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const r2Key      = `photos/${prefix}/${parentId}/${uniqueName}`;

  let publicUrl: string;
  try {
    publicUrl = await uploadToR2(r2Key, imageBuffer, mimeType);
  } catch (err) {
    console.error('[fonnte] R2 upload failed:', err);
    await sendFonnteText(sender, '❌ Gagal menyimpan foto. Coba lagi.');
    return;
  }

  // ── Simpan ke Supabase ──
  const { error: dbErr } = await supabaseAdmin.from('photos').insert({
    critical_id:    criticalId,
    maintenance_id: maintenanceId,
    url:            publicUrl,
    filename:       uniqueName,
    uploaded_via:   'whatsapp',
    uploaded_by:    sender,
  });

  if (dbErr) {
    console.error('[fonnte] DB insert failed:', dbErr);
    await sendFonnteText(sender, '❌ Gagal menyimpan ke database.');
    return;
  }

  await sendFonnteText(sender, `✅ Foto berhasil disimpan ke ${prefix} record.`);
}

// ─── Fonnte helpers ───

async function downloadFonnteMedia(fileUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const mimeType    = contentType.split(';')[0].trim();
  const buffer      = Buffer.from(await res.arrayBuffer());

  return { buffer, mimeType };
}

async function sendFonnteText(to: string, message: string): Promise<void> {
  const token = process.env.FONNTE_TOKEN!;

  await fetch('https://api.fonnte.com/send', {
    method:  'POST',
    headers: {
      Authorization:  token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ target: to, message }),
  }).catch(err => console.warn('[fonnte] Send failed:', err));
}

// ─── Fonnte webhook payload type ───
interface FonnteWebhookBody {
  device?:   string;
  sender?:   string;   // nomor pengirim: "628xxx..."
  message?:  string;   // caption / teks
  file?:     string;   // URL file media
  filename?: string;
  type?:     string;   // "image", "text", "document", etc.
  token?:    string;
}
