/**
 * Bionex-Zeynara jadvalining Apps Script'i (Расширения → Apps Script).
 * Hammasini shu fayl bilan almashtiring, keyin: Начать развертывание → Управление развертываниями
 * → ✏️ → Версия: Новая версия → Начать развертывание (Новое развертывание EMAS).
 *
 * 1) Sayt (Cloudflare Worker) buyurtmalarni yozadi: toza buyurtma «Lidlar»ga, shubhali «Spam»ga.
 * 2) Worker har 5 daqiqada «Lidlar»dagi «Holat»ni o'qiydi: «Sotildi»/«Kerakli» → Meta'ga Lead.
 * 3) «Holat» = «Kerakli» bo'lganda bu skript o'zi ham Meta'ga QualifiedLead yuboradi (M ustuni).
 *
 * Maxfiy kalitlar kodda emas: Loyiha sozlamalari (⚙) → Script Properties → META_TOKEN, LEAD_SECRET.
 */

const PIXEL_ID   = '1109358048693673';     // Bionex Eco dataset
const SHEET_NAME = 'Lidlar';
const SPAM_SHEET = 'Spam';
const API_VER    = 'v21.0';

// Ustunlar (1 = A)
const COL = { SANA: 2, ISM: 3, TEL: 4, HOLAT: 6, META: 13 };  // M = "Meta" holati

// Qaysi Holat → qaysi Meta event
const EVENT_MAP = {
  'Kerakli': 'QualifiedLead'
  // 'Sotildi' va 'Kerakli' uchun Lead'ni sayt (Worker) yuboradi — shu yerda emas
};

/** Bir marta ishga tushiring: trigger va "Meta" ustunini yaratadi */
function setup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onHolatEdit')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onHolatEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh.getRange(1, COL.META).getValue()) sh.getRange(1, COL.META).setValue('Meta');
  SpreadsheetApp.getActive().toast('Tayyor: Holat o\'zgarganda Metaga yuboriladi.', 'Meta CAPI');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Meta')
    .addItem('Tanlangan qatorni yuborish', 'sendSelectedRow')
    .addItem('Sozlash (setup)', 'setup')
    .addToUi();
}

function onHolatEdit(e) {
  const r = e.range;
  if (r.getSheet().getName() !== SHEET_NAME) return;
  if (r.getColumn() > COL.HOLAT || r.getLastColumn() < COL.HOLAT) return;
  for (let row = r.getRow(); row <= r.getLastRow(); row++) {
    if (row > 1) processRow_(r.getSheet(), row);
  }
}

function sendSelectedRow() {
  const sh = SpreadsheetApp.getActiveSheet();
  processRow_(sh, sh.getActiveRange().getRow());
}

function processRow_(sh, row) {
  const vals  = sh.getRange(row, 1, 1, COL.META).getValues()[0];
  const holat = String(vals[COL.HOLAT - 1]).trim();
  const event = EVENT_MAP[holat];
  if (!event) return;

  const metaCell = sh.getRange(row, COL.META);
  if (String(metaCell.getValue()).indexOf(event + ' ✓') !== -1) return; // allaqachon yuborilgan

  const phone = normPhone_(vals[COL.TEL - 1]);
  if (!phone) { metaCell.setValue('Xato: telefon yo\'q'); return; }

  const userData = { ph: [sha_(phone)], country: [sha_('uz')] };
  const name = String(vals[COL.ISM - 1]).trim().toLowerCase().split(/\s+/)[0];
  if (name) userData.fn = [sha_(name)];

  const payload = {
    data: [{
      event_name: event,
      event_time: Math.floor(Date.now() / 1000),
      event_id: 'zeynara_' + phone + '_' + event,
      action_source: 'system_generated',
      user_data: userData,
      custom_data: { lead_status: holat }
    }]
  };
  const testCode = PropertiesService.getScriptProperties().getProperty('META_TEST_CODE');
  if (testCode) payload.test_event_code = testCode;

  const token = PropertiesService.getScriptProperties().getProperty('META_TOKEN');
  if (!token) { metaCell.setValue('Xato: META_TOKEN yo\'q'); return; }

  const res = UrlFetchApp.fetch(
    'https://graph.facebook.com/' + API_VER + '/' + PIXEL_ID + '/events?access_token=' + encodeURIComponent(token),
    { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true }
  );
  const ok = res.getResponseCode() === 200;
  const stamp = Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM HH:mm');
  metaCell.setValue(ok ? event + ' ✓ ' + stamp : 'Xato: ' + res.getContentText().slice(0, 150));
}

function normPhone_(v) {
  let d = String(v).replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;
  return d.length >= 11 ? d : '';
}

function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/* ================== SAYTDAN LEAD QABUL QILISH ================== */
/**
 * Sayt (Cloudflare Worker) shu web app URL'ga POST yuboradi:
 * { "secret": "...", "sheet": "Lidlar" | "Spam", "headers": [...], "row": [...] }
 * Kalitni olish: setupWebhook() ni bir marta ishga tushiring → Журнал выполнения'da ko'rinadi.
 */
function setupWebhook() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('LEAD_SECRET');
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('LEAD_SECRET', secret);
  }
  Logger.log('LEAD_SECRET = ' + secret);
}

function doPost(e) {
  let data;
  try { data = JSON.parse(e.postData.contents); }
  catch (err) { return ContentService.createTextOutput('bad json'); }

  const secret = PropertiesService.getScriptProperties().getProperty('LEAD_SECRET');
  if (!secret || data.secret !== secret) return ContentService.createTextOutput('forbidden');

  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);

  // Worker har 5 daqiqada so'raydigan format: [[№, Holat], ...] — faqat «Lidlar»dan
  if (data.action === 'statuses') {
    const values = sh.getDataRange().getValues();
    const n = values[0].indexOf('№'), h = values[0].indexOf('Holat');
    const rows = (n >= 0 && h >= 0)
      ? values.slice(1).filter(r => r[n] !== '').map(r => [r[n], r[h]]) : [];
    return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // Shubhali buyurtmalar «Spam» varag'iga, qolganlari «Lidlar»ga
    const spam = data.sheet === SPAM_SHEET;
    const target = spam ? spamSheet_(data.headers) : sh;
    const row = lastDataRow_(target) + 1;
    const head = target.getRange(1, 1, 1, target.getLastColumn()).getValues()[0].map(x => String(x).trim());
    let out;
    if (Array.isArray(data.headers) && Array.isArray(data.row)) {
      out = head.map(hh => { const i = data.headers.indexOf(hh); return i >= 0 ? data.row[i] : ''; });
    } else {
      const sana = Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM.yyyy, HH:mm');
      const map = { '№': data.n || row - 1, 'Sana': data.sana || sana, 'Ism': data.ism, 'Telefon': data.telefon,
        'Izoh': data.izoh, 'Kampaniya': data.kampaniya, 'Ad set': data.adset, 'Video': data.video,
        'Qurilma': data.qurilma, 'Tafsilot': data.tafsilot };
      out = head.map(hh => map[hh] == null ? '' : map[hh]);
    }
    // «Lidlar»da Belgi, Holat va Meta ustunlariga tegmaymiz; «Spam»da Belgi = sababi, yoziladi
    const skip = spam ? ['Holat', 'Meta'] : ['Belgi', 'Holat', 'Meta'];
    out.forEach((val, i) => {
      if (skip.indexOf(head[i]) === -1 && val !== '') target.getRange(row, i + 1).setValue(val);
    });
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

// «Spam» varag'i: bo'lmasa ochadi, bo'sh bo'lsa sarlavha qatorini yozadi
function spamSheet_(headers) {
  const ss = SpreadsheetApp.getActive();
  const sp = ss.getSheetByName(SPAM_SHEET) || ss.insertSheet(SPAM_SHEET);
  if (sp.getLastRow() === 0 && Array.isArray(headers)) {
    sp.getRange(1, 1, 1, headers.length).setValues([headers]);
    sp.setFrozenRows(1);
  }
  return sp;
}

// Oxirgi to'ldirilgan qator (A–D ustunlari bo'yicha; dropdownlar hisobga olinmaydi)
function lastDataRow_(sh) {
  const vals = sh.getRange(1, 1, sh.getMaxRows(), 4).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i].some(v => v !== '' && v !== null)) return i + 1;
  }
  return 1;
}

// Tekshirish: ▶ Выполнить bilan ishga tushiring — «Spam» varag'ida «0 | TEST» paydo bo'lishi kerak (keyin o'chiring)
function testSpam() {
  const secret = PropertiesService.getScriptProperties().getProperty('LEAD_SECRET');
  const r = doPost({ postData: { contents: JSON.stringify({ secret: secret, sheet: SPAM_SHEET, headers: ['№', 'Ism'], row: [0, 'TEST'] }) } });
  Logger.log(r.getContent());
}
