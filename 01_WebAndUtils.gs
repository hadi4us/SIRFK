/***************************************************************************
 * Web App
 ***************************************************************************/
function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet(e) {
  if (e && e.parameter && e.parameter.sync === '1') {
    try {
      const msg = importAnggaranKas();
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: msg }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Portal Keuangan OPD 2026')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/***************************************************************************
 * Generic helpers
 ***************************************************************************/
function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(sheetName) {
  return ss_().getSheetByName(sheetName);
}

function getOrCreateSheet_(sheetName) {
  const ss = ss_();
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

function canonicalSheetName_(sheetName) {
  if (sheetName === 'MASTER_ANGKAS') return APP.SHEETS.MASTER_ANGGARAN_KAS;
  return sheetName;
}

function getHeaderForSheet_(sheetName) {
  const canonical = canonicalSheetName_(sheetName);
  return SHEET_HEADERS[canonical] || SHEET_HEADERS[sheetName] || [];
}

function ensureSheetHeaders_(sheetName, headers) {
  const sheet = getOrCreateSheet_(sheetName);
  const expected = headers || getHeaderForSheet_(sheetName);
  if (!expected.length) return sheet;

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    sheet.getRange(1, 1, 1, expected.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const missing = [];
  expected.forEach(function(header) {
    if (current.indexOf(header) === -1) missing.push(header);
  });
  if (missing.length) {
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
    sheet.getRange(1, lastCol + 1, 1, missing.length).setFontWeight('bold');
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function setupAllSheets() {
  Object.keys(SHEET_HEADERS).forEach(function(name) {
    ensureSheetHeaders_(name, SHEET_HEADERS[name]);
  });
  return 'âœ… Semua sheet RFK sudah disiapkan dan header penting sudah dilengkapi.';
}

const REQUEST_CACHE_ = { rawSheets: {}, headerMaps: {}, dpaRows: null, dpaMaps: null, angkasMap: null };

function getRawSheet_(sheetName) {
  if (REQUEST_CACHE_.rawSheets[sheetName]) return REQUEST_CACHE_.rawSheets[sheetName];
  const sheet = getSheet_(sheetName);
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return { headers: [], rows: [] };
  const data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const raw = data.length ? { headers: data[0], rows: data.slice(1) } : { headers: [], rows: [] };
  REQUEST_CACHE_.rawSheets[sheetName] = raw;
  return raw;
}

function getSheetData_(sheetName) {
  const raw = getRawSheet_(sheetName);
  if (!raw.headers.length) return [];
  return raw.rows.map(function(row) {
    const obj = {};
    raw.headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function asNumber_(value) {
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value)
    .replace(/Rp\.?/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  const num = Number(cleaned);
  return isFinite(num) ? num : 0;
}

function safeString_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeKey_(value) {
  return safeString_(value).toLowerCase().replace(/\s+/g, ' ');
}

function headerIndexMapFromHeaders_(headers) {
  const map = {};
  (headers || []).forEach(function(header, idx) {
    const key = normalizeKey_(header);
    if (key) map[key] = idx;
  });
  return map;
}

function getHeaderIndexMap_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return {};
  const key = sheet.getName();
  if (REQUEST_CACHE_.headerMaps[key]) return REQUEST_CACHE_.headerMaps[key];
  const raw = getRawSheet_(key);
  const map = headerIndexMapFromHeaders_(raw.headers);
  REQUEST_CACHE_.headerMaps[key] = map;
  return map;
}

function readCellByHeader_(row, headerMap, names, fallbackIndex) {
  names = Array.isArray(names) ? names : [names];
  for (let i = 0; i < names.length; i++) {
    const idx = headerMap[normalizeKey_(names[i])];
    if (idx !== undefined) return row[idx];
  }
  if (fallbackIndex !== undefined && fallbackIndex !== null) return row[fallbackIndex];
  return '';
}

function normalizeStatus_(status) {
  const raw = safeString_(status);
  if (!raw) return 'Draft';
  const lower = raw.toLowerCase();
  const map = {
    'draft': 'Draft',
    'draf': 'Draft',
    'diajukan': 'Diajukan',
    'diverifikasi': 'Diverifikasi',
    'verifikasi': 'Diverifikasi',
    'terverifikasi': 'Diverifikasi',
    'dibayar': 'Dibayar',
    'bayar': 'Dibayar',
    'batal': 'Batal',
    'ditolak': 'Ditolak',
    'digantikan': 'Digantikan'
  };
  return map[lower] || raw;
}

function round2_(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function monthIndex_(bulan) {
  return APP.MONTHS.indexOf(safeString_(bulan));
}

function isSubKode_(value) {
  return /^\d+(\.\d+)+$/.test(safeString_(value));
}

function isActiveValue_(value) {
  if (value === false) return false;
  const v = safeString_(value).toLowerCase();
  return !(v === 'false' || v === '0' || v === 'tidak' || v === 'nonaktif' || v === 'inactive');
}

function makeId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function cacheJson_(key, builder, ttlSeconds) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key);
  if (hit) {
    try { return JSON.parse(hit); } catch (err) {}
  }
  const value = builder();
  try {
    cache.put(key, JSON.stringify(value), ttlSeconds || APP.CACHE_TTL_SECONDS);
  } catch (err) {}
  return value;
}

function clearRfkCache_(keys) {
  try { CacheService.getScriptCache().removeAll(keys || RFK_CACHE_KEYS); } catch (err) {}
}

function clearSpjMutationCache_() {
  clearRfkCache_([
    'rfk_dashboard_v13',
    'rfk_dashboard_payload_v1',
    'rfk_monitoring_v19',
    'rfk_monitoring_summary_v1',
    'rfk_kendala_v13',
    'rfk_validasi_v13',
    'rfk_spj_list_v13'
  ]);
}

function clearKendalaMutationCache_() {
  clearRfkCache_([
    'rfk_monitoring_v19',
    'rfk_monitoring_summary_v1',
    'rfk_kendala_v13'
  ]);
}

function logActivity_(user, aksi, entitas, idEntitas, beforeValue, afterValue, status, pesan) {
  try {
    const sheet = ensureSheetHeaders_(APP.SHEETS.LOG, SHEET_HEADERS.LOG_AKTIVITAS);
    sheet.appendRow([
      new Date(),
      user || 'system',
      aksi || '',
      entitas || '',
      idEntitas || '',
      beforeValue === undefined ? '' : JSON.stringify(beforeValue),
      afterValue === undefined ? '' : JSON.stringify(afterValue),
      status || 'OK',
      pesan || ''
    ]);
  } catch (err) {
    // Logging must never block RFK operation.
  }
}

