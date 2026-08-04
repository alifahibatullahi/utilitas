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
    headerScanLimit: 30,
  };
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📷 Upload Foto')
    .addItem('Upload foto baris terpilih', 'openUploadPage')
    .addToUi();
}

function openUploadPage() {
  var tpl = HtmlService.createTemplateFromFile('OpenWeb');
  tpl.appUrl = JSON.stringify(getConfig_().appUrl);
  var html = tpl.evaluate().setWidth(620).setHeight(470);
  SpreadsheetApp.getUi().showModalDialog(html, '📷 Upload Foto');
}

function getUploadTarget() {
  return buildTarget_(getConfig_());
}

function buildTarget_(cfg) {
  var recentUrl = cfg.appUrl + '/critical-maintenance?refresh=1';
  var fallback = function (note) {
    return { url: recentUrl, mode: 'recent', note: note };
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
    lupakanHeader_(sheet);
    return fallback('Baris yang dipilih masih kosong — web dibuka di daftar aktivitas terbaru.');
  }

  var uid = readPhotoUid_(sheet, headers, row);
  var url = cfg.appUrl + '/critical-maintenance'
          + '?item=' + encodeURIComponent(itemKeyOf_(item, varian))
          + '&kind=' + encodeURIComponent(kind)
          + '&row=' + row
          + '&sig=' + encodeURIComponent(rowFingerprint_(item, varian, uraian, tanggal));
  if (uid) {
    url += '&foto=' + encodeURIComponent(uid);
  }

  return {
    url: url + '&refresh=1',
    mode: 'record',
    note: '',
    kindLabel: kind === 'critical' ? 'Critical' : 'Maintenance',
    item: item,
    varian: varian,
    uraian: uraian,
    scope: ambil(['scope']),
    pelapor: ambil(['yang melaporkan', 'pelapor']),
    foreman: ambil(['foreman']),
  };
}

function readPhotoUid_(sheet, headers, row) {
  var idx = findHeaderIndex_(headers, ['dokumentasi', 'link foto']);
  if (idx < 0) return '';
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

function headerCacheKey_(sheet) {
  return 'hdr:' + sheet.getSheetId() + ':' + sheet.getLastColumn();
}

function findHeaderRow_(sheet, cfg) {
  var cache = CacheService.getDocumentCache();
  var kunci = headerCacheKey_(sheet);
  if (cache) {
    var tersimpan = cache.get(kunci);
    if (tersimpan) {
      try {
        return JSON.parse(tersimpan);
      } catch (e) {
      }
    }
  }

  var hasil = scanHeaderRow_(sheet, cfg);
  if (hasil && cache) {
    cache.put(kunci, JSON.stringify(hasil), 21600);
  }
  return hasil;
}

function lupakanHeader_(sheet) {
  var cache = CacheService.getDocumentCache();
  if (cache) cache.remove(headerCacheKey_(sheet));
}

function scanHeaderRow_(sheet, cfg) {
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
