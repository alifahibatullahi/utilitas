var BATUBARA_MENU = '🚢 Kedatangan Batubara';
var CATATAN_GID = 457458234;

function cfgBatubara_() {
  var props = PropertiesService.getScriptProperties().getProperties();
  return {
    appUrl: String(props.appUrl || APP_URL).replace(/\/+$/, ''),
    secret: String(props.batubaraSecret || '').trim(),
    penguji: String(props.pengujiBatubara || '').toLowerCase().split(/[\s,;]+/).filter(String),
    rilis: String(props.batubaraRilis || '').trim().toLowerCase() === 'ya',
    catatanGid: angka_(props.catatanGid, CATATAN_GID),
  };
}

function tambahMenuBatubara_(e) {
  var cfg;
  try {
    cfg = cfgBatubara_();
  } catch (err) {
    console.log('Menu batubara disembunyikan: Script Properties tak terbaca (' + err + ')');
    return;
  }
  if (!cfg.secret) {
    console.log('Menu batubara disembunyikan: batubaraSecret kosong');
    return;
  }
  var alasan = cfg.rilis ? 'rilis' : alasanPenguji_(e, cfg);
  if (!alasan) {
    console.log('Menu batubara disembunyikan: bukan penguji');
    return;
  }
  console.log('Menu batubara tampil: ' + alasan);
  SpreadsheetApp.getUi()
    .createMenu(BATUBARA_MENU)
    .addItem('Tambah kedatangan', 'bukaFormKedatangan')
    .addToUi();
}

function alasanPenguji_(e, cfg) {
  try {
    if (PropertiesService.getUserProperties().getProperty('ujiBatubara') === 'ya') return 'penanda uji akun ini';
  } catch (err) {
    console.log('User Properties tak terbaca: ' + err);
  }
  var email = '';
  try {
    email = e && e.user ? String(e.user.getEmail() || '').toLowerCase() : '';
  } catch (err) {
  }
  return email && cfg.penguji.indexOf(email) >= 0 ? 'email penguji' : '';
}

function aktifkanUjiBatubara() {
  PropertiesService.getUserProperties().setProperty('ujiBatubara', 'ya');
  console.log('Menu batubara aktif untuk akun ini. Reload spreadsheet.');
}

function matikanUjiBatubara() {
  PropertiesService.getUserProperties().deleteProperty('ujiBatubara');
  console.log('Menu batubara dimatikan untuk akun ini. Reload spreadsheet.');
}

function bukaFormKedatangan() {
  var cfg = cfgBatubara_();
  var tpl = HtmlService.createTemplateFromFile('KedatanganBatubara');
  tpl.cfg = JSON.stringify({ appUrl: cfg.appUrl, secret: cfg.secret });
  var html = tpl.evaluate().setWidth(480).setHeight(680);
  SpreadsheetApp.getUi().showModalDialog(html, 'Kedatangan Batubara');
}

function bukaBarisCatatan(row) {
  var r = parseInt(row, 10);
  if (!(r > 0)) return false;
  var cfg = cfgBatubara_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === cfg.catatanGid) {
      ss.setActiveSheet(sheets[i]);
      sheets[i].getRange(r, 8).activate();
      return true;
    }
  }
  return false;
}
