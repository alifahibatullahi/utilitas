var APP_URL = 'https://utilitas.vercel.app';
var CRITICAL_GID = 317293896;
var MAINTENANCE_GID = 1401715754;

var CFG_ = null;

function getConfig_() {
  if (CFG_) return CFG_;
  var props = PropertiesService.getScriptProperties().getProperties();
  CFG_ = {
    appUrl: String(props.appUrl || APP_URL).replace(/\/+$/, ''),
    criticalGid: angka_(props.criticalGid, CRITICAL_GID),
    maintenanceGid: angka_(props.maintenanceGid, MAINTENANCE_GID),
    headerScanLimit: 30,
  };
  return CFG_;
}

function angka_(v, bawaan) {
  var n = parseInt(v, 10);
  return isNaN(n) ? bawaan : n;
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📷 Upload Foto')
    .addItem('Upload foto baris terpilih', 'openUploadPage')
    .addToUi();
}

function openUploadPage() {
  var target = buildTarget_(getConfig_());
  var tpl = HtmlService.createTemplateFromFile('OpenWeb');
  tpl.url = JSON.stringify(target.url);
  tpl.note = JSON.stringify(target.note);
  var html = tpl.evaluate().setWidth(430).setHeight(target.note ? 200 : 130);
  SpreadsheetApp.getUi().showModalDialog(html, '📷 Upload Foto');
}

function buildTarget_(cfg) {
  var recentUrl = cfg.appUrl + '/critical-maintenance';
  var fallback = function (note) {
    return { url: recentUrl, note: note };
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
  var vals = sheet.getRange(row, 1, 1, headers.length).getDisplayValues()[0];
  var ambil = function (names) {
    var idx = findHeaderIndex_(headers, names);
    return idx >= 0 ? String(vals[idx] || '').trim() : '';
  };

  var item = ambil(['nama dan nomor item', 'nama item', 'item']);
  var varian = ambil(['varian']);
  var uraian = ambil(['uraian']);
  var tanggal = ambil(['tanggal dilaporkan', 'tanggal']);

  if (!item && !uraian) {
    return fallback('Baris yang dipilih masih kosong — web dibuka di daftar aktivitas terbaru.');
  }

  var sig = rowFingerprint_(item, varian, uraian, tanggal);
  var uid = readPhotoUid_(sheet, headers, row, vals);
  var url = cfg.appUrl + '/critical-maintenance'
          + '?ik=' + encodeURIComponent(itemKeyOf_(item, varian))
          + '&kind=' + encodeURIComponent(kind)
          + '&row=' + row
          + '&sig=' + encodeURIComponent(sig)
          + '&nama=' + encodeURIComponent(item)
          + '&varian=' + encodeURIComponent(varian)
          + '&uraian=' + encodeURIComponent(uraian)
          + '&tgl=' + encodeURIComponent(tanggal);
  if (uid) {
    url += '&foto=' + encodeURIComponent(uid);
  }

  return { url: url, note: '' };
}

function readPhotoUid_(sheet, headers, row, vals) {
  var idx = findHeaderIndex_(headers, ['dokumentasi', 'link foto']);
  if (idx < 0) return '';
  if (!String(vals[idx] == null ? '' : vals[idx]).trim()) return '';
  var formula = String(sheet.getRange(row, idx + 1).getFormula() || '');
  var m = /[?&]foto=([^"&\s]+)/.exec(formula);
  return m ? decodeURIComponent(m[1]) : '';
}

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

function findHeaderRow_(sheet, cfg) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return null;
  var scan = Math.min(sheet.getMaxRows(), cfg.headerScanLimit);
  if (scan < 1) return null;
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
    var b = (bytes[i] & 0xFF).toString(16);
    hex += b.length === 1 ? '0' + b : b;
  }
  return hex.slice(0, 10);
}

function normItem_(item) {
  return String(item == null ? '' : item).replace(/\s+/g, ' ').trim().toUpperCase();
}

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
