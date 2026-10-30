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
    return;
  }
  if (!cfg.secret) return;
  if (!cfg.rilis) {
    var email = '';
    try {
      email = e && e.user ? String(e.user.getEmail() || '').toLowerCase() : '';
    } catch (err) {
    }
    if (!email || cfg.penguji.indexOf(email) < 0) return;
  }
  SpreadsheetApp.getUi()
    .createMenu(BATUBARA_MENU)
    .addItem('Tambah kedatangan', 'bukaFormKedatangan')
    .addToUi();
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
