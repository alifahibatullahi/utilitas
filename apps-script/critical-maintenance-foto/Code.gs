/**
 * Menu "📷 Upload Foto" — jembatan dari spreadsheet ke Web Utilitas Batubara.
 *
 * Alur operator:
 *   1. isi baris critical/maintenance di spreadsheet seperti biasa
 *   2. pilih barisnya → menu 📷 Upload Foto → "Upload foto baris terpilih"
 *   3. web terbuka di record itu → upload foto dari sana (jalan juga di HP)
 *   4. kolom "Link Foto" baris itu terisi otomatis oleh web
 *
 * Script ini TIDAK MENULIS APA PUN ke spreadsheet — hanya membaca baris terpilih lalu
 * membuka web. Kolom "Dokumentasi" ditulis web (satu penulis saja), dan kolom "ID" sudah
 * tidak dipakai lagi sebagai identitas.
 *
 * Baris yang sudah punya foto membawa uid-nya di dalam formula sel Dokumentasi. Baris
 * yang belum ditunjuk lewat nomor baris + sidik jari isinya; uid-nya baru diterbitkan
 * web saat foto pertama tersimpan.
 *
 * Pasang: Extensions → Apps Script → tempel Code.gs + OpenWeb.html, lalu isi Script
 * Properties (lihat README). Tidak perlu izin Drive.
 */

// ─── Konfigurasi (Script Properties, bukan hardcode) ─────────────────────────
// Project Settings → Script Properties:
//   appUrl         → https://<domain-web>       (tanpa garis miring di akhir)
//   criticalGid    → gid tab Critical Equipment
//   maintenanceGid → gid tab Maintenance
function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  var appUrl = (props.getProperty('appUrl') || '').replace(/\/+$/, '');
  if (!appUrl) {
    throw new Error('Script Property "appUrl" belum diisi. Buka Project Settings → Script Properties.');
  }
  return {
    appUrl: appUrl,
    criticalGid: parseInt(props.getProperty('criticalGid'), 10),
    maintenanceGid: parseInt(props.getProperty('maintenanceGid'), 10),
    headerScanLimit: 30,   // baris header bisa punya preamble di atasnya
  };
}

// ─── Menu ────────────────────────────────────────────────────────────────────

// Nama menu = ikon kamera + "Upload Foto" supaya tujuannya terbaca langsung dari bilah
// menu, tanpa operator perlu membukanya dulu. Item di dalamnya menyebut "baris terpilih"
// karena itu satu-satunya syarat yang sering terlewat.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📷 Upload Foto')
    .addItem('Upload foto baris terpilih', 'openUploadPage')
    .addToUi();
}

/**
 * Buka halaman web untuk baris terpilih. Kalau baris tidak jelas (bukan tab
 * critical/maintenance, atau baris judul), tetap buka web di feed aktivitas terbaru —
 * operator bisa mencari sendiri recordnya di sana.
 */
function openUploadPage() {
  var ui = SpreadsheetApp.getUi();
  var cfg = getConfig_();
  var target = buildTarget_(cfg);

  var tpl = HtmlService.createTemplateFromFile('OpenWeb');
  // OpenWeb.html membacanya lewat scriptlet force-print supaya tanda kutip di dalam
  // JSON tidak ikut di-escape (scriptlet biasa akan merusaknya).
  tpl.ctx = JSON.stringify(target);
  var html = tpl.evaluate().setWidth(420).setHeight(260);
  ui.showModalDialog(html, '📷 Upload Foto');
}

/**
 * Tentukan URL tujuan + ringkasan baris untuk ditampilkan di dialog.
 * Selalu mengembalikan objek yang bisa dipakai — `note` menjelaskan kalau jatuh ke feed.
 */
function buildTarget_(cfg) {
  var recentUrl = cfg.appUrl + '/critical-maintenance?tab=recent&refresh=1';
  var fallback = function (note) {
    return { url: recentUrl, mode: 'recent', note: note, item: '', uraian: '', tanggal: '' };
  };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var gid = sheet.getSheetId();
  var kind = gid === cfg.criticalGid ? 'critical'
           : gid === cfg.maintenanceGid ? 'maintenance'
           : null;
  if (!kind) {
    return fallback('Tab ini bukan Critical Equipment / Maintenance — web dibuka di daftar aktivitas terbaru.');
  }

  var hr = findHeaderRow_(sheet, cfg);
  if (!hr) {
    return fallback('Baris header tidak ditemukan di tab ini — web dibuka di daftar aktivitas terbaru.');
  }

  var row = sheet.getActiveRange().getRow();
  if (row <= hr.row) {
    return fallback('Belum ada baris data yang dipilih — web dibuka di daftar aktivitas terbaru.');
  }

  var headers = hr.headers;
  var vals = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var itemCol = findHeaderIndex_(headers, ['nama dan nomor item', 'nama item', 'item']);
  var varianCol = findHeaderIndex_(headers, ['varian']);
  var uraianCol = findHeaderIndex_(headers, ['uraian']);
  var tglCol = findHeaderIndex_(headers, ['tanggal dilaporkan', 'tanggal']);

  var item = itemCol >= 0 ? String(vals[itemCol] || '').trim() : '';
  var varian = varianCol >= 0 ? String(vals[varianCol] || '').trim() : '';
  var uraian = uraianCol >= 0 ? String(vals[uraianCol] || '').trim() : '';
  var tanggal = tglCol >= 0 ? String(vals[tglCol] || '').trim() : '';

  if (!item && !uraian) {
    return fallback('Baris yang dipilih masih kosong — web dibuka di daftar aktivitas terbaru.');
  }

  // Baris yang SUDAH punya foto membawa uid-nya di dalam formula sel "Dokumentasi".
  // Yang belum, dikenali lewat nomor baris + sidik jari isinya; uid-nya baru diterbitkan
  // web saat foto pertama tersimpan. Script ini tidak menulis apa pun ke spreadsheet.
  var uid = readPhotoUid_(sheet, headers, row);
  var url = cfg.appUrl + '/critical-maintenance?item=' + encodeURIComponent(itemKeyOf_(item, varian));
  if (uid) {
    url += '&foto=' + encodeURIComponent(uid);
  } else {
    url += '&kind=' + encodeURIComponent(kind)
         + '&row=' + row
         + '&sig=' + encodeURIComponent(rowFingerprint_(item, varian, uraian, tanggal));
  }

  return {
    url: url + '&refresh=1',
    mode: 'record',
    note: '',
    kindLabel: kind === 'critical' ? 'Critical' : 'Maintenance',
    item: item,
    uraian: uraian.length > 120 ? uraian.slice(0, 120) + '…' : uraian,
    tanggal: tanggal,
  };
}

/**
 * uid baris dari sel "Dokumentasi" — diambil dari URL di dalam formula HYPERLINK-nya,
 * bukan dari teks yang terlihat. '' bila baris itu belum punya foto.
 */
function readPhotoUid_(sheet, headers, row) {
  var idx = findHeaderIndex_(headers, ['dokumentasi', 'link foto']);
  if (idx < 0) return '';
  var formula = String(sheet.getRange(row, idx + 1).getFormula() || '');
  var m = /[?&]foto=([^"&\s]+)/.exec(formula);
  return m ? decodeURIComponent(m[1]) : '';
}

// ─── Header / kolom helpers ──────────────────────────────────────────────────

/** Normalisasi header, meniru normHeader() di lib/critical-sheet.ts. */
function normHeader_(v) {
  return String(v == null ? '' : v).toLowerCase()
    .replace(/["'.:]/g, '').replace(/\s+/g, ' ').trim();
}

function findHeaderIndex_(headers, names) {
  var norm = headers.map(normHeader_);
  for (var i = 0; i < names.length; i++) {
    var idx = norm.indexOf(normHeader_(names[i]));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Cari baris header — bisa bukan baris 1 karena ada preamble. Meniru findHeader() di
 * lib/critical-sheet.ts: baris pertama yang punya "Nama dan Nomor Item" + "Uraian".
 */
function findHeaderRow_(sheet, cfg) {
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastCol < 1 || lastRow < 1) return null;
  var scan = Math.min(lastRow, cfg.headerScanLimit);
  var block = sheet.getRange(1, 1, scan, lastCol).getDisplayValues();
  for (var i = 0; i < block.length; i++) {
    var headers = block[i];
    if (findHeaderIndex_(headers, ['nama dan nomor item']) >= 0 &&
        findHeaderIndex_(headers, ['uraian']) >= 0) {
      return { row: i + 1, headers: headers };
    }
  }
  return null;
}

// ─── Sidik jari baris (HARUS identik dengan rowFingerprint di lib/critical-sheet.ts) ──
//
// Dipakai untuk menunjuk baris yang BELUM punya foto, karena baris seperti itu belum
// punya uid sama sekali. Nomor baris saja tidak cukup: baris bisa bergeser oleh
// penyisipan di atasnya antara saat menu diklik dan saat foto diunggah — sidik jari inilah
// yang membuat web menolak menempelkan foto ke baris yang keliru.
//
// Kalau rumusnya diubah di satu sisi tanpa sisi lain, upload dari menu ini akan selalu
// gagal dengan "Baris tidak ditemukan lagi".

function normFingerprintPart_(v) {
  return String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim();
}

function rowFingerprint_(item, varian, uraian, tanggalRaw) {
  var bahan = [
    normFingerprintPart_(item),
    normFingerprintPart_(varian),
    normFingerprintPart_(uraian),
    normFingerprintPart_(tanggalRaw)
  ].join('|');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, bahan, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    // computeDigest mengembalikan byte BERTANDA (-128..127) — tanpa & 0xFF, byte di atas
    // 127 menjadi hex negatif dan sidik jarinya tidak akan pernah cocok.
    var b = (bytes[i] & 0xFF).toString(16);
    hex += b.length === 1 ? '0' + b : b;
  }
  return hex.slice(0, 10);
}

// ─── Item key (harus identik dengan lib/critical-sheet.ts) ───────────────────

function normItem_(item) {
  return String(item == null ? '' : item).replace(/\s+/g, ' ').trim().toUpperCase();
}

/**
 * Pecah kolom Varian yang sering diketik gabungan/kotor jadi token tunggal:
 *   "DEF" / "D/E/F" / "D E F" / "A&C" → ['D','E','F'] dst.
 * Halaman item di web memakai token PERTAMA.
 */
function variantTokens_(varian) {
  var cleaned = String(varian == null ? '' : varian).toUpperCase().replace(/[/,&+.\-]/g, ' ');
  var chunks = cleaned.split(/\s+/);
  var tokens = [];
  for (var i = 0; i < chunks.length; i++) {
    var ch = chunks[i].trim();
    if (!ch) continue;
    if (/^[A-Z]+$/.test(ch) && ch.length <= 6) {
      for (var j = 0; j < ch.length; j++) {
        if (tokens.indexOf(ch[j]) < 0) tokens.push(ch[j]);
      }
    } else if (tokens.indexOf(ch) < 0) {
      tokens.push(ch);
    }
  }
  return tokens;
}

function itemKeyOf_(item, varian) {
  var nItem = normItem_(item);
  var tokens = variantTokens_(varian);
  return tokens.length ? (nItem + '|' + tokens[0]) : nItem;
}
