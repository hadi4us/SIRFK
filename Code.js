/***************************************************************************
 * SI-RFK MONITORING APBD 2026 - BACKEND FINAL
 * Perbaikan utama:
 * - Realisasi RFK hanya menghitung SPJ aktif berstatus Diverifikasi/Dibayar.
 * - Mapping DPA-SPJ dinormalisasi: sub_kegiatan_kode, sub_kegiatan_nama,
 *   kode_rekening, uraian_belanja, dan id_dpa.
 * - Export MONITORING_RFK memakai realisasi SPJ, bukan anggaran kas.
 * - Login mendukung migrasi password plain/hash ke salted hash.
 * - Mutasi data memakai session token + validasi role server-side.
 * - Simpan SPJ melakukan validasi total, kode DPA, pagu, dan audit trail.
 ***************************************************************************/

const APP = {
  TIMEZONE: 'Asia/Jakarta',
  TAHUN_DEFAULT: '2026',
  OPD_KODE: '1.02.0.00.0.00.01.0000',
  OPD_NAMA: 'DINAS KESEHATAN',
  BIDANG_DEFAULT: 'Bidang P2P',
  SHEETS: {
    CONFIG: 'CONFIG',
    USER_ROLE: 'USER_ROLE',
    MASTER_DPA: 'MASTER_DPA',
    MASTER_ANGKAS: 'MASTER_ANGGARAN_KAS',
    MASTER_ANGGARAN_KAS: 'MASTER_ANGGARAN_KAS',
    MASTER_SUMBER_DANA: 'MASTER_SUMBER_DANA',
    MASTER_INDIKATOR: 'MASTER_INDIKATOR',
    MASTER_PELAKSANA: 'MASTER_PELAKSANA',
    KENDALA_LOG: 'KENDALA_LOG',
    SPJ_HEADER: 'SPJ_HEADER',
    SPJ_DETAIL: 'SPJ_DETAIL',
    SPJ_DETAIL_HISTORY: 'SPJ_DETAIL_HISTORY',
    SPJ_DOKUMEN: 'SPJ_DOKUMEN',
    MONITORING_RFK: 'MONITORING_RFK',
    VALIDASI_ANGKAS: 'VALIDASI_ANGKAS',
    REALISASI_AUTO: 'REALISASI_AUTO',
    LOG: 'LOG_AKTIVITAS'
  },
  MONTHS: [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ],
  CACHE_TTL_SECONDS: 300,
  SESSION_TTL_SECONDS: 21600,
  REALISASI_VALID_STATUSES: ['Diverifikasi', 'Dibayar'],
  SPJ_ACTIVE_STATUSES: ['Draft', 'Diajukan', 'Diverifikasi', 'Dibayar'],
  SPJ_STATUSES: ['Draft', 'Diajukan', 'Diverifikasi', 'Dibayar', 'Batal', 'Ditolak'],
  MUTATION_ROLES: ['ADMIN', 'OPERATOR', 'PPTK'],
  APPROVAL_ROLES: ['ADMIN', 'OPERATOR', 'PPTK', 'VERIFIKATOR', 'BENDAHARA'],
  VIEW_ROLES: ['ADMIN', 'OPERATOR', 'PPTK', 'VERIFIKATOR', 'BENDAHARA', 'VIEWER']
};

const RFK_CACHE_KEYS = [
  'rfk_dashboard_v13',
  'rfk_dashboard_payload_v1',
  'rfk_dpa_list_v16',
  'rfk_monitoring_v19',
  'rfk_monitoring_summary_v1',
  'rfk_kendala_v13',
  'rfk_validasi_v13',
  'rfk_dpa_hierarki_v14',
  'rfk_pelaksana_list_v1',
  'rfk_spj_list_v13'
];

const COL_DPA = {
  ID_DPA: 0,
  KODE_OPD: 1,
  NAMA_OPD: 2,
  PROGRAM: 3,
  SUB_NAMA: 4,
  SUB_KODE: 5,
  KODE_REKENING: 6,
  URAIAN_BELANJA: 7,
  VOLUME: 8,
  SATUAN: 9,
  HARGA_SATUAN: 10,
  PAGU_TOTAL: 11,
  SUMBER_DANA: 12,
  TAHUN: 13,
  STATUS: 14
};

const COL_ANGKAS = {
  ID_KAS: 0,
  SUB_KODE: 1,
  SUB_NAMA: 2,
  TW1: 3,
  TW2: 4,
  TW3: 5,
  TW4: 6,
  TOTAL: 7,
  BULAN_START: 8,
  TAHUN: 20,
  KODE_REKENING: null,
  URAIAN_BELANJA: null,
  DETAIL_KEGIATAN: null,
  SUB_RINCIAN: null,
  PAGU_DPA_REFERENSI: null,
  METODE_ALOKASI: null,
  SOURCE_PDF: null
};

const COL_SPJ_HEADER = {
  ID_SPJ: 0,
  NOMOR_SPJ: 1,
  TANGGAL_SPJ: 2,
  TAHUN: 3,
  BULAN: 4,
  OPD: 5,
  BIDANG: 6,
  PPTK: 7,
  PENERIMA: 8,
  STATUS: 9,
  JENIS_SPJ: 10,
  KETERANGAN: 11,
  TOTAL_BRUTO: 12,
  TOTAL_POTONGAN: 13,
  TOTAL_NETTO: 14,
  CREATED_AT: 15,
  CREATED_BY: 16,
  UPDATED_AT: 17,
  UPDATED_BY: 18
};

const COL_SPJ_DETAIL = {
  ID_DETAIL: 0,
  ID_SPJ: 1,
  TAHUN: 2,
  BULAN: 3,
  OPD: 4,
  BIDANG: 5,
  SUB_KODE: 6,
  SUB_NAMA: 7,
  KODE_REKENING: 8,
  URAIAN_BELANJA: 9,
  PELAKSANA: 10,
  NILAI_BRUTO: 11,
  POTONGAN: 12,
  NILAI_NETTO: 13,
  PAGU_REFERENSI: 14,
  JENIS_SPJ: 15,
  STATUS: 16,
  CATATAN: 17,
  TW1: 18,
  TW2: 19,
  TW3: 20,
  TW4: 21,
  VALIDASI_STATUS: 22,
  KETERANGAN: 23,
  CREATED_AT: 24,
  CREATED_BY: 25,
  TANGGAL_SPJ: 26,
  ID_DPA: 27,
  IS_ACTIVE: 28,
  UPDATED_AT: 29,
  UPDATED_BY: 30
};

const SHEET_HEADERS = {
  MASTER_SUMBER_DANA: ['id_sumber', 'nama_sumber', 'jenis', 'keterangan'],
  MASTER_DPA: [
    'id_dpa', 'kode_opd', 'nama_opd', 'program', 'sub_kegiatan', 'sub_kode',
    'kode_rekening', 'uraian_belanja', 'volume', 'satuan', 'harga_satuan',
    'pagu_total', 'sumber_dana', 'tahun', 'status',
    'detail_kegiatan', 'sub_rincian', 'level_rincian', 'source_pdf'
  ],
  MASTER_ANGGARAN_KAS: [
    'id_kas', 'sub_kegiatan_kode', 'sub_kegiatan_nama',
    'kode_rekening', 'uraian_belanja',
    'tw_1', 'tw_2', 'tw_3', 'tw_4', 'total',
    'bulan_januari', 'bulan_februari', 'bulan_maret', 'bulan_april',
    'bulan_mei', 'bulan_juni', 'bulan_juli', 'bulan_agustus',
    'bulan_september', 'bulan_oktober', 'bulan_november', 'bulan_desember',
    'tahun', 'detail_kegiatan', 'sub_rincian', 'pagu_dpa_referensi', 'metode_alokasi', 'source_pdf'
  ],
  MASTER_INDIKATOR: [
    'id_indikator', 'sub_kegiatan_kode', 'sub_kegiatan_nama',
    'nama_indikator', 'target_kinerja', 'keluaran', 'tahun'
  ],
  MASTER_PELAKSANA: [
    'id_pelaksana', 'nama_pelaksana', 'jabatan', 'unit', 'status'
  ],
  KENDALA_LOG: [
    'id_kendala', 'sub_kegiatan_kode', 'bulan', 'tahun',
    'permasalahan', 'solusi', 'status_penyelesaian',
    'tgl_input', 'input_by'
  ],
  USER_ROLE: ['username_email', 'role', 'password', 'nama_lengkap', 'status'],
  SPJ_HEADER: [
    'id_spj', 'nomor_spj', 'tanggal_spj', 'tahun', 'bulan', 'opd', 'bidang',
    'pptk', 'penerima', 'status_spj', 'jenis_spj', 'keterangan',
    'total_bruto', 'total_potongan', 'total_netto', 'created_at', 'created_by',
    'updated_at', 'updated_by'
  ],
  SPJ_DETAIL: [
    'id_detail', 'id_spj', 'tahun', 'bulan', 'opd', 'bidang',
    'sub_kegiatan_kode', 'sub_kegiatan_nama', 'kode_rekening', 'uraian_belanja',
    'pelaksana', 'nilai_bruto', 'potongan', 'nilai_netto', 'pagu_referensi',
    'jenis_spj', 'status_spj', 'catatan', 'tw_1', 'tw_2', 'tw_3', 'tw_4',
    'validasi_status', 'keterangan', 'created_at', 'created_by', 'tanggal_spj',
    'id_dpa', 'is_active', 'updated_at', 'updated_by'
  ],
  SPJ_DETAIL_HISTORY: [
    'timestamp', 'aksi', 'id_spj', 'id_detail', 'data_json', 'user'
  ],
  SPJ_DOKUMEN: [
    'id_dokumen', 'id_spj', 'nama_file', 'mime_type', 'drive_file_id', 'drive_url', 'uploaded_at', 'uploaded_by', 'keterangan'
  ],
  LOG_AKTIVITAS: [
    'timestamp', 'user', 'aksi', 'entitas', 'id_entitas',
    'nilai_sebelum_json', 'nilai_sesudah_json', 'status', 'pesan'
  ],
  VALIDASI_ANGKAS: [
    'kode', 'nama', 'pagu', 'angkas', 'selisih', 'status', 'catatan'
  ]
};

/***************************************************************************
 * Web App
 ***************************************************************************/
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
    'rfk_dpa_list_v16',
    'rfk_spj_list_v13'
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

/***************************************************************************
 * Auth and session
 ***************************************************************************/
function hashPassword_(plainText) {
  const bytes = Utilities.newBlob(String(plainText || '')).getBytes();
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return hash.map(function(b) { return (b & 0xFF).toString(16).padStart(2, '0'); }).join('');
}

function saltedPasswordHash_(username, password) {
  return hashPassword_(normalizeKey_(username) + '|' + String(password || ''));
}

function verifyPassword_(storedPassword, inputPassword, username) {
  const stored = safeString_(storedPassword);
  const input = String(inputPassword || '');
  if (!stored) return false;

  if (stored.indexOf('sha256$') === 0) {
    return stored === 'sha256$' + saltedPasswordHash_(username, input);
  }

  // Backward compatibility: old ubahPassword() stored plain SHA-256 without salt.
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    return stored.toLowerCase() === hashPassword_(input).toLowerCase();
  }

  // Backward compatibility: initial USER_ROLE used plain text password.
  return stored === input;
}

function getUserRowByUsername_(username) {
  const sheet = ensureSheetHeaders_(APP.SHEETS.USER_ROLE, SHEET_HEADERS.USER_ROLE);
  const data = sheet.getDataRange().getValues();
  const usernameClean = normalizeKey_(username);
  for (let i = 1; i < data.length; i++) {
    const rowUser = normalizeKey_(data[i][0]);
    if (rowUser && rowUser === usernameClean) {
      return { sheet: sheet, rowNumber: i + 1, row: data[i] };
    }
  }
  return null;
}

function getUserByUsername_(username) {
  const found = getUserRowByUsername_(username);
  if (!found) return null;
  const row = found.row;
  const status = safeString_(row[4] || 'Aktif');
  if (status && status.toLowerCase() !== 'aktif') return null;
  return {
    email: safeString_(row[0]),
    role: safeString_(row[1] || 'VIEWER').toUpperCase(),
    nama: safeString_(row[3] || row[0])
  };
}

function createSession_(user) {
  const token = Utilities.getUuid();
  const payload = {
    email: user.email,
    role: user.role,
    nama: user.nama,
    createdAt: new Date().toISOString()
  };
  CacheService.getScriptCache().put('rfk_session_' + token, JSON.stringify(payload), APP.SESSION_TTL_SECONDS);
  return token;
}

function getSession_(token) {
  const tokenClean = safeString_(token);
  if (!tokenClean) return null;
  const raw = CacheService.getScriptCache().get('rfk_session_' + tokenClean);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}

function requireSession_(token, allowedRoles) {
  const session = getSession_(token);
  if (!session) throw new Error('Sesi login tidak valid atau sudah kedaluwarsa. Silakan login ulang.');
  const role = safeString_(session.role).toUpperCase();
  const allowed = (allowedRoles || APP.VIEW_ROLES).map(function(r) { return String(r).toUpperCase(); });
  if (allowed.indexOf(role) === -1) {
    throw new Error('Akses ditolak. Role ' + role + ' tidak berwenang untuk aksi ini.');
  }
  return session;
}

function prosesLoginKustom(username, password) {
  try {
    setupAllSheets();
    const found = getUserRowByUsername_(username);
    if (!found) {
      return { success: false, message: 'Kombinasi Username/Password salah atau tidak terdaftar.' };
    }

    const row = found.row;
    const user = {
      email: safeString_(row[0]),
      role: safeString_(row[1] || 'VIEWER').toUpperCase(),
      nama: safeString_(row[3] || row[0])
    };
    const status = safeString_(row[4] || 'Aktif');
    if (status && status.toLowerCase() !== 'aktif') {
      return { success: false, message: 'Akun tidak aktif. Hubungi administrator.' };
    }

    if (!verifyPassword_(row[2], password, user.email)) {
      logActivity_(user.email, 'LOGIN_GAGAL', 'USER_ROLE', user.email, null, null, 'FAILED', 'Password salah');
      return { success: false, message: 'Kombinasi Username/Password salah atau tidak terdaftar.' };
    }

    const stored = safeString_(row[2]);
    if (stored.indexOf('sha256$') !== 0) {
      found.sheet.getRange(found.rowNumber, 3).setValue('sha256$' + saltedPasswordHash_(user.email, password));
    }

    const token = createSession_(user);
    logActivity_(user.email, 'LOGIN', 'USER_ROLE', user.email, null, { role: user.role }, 'OK', 'Login berhasil');

    const stats = getDashboardStats_uncached_();
    return {
      success: true,
      user: user,
      token: token,
      sessionExpiresInSeconds: APP.SESSION_TTL_SECONDS,
      months: APP.MONTHS,
      stats: { pagu: stats.totalPagu, serapan: stats.totalRealisasi }
    };
  } catch (err) {
    return { success: false, message: 'Kesalahan Sistem: ' + err.message };
  }
}


function getCurrentSessionInfo(sessionToken) {
  try {
    const session = requireSession_(sessionToken, APP.VIEW_ROLES);
    return {
      success: true,
      user: {
        email: session.email,
        role: session.role,
        nama: session.nama
      },
      sessionExpiresInSeconds: APP.SESSION_TTL_SECONDS,
      months: APP.MONTHS
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function ubahPassword(username, lama, baru) {
  try {
    setupAllSheets();
    if (!username || !lama || !baru) throw new Error('Username, password lama, dan password baru wajib diisi.');
    if (String(baru).length < 6) throw new Error('Password baru minimal 6 karakter.');

    const found = getUserRowByUsername_(username);
    if (!found) return { success: false, message: 'Username tidak ditemukan.' };

    if (!verifyPassword_(found.row[2], lama, found.row[0])) {
      logActivity_(found.row[0], 'UBAH_PASSWORD_GAGAL', 'USER_ROLE', found.row[0], null, null, 'FAILED', 'Password lama salah');
      return { success: false, message: 'Password lama salah.' };
    }

    found.sheet.getRange(found.rowNumber, 3).setValue('sha256$' + saltedPasswordHash_(found.row[0], baru));
    logActivity_(found.row[0], 'UBAH_PASSWORD', 'USER_ROLE', found.row[0], null, { changed: true }, 'OK', 'Password berhasil diubah');
    return { success: true, message: 'Password berhasil diubah. Silakan login memakai password baru.' };
  } catch (err) {
    return { success: false, message: 'Error: ' + err.message };
  }
}

/***************************************************************************
 * Master-data loaders
 ***************************************************************************/
function getDpaRows_() {
  if (REQUEST_CACHE_.dpaRows) return REQUEST_CACHE_.dpaRows;
  const sheet = getSheet_(APP.SHEETS.MASTER_DPA);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const raw = getRawSheet_(APP.SHEETS.MASTER_DPA);
  const data = [raw.headers].concat(raw.rows);
  const headerMap = headerIndexMapFromHeaders_(raw.headers);
  const idxDetail = headerMap[normalizeKey_('detail_kegiatan')];
  const idxSubRincian = headerMap[normalizeKey_('sub_rincian')];
  const idxLevel = headerMap[normalizeKey_('level_rincian')];
  const idxSource = headerMap[normalizeKey_('source_pdf')];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const idDpa = safeString_(row[COL_DPA.ID_DPA]);
    if (!idDpa) continue;
    const status = safeString_(row[COL_DPA.STATUS] || 'Aktif');
    if (status && status.toLowerCase() !== 'aktif') continue;
    rows.push({
      rowNumber: i + 1,
      id_dpa: idDpa,
      kode_opd: safeString_(row[COL_DPA.KODE_OPD]),
      nama_opd: safeString_(row[COL_DPA.NAMA_OPD]),
      program: safeString_(row[COL_DPA.PROGRAM]),
      sub_kegiatan_nama: safeString_(row[COL_DPA.SUB_NAMA]),
      sub_kegiatan_kode: safeString_(row[COL_DPA.SUB_KODE]),
      kode_rekening: safeString_(row[COL_DPA.KODE_REKENING]),
      uraian_belanja: safeString_(row[COL_DPA.URAIAN_BELANJA]),
      pagu_total: asNumber_(row[COL_DPA.PAGU_TOTAL]),
      sumber_dana: safeString_(row[COL_DPA.SUMBER_DANA]),
      tahun: safeString_(row[COL_DPA.TAHUN] || APP.TAHUN_DEFAULT),
      detail_kegiatan: idxDetail !== undefined ? safeString_(row[idxDetail]) : '',
      sub_rincian: idxSubRincian !== undefined ? safeString_(row[idxSubRincian]) : '',
      level_rincian: idxLevel !== undefined ? safeString_(row[idxLevel]) : '',
      source_pdf: idxSource !== undefined ? safeString_(row[idxSource]) : ''
    });
  }
  REQUEST_CACHE_.dpaRows = rows;
  return rows;
}

function getDpaMaps_() {
  if (REQUEST_CACHE_.dpaMaps) return REQUEST_CACHE_.dpaMaps;
  const rows = getDpaRows_();
  const byId = {};
  const byExact = {};
  const bySubRek = {};
  const subNameToCode = {};
  const subCodeInfo = {};

  rows.forEach(function(item) {
    byId[item.id_dpa] = item;
    const exactKey = [item.sub_kegiatan_kode, item.kode_rekening, item.uraian_belanja].map(normalizeKey_).join('|');
    byExact[exactKey] = item;
    const subRekKey = [item.sub_kegiatan_kode, item.kode_rekening].map(normalizeKey_).join('|');
    if (!bySubRek[subRekKey]) bySubRek[subRekKey] = [];
    bySubRek[subRekKey].push(item);
    if (item.sub_kegiatan_nama) subNameToCode[normalizeKey_(item.sub_kegiatan_nama)] = item.sub_kegiatan_kode;

    if (!subCodeInfo[item.sub_kegiatan_kode]) {
      subCodeInfo[item.sub_kegiatan_kode] = {
        kode: item.sub_kegiatan_kode,
        nama: item.sub_kegiatan_nama,
        sumberDana: item.sumber_dana,
        pagu: 0,
        tahun: item.tahun
      };
    }
    subCodeInfo[item.sub_kegiatan_kode].pagu += item.pagu_total;
  });

  REQUEST_CACHE_.dpaMaps = {
    rows: rows,
    byId: byId,
    byExact: byExact,
    bySubRek: bySubRek,
    subNameToCode: subNameToCode,
    subCodeInfo: subCodeInfo
  };
  return REQUEST_CACHE_.dpaMaps;
}

function getAngkasMap_() {
  if (REQUEST_CACHE_.angkasMap) return REQUEST_CACHE_.angkasMap;
  const sheet = getSheet_(APP.SHEETS.MASTER_ANGGARAN_KAS);
  const map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;
  const raw = getRawSheet_(APP.SHEETS.MASTER_ANGGARAN_KAS);
  const data = [raw.headers].concat(raw.rows);
  const headerMap = headerIndexMapFromHeaders_(raw.headers);
  const hasDetailFormat = headerMap[normalizeKey_('kode_rekening')] !== undefined || headerMap[normalizeKey_('uraian_belanja')] !== undefined;
  const idx = {
    id: headerMap[normalizeKey_('id_kas')] !== undefined ? headerMap[normalizeKey_('id_kas')] : COL_ANGKAS.ID_KAS,
    kode: headerMap[normalizeKey_('sub_kegiatan_kode')] !== undefined ? headerMap[normalizeKey_('sub_kegiatan_kode')] : COL_ANGKAS.SUB_KODE,
    nama: headerMap[normalizeKey_('sub_kegiatan_nama')] !== undefined ? headerMap[normalizeKey_('sub_kegiatan_nama')] : COL_ANGKAS.SUB_NAMA,
    kodeRekening: headerMap[normalizeKey_('kode_rekening')],
    uraianBelanja: headerMap[normalizeKey_('uraian_belanja')],
    tw1: headerMap[normalizeKey_('tw_1')] !== undefined ? headerMap[normalizeKey_('tw_1')] : COL_ANGKAS.TW1,
    tw2: headerMap[normalizeKey_('tw_2')] !== undefined ? headerMap[normalizeKey_('tw_2')] : COL_ANGKAS.TW2,
    tw3: headerMap[normalizeKey_('tw_3')] !== undefined ? headerMap[normalizeKey_('tw_3')] : COL_ANGKAS.TW3,
    tw4: headerMap[normalizeKey_('tw_4')] !== undefined ? headerMap[normalizeKey_('tw_4')] : COL_ANGKAS.TW4,
    total: headerMap[normalizeKey_('total')] !== undefined ? headerMap[normalizeKey_('total')] : COL_ANGKAS.TOTAL,
    tahun: headerMap[normalizeKey_('tahun')] !== undefined ? headerMap[normalizeKey_('tahun')] : COL_ANGKAS.TAHUN,
    detailKegiatan: headerMap[normalizeKey_('detail_kegiatan')],
    subRincian: headerMap[normalizeKey_('sub_rincian')],
    paguRef: headerMap[normalizeKey_('pagu_dpa_referensi')],
    metodeAlokasi: headerMap[normalizeKey_('metode_alokasi')],
    sourcePdf: headerMap[normalizeKey_('source_pdf')]
  };
  const bulanNames = [
    'bulan_januari', 'bulan_februari', 'bulan_maret', 'bulan_april',
    'bulan_mei', 'bulan_juni', 'bulan_juli', 'bulan_agustus',
    'bulan_september', 'bulan_oktober', 'bulan_november', 'bulan_desember'
  ];
  const bulanIdx = bulanNames.map(function(name, i) {
    if (headerMap[normalizeKey_(name)] !== undefined) return headerMap[normalizeKey_(name)];
    return (hasDetailFormat ? 10 : COL_ANGKAS.BULAN_START) + i;
  });

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const kode = safeString_(row[idx.kode]);
    if (!kode) continue;
    const bulanan = bulanIdx.map(function(col) { return asNumber_(row[col]); });
    const tw = [asNumber_(row[idx.tw1]), asNumber_(row[idx.tw2]), asNumber_(row[idx.tw3]), asNumber_(row[idx.tw4])];
    const totalBulanan = bulanan.reduce(function(a, b) { return a + b; }, 0);
    const totalTw = tw.reduce(function(a, b) { return a + b; }, 0);
    const total = totalBulanan;
    if (!map[kode]) {
      map[kode] = {
        kode: kode,
        nama: safeString_(row[idx.nama]),
        tw: [0, 0, 0, 0],
        bulanan: APP.MONTHS.map(function() { return 0; }),
        total: 0,
        totalBulanan: 0,
        totalTw: 0,
        tahun: safeString_(row[idx.tahun] || APP.TAHUN_DEFAULT),
        details: []
      };
    }
    for (let m = 0; m < 12; m++) map[kode].bulanan[m] += bulanan[m] || 0;
    for (let q = 0; q < 4; q++) map[kode].tw[q] += tw[q] || 0;
    map[kode].total += total;
    map[kode].totalBulanan += totalBulanan;
    map[kode].totalTw += totalTw;
    map[kode].details.push({
      id_kas: safeString_(row[idx.id]),
      kode: kode,
      nama: safeString_(row[idx.nama]),
      kode_rekening: idx.kodeRekening !== undefined ? safeString_(row[idx.kodeRekening]) : '',
      uraian_belanja: idx.uraianBelanja !== undefined ? safeString_(row[idx.uraianBelanja]) : '',
      detail_kegiatan: idx.detailKegiatan !== undefined ? safeString_(row[idx.detailKegiatan]) : '',
      sub_rincian: idx.subRincian !== undefined ? safeString_(row[idx.subRincian]) : '',
      pagu_dpa_referensi: idx.paguRef !== undefined ? asNumber_(row[idx.paguRef]) : 0,
      metode_alokasi: idx.metodeAlokasi !== undefined ? safeString_(row[idx.metodeAlokasi]) : '',
      source_pdf: idx.sourcePdf !== undefined ? safeString_(row[idx.sourcePdf]) : '',
      tw: tw,
      bulanan: bulanan,
      total: total,
      totalBulanan: totalBulanan,
      totalTw: totalTw,
      tahun: safeString_(row[idx.tahun] || APP.TAHUN_DEFAULT)
    });
  }
  REQUEST_CACHE_.angkasMap = map;
  return map;
}

function getIndikatorMap_() {
  const sheet = getSheet_(APP.SHEETS.MASTER_INDIKATOR);
  const map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const kode = safeString_(data[i][1]);
    if (!kode) continue;
    map[kode] = {
      nama: safeString_(data[i][3] || '-'),
      target: safeString_(data[i][4] || '-'),
      keluaran: safeString_(data[i][5] || '')
    };
  }
  return map;
}

function getHeaderStatusMap_() {
  if (REQUEST_CACHE_.headerStatusMap) return REQUEST_CACHE_.headerStatusMap;
  const sheet = getSheet_(APP.SHEETS.SPJ_HEADER);
  const map = {};
  if (!sheet) return map;
  const raw = getRawSheet_(APP.SHEETS.SPJ_HEADER);
  if (!raw || !raw.headers || !raw.headers.length) return map;
  const idx = headerIndexMapFromHeaders_(raw.headers);
  const statusIdx = idx[normalizeKey_('status_spj')] !== undefined ? idx[normalizeKey_('status_spj')] : COL_SPJ_HEADER.STATUS;
  const idIdx = idx[normalizeKey_('id_spj')] !== undefined ? idx[normalizeKey_('id_spj')] : COL_SPJ_HEADER.ID_SPJ;
  raw.rows.forEach(function(row) {
    const id = safeString_(row[idIdx]);
    if (id) map[id] = normalizeStatus_(row[statusIdx]);
  });
  REQUEST_CACHE_.headerStatusMap = map;
  return map;
}

function resolveDpaFromDetailRow_(row, maps) {
  const idDpa = safeString_(row[COL_SPJ_DETAIL.ID_DPA]);
  if (idDpa && maps.byId[idDpa]) return maps.byId[idDpa];

  let subKode = safeString_(row[COL_SPJ_DETAIL.SUB_KODE]);
  const subNama = safeString_(row[COL_SPJ_DETAIL.SUB_NAMA]);
  const kodeRek = safeString_(row[COL_SPJ_DETAIL.KODE_REKENING]);
  const uraian = safeString_(row[COL_SPJ_DETAIL.URAIAN_BELANJA]);

  if (!isSubKode_(subKode)) {
    if (isSubKode_(kodeRek) && maps.subCodeInfo[kodeRek]) {
      // Legacy rows: old kode_rekening column contained sub_kegiatan_kode.
      subKode = kodeRek;
    } else if (maps.subNameToCode[normalizeKey_(subKode)]) {
      subKode = maps.subNameToCode[normalizeKey_(subKode)];
    } else if (maps.subNameToCode[normalizeKey_(subNama)]) {
      subKode = maps.subNameToCode[normalizeKey_(subNama)];
    }
  }

  const exactKey = [subKode, kodeRek, uraian].map(normalizeKey_).join('|');
  if (maps.byExact[exactKey]) return maps.byExact[exactKey];

  const subRekKey = [subKode, kodeRek].map(normalizeKey_).join('|');
  if (maps.bySubRek[subRekKey] && maps.bySubRek[subRekKey].length === 1) return maps.bySubRek[subRekKey][0];

  if (subKode && maps.subCodeInfo[subKode]) {
    return {
      id_dpa: '',
      sub_kegiatan_kode: subKode,
      sub_kegiatan_nama: maps.subCodeInfo[subKode].nama,
      kode_rekening: kodeRek,
      uraian_belanja: uraian,
      pagu_total: maps.subCodeInfo[subKode].pagu,
      sumber_dana: maps.subCodeInfo[subKode].sumberDana,
      tahun: maps.subCodeInfo[subKode].tahun
    };
  }
  return null;
}

function getRealisasiAggregates_(statusFilter) {
  const cacheKey = 'real_agg_' + (statusFilter ? statusFilter.join('_') : 'all');
  if (REQUEST_CACHE_[cacheKey]) return REQUEST_CACHE_[cacheKey];
  const detailSheet = getSheet_(APP.SHEETS.SPJ_DETAIL);
  const result = {
    total: 0,
    bySub: {},
    bySubMonth: {},
    byDpa: {},
    byDpaMonth: {},
    byStatus: {},
    rowsCounted: 0,
    rowsSkipped: 0
  };
  if (!detailSheet || detailSheet.getLastRow() < 2) {
    REQUEST_CACHE_[cacheKey] = result;
    return result;
  }

  const allowed = statusFilter ? statusFilter.map(String) : null;
  const headerStatusMap = getHeaderStatusMap_();
  const maps = getDpaMaps_();
  const raw = getRawSheet_(APP.SHEETS.SPJ_DETAIL);
  const data = [raw.headers].concat(raw.rows);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const idSpj = safeString_(row[COL_SPJ_DETAIL.ID_SPJ]);
    if (!idSpj) continue;

    if (row.length > COL_SPJ_DETAIL.IS_ACTIVE && !isActiveValue_(row[COL_SPJ_DETAIL.IS_ACTIVE])) {
      result.rowsSkipped++;
      continue;
    }

    const status = normalizeStatus_(headerStatusMap[idSpj] || row[COL_SPJ_DETAIL.STATUS]);
    result.byStatus[status] = (result.byStatus[status] || 0) + asNumber_(row[COL_SPJ_DETAIL.NILAI_BRUTO]);
    if (allowed && allowed.indexOf(status) === -1) {
      result.rowsSkipped++;
      continue;
    }

    const dpa = resolveDpaFromDetailRow_(row, maps);
    if (!dpa || !dpa.sub_kegiatan_kode) {
      result.rowsSkipped++;
      continue;
    }

    const nilai = asNumber_(row[COL_SPJ_DETAIL.NILAI_BRUTO]);
    const bulan = safeString_(row[COL_SPJ_DETAIL.BULAN]);
    const idx = monthIndex_(bulan);
    const subKode = dpa.sub_kegiatan_kode;
    const dpaKey = dpa.id_dpa || [subKode, dpa.kode_rekening, dpa.uraian_belanja].map(normalizeKey_).join('|');

    result.total += nilai;
    result.bySub[subKode] = (result.bySub[subKode] || 0) + nilai;
    if (!result.bySubMonth[subKode]) result.bySubMonth[subKode] = {};
    if (idx >= 0) result.bySubMonth[subKode][idx] = (result.bySubMonth[subKode][idx] || 0) + nilai;
    result.byDpa[dpaKey] = (result.byDpa[dpaKey] || 0) + nilai;
    if (!result.byDpaMonth[dpaKey]) result.byDpaMonth[dpaKey] = {};
    if (idx >= 0) result.byDpaMonth[dpaKey][idx] = (result.byDpaMonth[dpaKey][idx] || 0) + nilai;
    if (!result.byMonth) result.byMonth = {};
    if (idx >= 0) result.byMonth[idx] = (result.byMonth[idx] || 0) + nilai;
    result.rowsCounted++;
  }
  REQUEST_CACHE_[cacheKey] = result;
  return result;
}

/***************************************************************************
 * Public read functions
 ***************************************************************************/
function getDashboardStats() { return cacheJson_('rfk_dashboard_v13', getDashboardStats_uncached_); }
function getDashboardPayload() { return cacheJson_('rfk_dashboard_payload_v1', getDashboardPayload_uncached_, 300); }
function getDpaList() { return cacheJson_('rfk_dpa_list_v16', getDpaList_uncached_); }
function getMonitoringRFKData() { return cacheJson_('rfk_monitoring_v19', getMonitoringRFKData_uncached_); }
function getMonitoringRFKSummary() { return cacheJson_('rfk_monitoring_summary_v1', getMonitoringRFKSummary_uncached_, 300); }
function getMonitoringRFKDetail(kode) { return getMonitoringRFKDetail_uncached_(kode); }
function getKendalaList() { return cacheJson_('rfk_kendala_v13', getKendalaList_uncached_); }
function getValidasiAngkas() { return cacheJson_('rfk_validasi_v13', getValidasiAngkas_uncached_); }
function getDpaHierarkiTigaTingkat() { return cacheJson_('rfk_dpa_hierarki_v14', getDpaHierarkiTigaTingkat_uncached_, 300); }
function getPelaksanaList() { return cacheJson_('rfk_pelaksana_list_v1', getPelaksanaList_uncached_, 300); }
function getDaftarSpj() { return cacheJson_('rfk_spj_list_v13', getDaftarSpj_uncached_); }
function getDaftarSpjFresh() { return getDaftarSpj_uncached_(); }

function getDashboardStats_uncached_() {
  const maps = getDpaMaps_();
  const angkasMap = getAngkasMap_();
  const validAgg = getRealisasiAggregates_(APP.REALISASI_VALID_STATUSES);
  const activeAgg = getRealisasiAggregates_(APP.SPJ_ACTIVE_STATUSES);

  let totalPagu = 0;
  Object.keys(maps.subCodeInfo).forEach(function(kode) { totalPagu += maps.subCodeInfo[kode].pagu; });

  let totalAngkas = 0;
  Object.keys(angkasMap).forEach(function(kode) { totalAngkas += asNumber_(angkasMap[kode].total); });

  const now = new Date();
  const currentMonthIdx = Number(Utilities.formatDate(now, APP.TIMEZONE, 'M')) - 1;
  const currentQuarterIdx = Math.floor(currentMonthIdx / 3);
  const currentSemesterIdx = currentMonthIdx < 6 ? 0 : 1;
  function sumAngkasUntil_(endIdx) {
    let total = 0;
    Object.keys(angkasMap).forEach(function(kode) {
      const bulanan = angkasMap[kode].bulanan || [];
      for (let i = 0; i <= endIdx; i++) total += asNumber_(bulanan[i]);
    });
    return total;
  }
  function sumRealisasiUntil_(endIdx) {
    let total = 0;
    for (let i = 0; i <= endIdx; i++) total += asNumber_((validAgg.byMonth || {})[i]);
    return total;
  }
  const periodTargets = {
    bulan: {
      label: APP.MONTHS[currentMonthIdx],
      target: sumAngkasUntil_(currentMonthIdx),
      realisasi: sumRealisasiUntil_(currentMonthIdx)
    },
    triwulan: {
      label: 'TW ' + (currentQuarterIdx + 1),
      target: sumAngkasUntil_((currentQuarterIdx + 1) * 3 - 1),
      realisasi: sumRealisasiUntil_((currentQuarterIdx + 1) * 3 - 1)
    },
    semester: {
      label: 'Semester ' + (currentSemesterIdx + 1),
      target: sumAngkasUntil_(currentSemesterIdx === 0 ? 5 : 11),
      realisasi: sumRealisasiUntil_(currentSemesterIdx === 0 ? 5 : 11)
    }
  };
  Object.keys(periodTargets).forEach(function(k) {
    const p = periodTargets[k];
    p.persenRealisasiTarget = p.target > 0 ? round2_(p.realisasi / p.target * 100) : 0;
    p.persenTargetPagu = totalPagu > 0 ? round2_(p.target / totalPagu * 100) : 0;
    p.persenRealisasiPagu = totalPagu > 0 ? round2_(p.realisasi / totalPagu * 100) : 0;
    p.deviasi = p.realisasi - p.target;
  });

  const spjPerStatus = { Draft: 0, Diajukan: 0, Diverifikasi: 0, Dibayar: 0, Batal: 0, Ditolak: 0 };
  let jumlahSPJ = 0;
  const headerSheet = getSheet_(APP.SHEETS.SPJ_HEADER);
  if (headerSheet && headerSheet.getLastRow() > 1) {
    const lastRow = headerSheet.getLastRow();
    const idVals = headerSheet.getRange(2, COL_SPJ_HEADER.ID_SPJ + 1, lastRow - 1, 1).getValues();
    const statusVals = headerSheet.getRange(2, COL_SPJ_HEADER.STATUS + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < idVals.length; i++) {
      if (!idVals[i][0]) continue;
      jumlahSPJ++;
      const status = normalizeStatus_(statusVals[i][0]);
      spjPerStatus[status] = (spjPerStatus[status] || 0) + 1;
    }
  }

  return {
    totalPagu: totalPagu,
    totalAngkas: totalAngkas,
    totalRealisasi: validAgg.total,
    totalRealisasiValid: validAgg.total,
    totalKomitmenAktif: activeAgg.total,
    persenSerap: totalPagu > 0 ? round2_(validAgg.total / totalPagu * 100) : 0,
    persenSerapKas: totalAngkas > 0 ? round2_(validAgg.total / totalAngkas * 100) : 0,
    jumlahSubKegiatan: Object.keys(maps.subCodeInfo).length,
    jumlahSPJ: jumlahSPJ,
    spjPerStatus: spjPerStatus,
    realisasiBasisStatus: APP.REALISASI_VALID_STATUSES.join(', '),
    rowsCounted: validAgg.rowsCounted,
    rowsSkipped: validAgg.rowsSkipped,
    periodTargets: periodTargets
  };
}

function getDashboardPayload_uncached_() {
  const dpaList = getDpaList_uncached_();
  return {
    stats: getDashboardStats_uncached_(),
    chart: dpaList.map(function(d) {
      return {
        kode: d.kode,
        pagu: d.pagu || 0,
        angkas: d.angkas || 0,
        realisasi: d.realisasi || 0
      };
    }),
    recentSpj: getDaftarSpj_uncached_().slice(0, 5)
  };
}

function getDpaList_uncached_() {
  const maps = getDpaMaps_();
  const angkasMap = getAngkasMap_();
  const validAgg = getRealisasiAggregates_(APP.REALISASI_VALID_STATUSES);
  const list = [];
  const angkasDetailByKey = {};
  Object.keys(angkasMap).forEach(function(subKode) {
    const details = Array.isArray(angkasMap[subKode].details) ? angkasMap[subKode].details : [];
    details.forEach(function(d) {
      const key = [subKode, d.kode_rekening, d.uraian_belanja, d.detail_kegiatan, d.sub_rincian].map(normalizeKey_).join('|');
      if (!angkasDetailByKey[key]) angkasDetailByKey[key] = { total: 0, bulanan: APP.MONTHS.map(function() { return 0; }), metode_alokasi: '', sub_rincian: '', detail_kegiatan: '' };
      angkasDetailByKey[key].total += asNumber_(d.total);
      for (let m = 0; m < 12; m++) angkasDetailByKey[key].bulanan[m] += asNumber_((d.bulanan || [])[m]);
      if (d.metode_alokasi) angkasDetailByKey[key].metode_alokasi = d.metode_alokasi;
      if (d.sub_rincian) angkasDetailByKey[key].sub_rincian = d.sub_rincian;
      if (d.detail_kegiatan) angkasDetailByKey[key].detail_kegiatan = d.detail_kegiatan;
    });
  });

  Object.keys(maps.subCodeInfo).sort().forEach(function(kode) {
    const info = maps.subCodeInfo[kode];
    const angkas = angkasMap[kode] || { total: 0, totalBulanan: 0, totalTw: 0 };
    const realisasi = validAgg.bySub[kode] || 0;
    const selisihPaguAngkas = info.pagu - asNumber_(angkas.total);
    const rincian = maps.rows.filter(function(row) { return row.sub_kegiatan_kode === kode; }).map(function(row) {
      const dpaKey = row.id_dpa || [row.sub_kegiatan_kode, row.kode_rekening, row.uraian_belanja].map(normalizeKey_).join('|');
      const exactKey = [row.sub_kegiatan_kode, row.kode_rekening, row.uraian_belanja].map(normalizeKey_).join('|');
      const detailKey = [row.sub_kegiatan_kode, row.kode_rekening, row.uraian_belanja, row.detail_kegiatan, row.sub_rincian].map(normalizeKey_).join('|');
      const angkasDetail = angkasDetailByKey[detailKey] || {};
      const pagu = asNumber_(row.pagu_total);
      const angkasNilai = asNumber_(angkasDetail.total);
      const realisasiNilai = asNumber_(validAgg.byDpa[dpaKey]);
      const monthlyRealisasi = validAgg.byDpaMonth[dpaKey] || {};
      const monthly = APP.MONTHS.map(function(monthName, idx) {
        let angkasBulan = asNumber_((angkasDetail.bulanan || [])[idx]);
        const realisasiBulan = asNumber_(monthlyRealisasi[idx]);
        
        let statusJadwal = 'SESUAI_JADWAL';
        if (realisasiBulan > 0) {
          if (angkasBulan > 0) {
            if (realisasiBulan > angkasBulan + 1) {
              statusJadwal = 'MELEBIHI_JADWAL';
            }
          } else {
            const hasPastAngkas = (angkasDetail.bulanan || []).slice(0, idx).some(function(val) { return asNumber_(val) > 0; });
            const hasFutureAngkas = (angkasDetail.bulanan || []).slice(idx + 1).some(function(val) { return asNumber_(val) > 0; });
            if (hasPastAngkas) {
              statusJadwal = 'TERLAMBAT';
            } else if (hasFutureAngkas) {
              statusJadwal = 'SEBELUM_JADWAL';
            } else {
              statusJadwal = 'TANPA_ANGGARAN';
            }
          }
        }

        return {
          bulan: monthName,
          angkas: angkasBulan,
          realisasi: realisasiBulan,
          sisa: angkasBulan - realisasiBulan,
          statusJadwal: statusJadwal,
          sesuaiJadwal: statusJadwal === 'SESUAI_JADWAL' || statusJadwal === 'TERLAMBAT'
        };
      });
      return {
        idDpa: row.id_dpa,
        kodeRekening: row.kode_rekening,
        uraianBelanja: row.uraian_belanja,
        detailKegiatan: row.detail_kegiatan || angkasDetail.detail_kegiatan || row.uraian_belanja,
        namaUraianKegiatan: row.detail_kegiatan || angkasDetail.detail_kegiatan || row.uraian_belanja,
        subRincian: row.sub_rincian || angkasDetail.sub_rincian || '-',
        pagu: pagu,
        angkas: angkasNilai,
        realisasi: realisasiNilai,
        sisaKas: angkasNilai - realisasiNilai,
        metodeAlokasi: angkasDetail.metode_alokasi || '',
        sumberDana: row.sumber_dana
      };
    });
    list.push({
      kode: kode,
      nama: info.nama,
      pagu: info.pagu,
      sumberDana: info.sumberDana,
      angkas: asNumber_(angkas.total),
      angkasBulanan: asNumber_(angkas.totalBulanan),
      angkasTw: asNumber_(angkas.totalTw),
      realisasi: realisasi,
      sisa: selisihPaguAngkas,
      sisaPagu: info.pagu - realisasi,
      sisaKas: asNumber_(angkas.total) - realisasi,
      persen: info.pagu > 0 ? round2_(asNumber_(angkas.total) / info.pagu * 100) : 0,
      persenSerap: info.pagu > 0 ? round2_(realisasi / info.pagu * 100) : 0,
      rincian: rincian
    });
  });
  return list;
}

function getAnggaranKasDetail(subKode) {
  const item = getAngkasMap_()[safeString_(subKode)];
  if (!item) return null;
  return {
    kode: item.kode,
    nama: item.nama,
    tw1: item.tw[0],
    tw2: item.tw[1],
    tw3: item.tw[2],
    tw4: item.tw[3],
    total: item.total,
    totalBulanan: item.totalBulanan,
    totalTw: item.totalTw,
    bulanan: APP.MONTHS.map(function(m, idx) {
      return { nama: m, nilai: item.bulanan[idx] || 0 };
    })
  };
}

function getMonitoringRFKSummary_uncached_() {
  const maps = getDpaMaps_();
  const angkasMap = getAngkasMap_();
  const validAgg = getRealisasiAggregates_(APP.REALISASI_VALID_STATUSES);
  return Object.keys(maps.subCodeInfo).sort().map(function(kode) {
    const info = maps.subCodeInfo[kode];
    const angkas = angkasMap[kode] || { total: 0 };
    const realisasiTotal = APP.MONTHS.reduce(function(sum, m, idx) {
      return sum + asNumber_((validAgg.bySubMonth[kode] || {})[idx]);
    }, 0);
    return {
      kode: kode,
      nama: info.nama,
      pagu: info.pagu,
      sumberDana: info.sumberDana,
      angkasTotal: asNumber_(angkas.total),
      realisasiTotal: realisasiTotal,
      sisaTotal: asNumber_(angkas.total) - realisasiTotal,
      sisaPagu: info.pagu - realisasiTotal,
      persenSerapTotal: asNumber_(angkas.total) > 0 ? round2_(realisasiTotal / asNumber_(angkas.total) * 100) : 0,
      rincianCount: maps.rows.filter(function(row) { return row.sub_kegiatan_kode === kode; }).length
    };
  });
}

function getMonitoringRFKDetail_uncached_(kodeFilter) {
  const kodeClean = safeString_(kodeFilter);
  if (!kodeClean) throw new Error('Kode sub kegiatan wajib diisi.');
  return getMonitoringRFKData_uncached_().find(function(row) { return row.kode === kodeClean; }) || null;
}

function getMonitoringRFKData_uncached_() {
  const maps = getDpaMaps_();
  const angkasMap = getAngkasMap_();
  const indikatorMap = getIndikatorMap_();
  const validAgg = getRealisasiAggregates_(APP.REALISASI_VALID_STATUSES);
  const kendalaMap = getKendalaMap_();
  const result = [];
  const angkasDetailByKey = {};

  Object.keys(angkasMap).forEach(function(subKode) {
    const details = Array.isArray(angkasMap[subKode].details) ? angkasMap[subKode].details : [];
    details.forEach(function(d) {
      const key = [subKode, d.kode_rekening, d.uraian_belanja, d.detail_kegiatan, d.sub_rincian].map(normalizeKey_).join('|');
      if (!angkasDetailByKey[key]) angkasDetailByKey[key] = { total: 0, bulanan: APP.MONTHS.map(function() { return 0; }), metode_alokasi: '', sub_rincian: '', detail_kegiatan: '' };
      angkasDetailByKey[key].total += asNumber_(d.total);
      for (let m = 0; m < 12; m++) angkasDetailByKey[key].bulanan[m] += asNumber_((d.bulanan || [])[m]);
      if (d.metode_alokasi) angkasDetailByKey[key].metode_alokasi = d.metode_alokasi;
      if (d.sub_rincian) angkasDetailByKey[key].sub_rincian = d.sub_rincian;
      if (d.detail_kegiatan) angkasDetailByKey[key].detail_kegiatan = d.detail_kegiatan;
    });
  });

  Object.keys(maps.subCodeInfo).sort().forEach(function(kode) {
    const info = maps.subCodeInfo[kode];
    const angkas = angkasMap[kode] || { bulanan: APP.MONTHS.map(function() { return 0; }), total: 0 };
    const indikator = indikatorMap[kode] || { nama: '-', target: '-' };
    const realisasiBulanan = validAgg.bySubMonth[kode] || {};

    let totalRealisasi = 0;
    const perBulan = APP.MONTHS.map(function(m, idx) {
      const angBulan = asNumber_(angkas.bulanan[idx]);
      const relBulan = asNumber_(realisasiBulanan[idx]);
      totalRealisasi += relBulan;
      return {
        bulan: m,
        anggaranKas: angBulan,
        realisasi: relBulan,
        sisa: angBulan - relBulan,
        persenSerap: angBulan > 0 ? round2_(relBulan / angBulan * 100) : 0
      };
    });

    const rincian = maps.rows.filter(function(row) { return row.sub_kegiatan_kode === kode; }).map(function(row) {
      const exactKey = [row.sub_kegiatan_kode, row.kode_rekening, row.uraian_belanja].map(normalizeKey_).join('|');
      const dpaKey = row.id_dpa || exactKey;
      const detailKey = [row.sub_kegiatan_kode, row.kode_rekening, row.uraian_belanja, row.detail_kegiatan, row.sub_rincian].map(normalizeKey_).join('|');
      const angkasDetail = angkasDetailByKey[detailKey] || {};
      const pagu = asNumber_(row.pagu_total);
      const angkasNilai = asNumber_(angkasDetail.total);
      const realisasiNilai = asNumber_(validAgg.byDpa[dpaKey]);
      const monthlyRealisasi = validAgg.byDpaMonth[dpaKey] || {};
      const monthly = APP.MONTHS.map(function(monthName, idx) {
        let angkasBulan = asNumber_((angkasDetail.bulanan || [])[idx]);
        const realisasiBulan = asNumber_(monthlyRealisasi[idx]);
        
        let statusJadwal = 'SESUAI_JADWAL';
        if (realisasiBulan > 0) {
          if (angkasBulan > 0) {
            if (realisasiBulan > angkasBulan + 1) {
              statusJadwal = 'MELEBIHI_JADWAL';
            }
          } else {
            const hasPastAngkas = (angkasDetail.bulanan || []).slice(0, idx).some(function(val) { return asNumber_(val) > 0; });
            const hasFutureAngkas = (angkasDetail.bulanan || []).slice(idx + 1).some(function(val) { return asNumber_(val) > 0; });
            if (hasPastAngkas) {
              statusJadwal = 'TERLAMBAT';
            } else if (hasFutureAngkas) {
              statusJadwal = 'SEBELUM_JADWAL';
            } else {
              statusJadwal = 'TANPA_ANGGARAN';
            }
          }
        }

        return {
          bulan: monthName,
          angkas: angkasBulan,
          realisasi: realisasiBulan,
          sisa: angkasBulan - realisasiBulan,
          statusJadwal: statusJadwal,
          sesuaiJadwal: statusJadwal === 'SESUAI_JADWAL' || statusJadwal === 'TERLAMBAT'
        };
      });
      return {
        idDpa: row.id_dpa,
        kodeRekening: row.kode_rekening,
        uraianBelanja: row.uraian_belanja,
        namaUraianKegiatan: row.detail_kegiatan || angkasDetail.detail_kegiatan || row.uraian_belanja,
        subRincian: row.sub_rincian || angkasDetail.sub_rincian || '-',
        pagu: pagu,
        angkas: angkasNilai,
        realisasi: realisasiNilai,
        sisaKas: angkasNilai - realisasiNilai,
        sisaPagu: pagu - realisasiNilai,
        persenSerap: angkasNilai > 0 ? round2_(realisasiNilai / angkasNilai * 100) : 0,
        metodeAlokasi: angkasDetail.metode_alokasi || '',
        monthly: monthly
      };
    });

    result.push({
      kode: kode,
      nama: info.nama,
      pagu: info.pagu,
      sumberDana: info.sumberDana,
      angkasTotal: asNumber_(angkas.total),
      realisasiTotal: totalRealisasi,
      sisaTotal: asNumber_(angkas.total) - totalRealisasi,
      sisaPagu: info.pagu - totalRealisasi,
      persenSerapTotal: asNumber_(angkas.total) > 0 ? round2_(totalRealisasi / asNumber_(angkas.total) * 100) : 0,
      persenSerapPagu: info.pagu > 0 ? round2_(totalRealisasi / info.pagu * 100) : 0,
      indikator: indikator.nama,
      targetIndikator: indikator.target,
      realisasiKinerja: '-',
      persenKinerja: 0,
      perBulan: perBulan,
      rincian: rincian,
      kendala: kendalaMap[kode] || [],
      realisasiBasisStatus: APP.REALISASI_VALID_STATUSES.join(', ')
    });
  });
  return result;
}

function getKendalaMap_() {
  const map = {};
  const sheet = getSheet_(APP.SHEETS.KENDALA_LOG);
  if (!sheet || sheet.getLastRow() < 2) return map;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const kode = safeString_(data[i][1]);
    if (!kode) continue;
    if (!map[kode]) map[kode] = [];
    map[kode].push({
      id: safeString_(data[i][0]),
      bulan: safeString_(data[i][2]),
      tahun: safeString_(data[i][3]),
      permasalahan: safeString_(data[i][4]),
      solusi: safeString_(data[i][5]),
      status: safeString_(data[i][6]),
      tglInput: data[i][7],
      inputBy: safeString_(data[i][8])
    });
  }
  return map;
}

function getKendalaList_uncached_() {
  return getSheetData_(APP.SHEETS.KENDALA_LOG).map(function(row) {
    return {
      id: row.id_kendala || '',
      subKode: row.sub_kegiatan_kode || '',
      bulan: row.bulan || '',
      tahun: row.tahun || '',
      permasalahan: row.permasalahan || '',
      solusi: row.solusi || '',
      status: row.status_penyelesaian || '',
      tglInput: row.tgl_input || '',
      inputBy: row.input_by || ''
    };
  });
}

function getValidasiAngkas_uncached_() {
  const maps = getDpaMaps_();
  const angkasMap = getAngkasMap_();
  const result = [];

  Object.keys(maps.subCodeInfo).sort().forEach(function(kode) {
    const info = maps.subCodeInfo[kode];
    const angkas = angkasMap[kode] || { total: 0, totalBulanan: 0, totalTw: 0 };
    const totalAngkas = asNumber_(angkas.total);
    const totalBulanan = asNumber_(angkas.totalBulanan);
    const totalTw = asNumber_(angkas.totalTw);
    const selisih = info.pagu - totalAngkas;
    const catatan = [];

    if (!angkasMap[kode]) catatan.push('Anggaran kas belum ada.');
    if (Math.abs(info.pagu - totalAngkas) > 1) catatan.push('Pagu DPA berbeda dengan total RAK/anggaran kas.');
    if (Math.abs(totalTw - totalAngkas) > 1) catatan.push('Total triwulan berbeda dengan total RAK.');
    if (Math.abs(totalBulanan - totalAngkas) > 1) catatan.push('Total bulanan berbeda dengan total RAK.');

    let status = 'OK';
    if (catatan.length) status = Math.abs(selisih) <= Math.max(info.pagu * 0.05, 1) ? 'WARNING' : 'ERROR';
    if (Math.abs(totalTw - totalAngkas) > 1 || Math.abs(totalBulanan - totalAngkas) > 1) status = 'ERROR';

    result.push({
      kode: kode,
      nama: info.nama,
      pagu: info.pagu,
      angkas: totalAngkas,
      totalTw: totalTw,
      totalBulanan: totalBulanan,
      selisih: selisih,
      status: status,
      catatan: catatan.join(' ')
    });
  });
  return result;
}

function getRekapSubKegiatan() {
  const maps = getDpaMaps_();
  return Object.keys(maps.subCodeInfo).sort().map(function(kode) {
    const info = maps.subCodeInfo[kode];
    return {
      kode: kode,
      nama: info.nama,
      pagu: info.pagu,
      sumberDana: info.sumberDana,
      status: 'Aktif'
    };
  });
}

function getRekapRekening() {
  const grouped = {};
  getDpaRows_().forEach(function(item) {
    const rek = item.kode_rekening || '-';
    if (!grouped[rek]) {
      grouped[rek] = { kode_rekening: rek, uraian: item.uraian_belanja, total_pagu: 0, jumlah_item: 0 };
    }
    grouped[rek].total_pagu += item.pagu_total;
    grouped[rek].jumlah_item++;
  });
  return Object.keys(grouped).sort().map(function(k) { return grouped[k]; });
}

function getDpaHierarkiTigaTingkat_uncached_() {
  const hierarki = {};
  getDpaRows_().forEach(function(item) {
    const subLabel = item.sub_kegiatan_nama || item.sub_kegiatan_kode;
    const kodeRek = item.kode_rekening || item.sub_kegiatan_kode;
    if (!hierarki[subLabel]) hierarki[subLabel] = {};
    if (!hierarki[subLabel][kodeRek]) hierarki[subLabel][kodeRek] = [];
    hierarki[subLabel][kodeRek].push({
      id_dpa: item.id_dpa,
      sub_kegiatan_kode: item.sub_kegiatan_kode,
      sub_kegiatan_nama: item.sub_kegiatan_nama,
      kode_rekening: kodeRek,
      uraian_belanja: item.uraian_belanja,
      detail_kegiatan: item.detail_kegiatan,
      sub_rincian: item.sub_rincian,
      display_text: [item.uraian_belanja, item.detail_kegiatan, item.sub_rincian].filter(Boolean).join(' — '),
      pagu: item.pagu_total,
      sumber_dana: item.sumber_dana
    });
  });
  return hierarki;
}

function getPelaksanaList_uncached_() {
  const sheet = ensureSheetHeaders_(APP.SHEETS.MASTER_PELAKSANA, SHEET_HEADERS.MASTER_PELAKSANA);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const raw = getRawSheet_(APP.SHEETS.MASTER_PELAKSANA);
  const idx = headerIndexMapFromHeaders_(raw.headers);
  function col_(name, fallback) {
    const key = normalizeKey_(name);
    return idx[key] !== undefined ? idx[key] : fallback;
  }
  const c = {
    id: col_('id_pelaksana', 0),
    nama: col_('nama_pelaksana', 1),
    jabatan: col_('jabatan', 2),
    unit: col_('unit', 3),
    status: col_('status', 4)
  };
  return raw.rows.map(function(row) {
    return {
      id_pelaksana: safeString_(row[c.id]),
      nama_pelaksana: safeString_(row[c.nama]),
      jabatan: safeString_(row[c.jabatan]),
      unit: safeString_(row[c.unit]),
      status: safeString_(row[c.status]) || 'Aktif'
    };
  }).filter(function(item) {
    return item.nama_pelaksana && normalizeKey_(item.status) !== 'nonaktif';
  }).sort(function(a, b) { return a.nama_pelaksana.localeCompare(b.nama_pelaksana); });
}


function getRekapPelaksanaSppd() {
  const sheet = getSheet_(APP.SHEETS.SPJ_DETAIL);
  const result = { months: APP.MONTHS, kegiatan: [], tables: {}, jenis_spj: 'SPPD' };
  if (!sheet || sheet.getLastRow() < 2) return result;
  const raw = getRawSheet_(APP.SHEETS.SPJ_DETAIL);
  if (!raw || !raw.headers || !raw.headers.length) return result;
  const idx = headerIndexMapFromHeaders_(raw.headers);
  function col_(name, fallback) {
    const key = normalizeKey_(name);
    return idx[key] !== undefined ? idx[key] : fallback;
  }
  const c = {
    idSpj: col_('id_spj', COL_SPJ_DETAIL.ID_SPJ),
    bulan: col_('bulan', COL_SPJ_DETAIL.BULAN),
    kodeRekening: col_('kode_rekening', COL_SPJ_DETAIL.KODE_REKENING),
    uraianBelanja: col_('uraian_belanja', COL_SPJ_DETAIL.URAIAN_BELANJA),
    pelaksana: col_('pelaksana', COL_SPJ_DETAIL.PELAKSANA),
    jenis: col_('jenis_spj', COL_SPJ_DETAIL.JENIS_SPJ),
    status: col_('status_spj', COL_SPJ_DETAIL.STATUS),
    isActive: col_('is_active', COL_SPJ_DETAIL.IS_ACTIVE),
    idDpa: col_('id_dpa', COL_SPJ_DETAIL.ID_DPA)
  };
  const maps = getDpaMaps_();
  const headerStatusMap = getHeaderStatusMap_();
  const monthIndex = {};
  APP.MONTHS.forEach(function(m, i) { monthIndex[normalizeKey_(m)] = i; });

  raw.rows.forEach(function(row) {
    if (!safeString_(row[c.idSpj])) return;
    if (row.length > c.isActive && !isActiveValue_(row[c.isActive])) return;
    if (normalizeKey_(row[c.jenis]) !== 'sppd') return;
    const status = normalizeStatus_(headerStatusMap[safeString_(row[c.idSpj])] || row[c.status]);
    if (['Batal', 'Ditolak'].indexOf(status) !== -1) return;
    const pelaksana = safeString_(row[c.pelaksana]) || 'Tanpa Nama Pelaksana';
    const monthIdx = monthIndex[normalizeKey_(row[c.bulan])];
    if (monthIdx === undefined) return;
    const dpa = maps.byId[safeString_(row[c.idDpa])] || null;
    const kodeRekening = safeString_(row[c.kodeRekening]);
    const uraian = safeString_(row[c.uraianBelanja]);
    const detail = dpa ? safeString_(dpa.detail_kegiatan) : '';
    const subRincian = dpa ? safeString_(dpa.sub_rincian) : '';
    const kegiatanKey = [kodeRekening, uraian, detail || subRincian || uraian].filter(Boolean).join(' | ');
    const kegiatanTitle = detail || subRincian || uraian || kodeRekening || 'Tanpa Uraian Kegiatan';
    if (!result.tables[kegiatanKey]) {
      result.tables[kegiatanKey] = {
        key: kegiatanKey,
        title: kegiatanTitle,
        kode_rekening: kodeRekening,
        uraian_belanja: uraian,
        detail_kegiatan: detail,
        rows: {},
        total: 0
      };
    }
    const table = result.tables[kegiatanKey];
    if (!table.rows[pelaksana]) table.rows[pelaksana] = { pelaksana: pelaksana, months: APP.MONTHS.map(function() { return 0; }), total: 0 };
    table.rows[pelaksana].months[monthIdx] += 1;
    table.rows[pelaksana].total += 1;
    table.total += 1;
  });

  result.kegiatan = Object.keys(result.tables).sort(function(a, b) {
    return result.tables[a].title.localeCompare(result.tables[b].title);
  }).map(function(key) {
    const table = result.tables[key];
    table.rows = Object.keys(table.rows).sort().map(function(name) { return table.rows[name]; });
    return { key: key, title: table.title, kode_rekening: table.kode_rekening, uraian_belanja: table.uraian_belanja, total: table.total };
  });
  return result;
}

function getDaftarSpj_uncached_() {
  const sheet = getSheet_(APP.SHEETS.SPJ_HEADER);
  if (!sheet) return getDaftarSpjFromDetailFallback_();
  const raw = getRawSheet_(APP.SHEETS.SPJ_HEADER);
  if (!raw || !raw.headers || !raw.headers.length) return getDaftarSpjFromDetailFallback_();
  const idx = headerIndexMapFromHeaders_(raw.headers);
  function col_(name, fallback) {
    const key = normalizeKey_(name);
    return idx[key] !== undefined ? idx[key] : fallback;
  }
  const c = {
    id: col_('id_spj', COL_SPJ_HEADER.ID_SPJ),
    nomor: col_('nomor_spj', COL_SPJ_HEADER.NOMOR_SPJ),
    tanggal: col_('tanggal_spj', COL_SPJ_HEADER.TANGGAL_SPJ),
    bulan: col_('bulan', COL_SPJ_HEADER.BULAN),
    pptk: col_('pptk', COL_SPJ_HEADER.PPTK),
    status: col_('status_spj', COL_SPJ_HEADER.STATUS),
    total: col_('total_bruto', COL_SPJ_HEADER.TOTAL_BRUTO),
    updated: col_('updated_at', COL_SPJ_HEADER.UPDATED_AT),
    created: col_('created_at', COL_SPJ_HEADER.CREATED_AT)
  };
  const list = [];
  raw.rows.forEach(function(row) {
    const id = safeString_(row[c.id]);
    if (!id) return;
    const tanggal = row[c.tanggal];
    const updatedAt = row[c.updated] || row[c.created] || '';
    let sortVal = 0;
    try {
      if (updatedAt) sortVal = new Date(updatedAt).getTime();
      else if (tanggal) sortVal = new Date(tanggal).getTime();
    } catch (e) {}
    list.push({
      id_spj: id,
      nomor_spj: safeString_(row[c.nomor]) || id,
      tanggal: tanggal ? (tanggal instanceof Date ? Utilities.formatDate(tanggal, APP.TIMEZONE, 'yyyy-MM-dd') : String(tanggal).split('T')[0]) : '',
      bulan: safeString_(row[c.bulan]),
      pptk: safeString_(row[c.pptk]) || '-',
      status: normalizeStatus_(row[c.status]),
      total: asNumber_(row[c.total]),
      updatedAt: String(updatedAt),
      sortTime: sortVal || 0
    });
  });
  if (!list.length) return getDaftarSpjFromDetailFallback_();
  attachSpjListDetailSummary_(list);
  return list.sort(function(a, b) { return (b.sortTime || 0) - (a.sortTime || 0); });
}

function attachSpjListDetailSummary_(list) {
  const ids = {};
  list.forEach(function(item) { ids[item.id_spj] = item; item.uraian_summary = ''; item.detail_count = 0; item.dokumen_count = 0; });
  const detail = getSheet_(APP.SHEETS.SPJ_DETAIL);
  if (detail && detail.getLastRow() > 1) {
    const raw = getRawSheet_(APP.SHEETS.SPJ_DETAIL);
    const idx = headerIndexMapFromHeaders_(raw.headers);
    const idIdx = idx[normalizeKey_('id_spj')] !== undefined ? idx[normalizeKey_('id_spj')] : COL_SPJ_DETAIL.ID_SPJ;
    const uraianIdx = idx[normalizeKey_('uraian_belanja')] !== undefined ? idx[normalizeKey_('uraian_belanja')] : COL_SPJ_DETAIL.URAIAN_BELANJA;
    const activeIdx = idx[normalizeKey_('is_active')] !== undefined ? idx[normalizeKey_('is_active')] : COL_SPJ_DETAIL.IS_ACTIVE;
    const map = {};
    raw.rows.forEach(function(row) {
      const id = safeString_(row[idIdx]);
      if (!ids[id]) return;
      if (row.length > activeIdx && !isActiveValue_(row[activeIdx])) return;
      if (!map[id]) map[id] = {};
      const dpaIdx = idx[normalizeKey_('id_dpa')] !== undefined ? idx[normalizeKey_('id_dpa')] : COL_SPJ_DETAIL.ID_DPA;
      const dpa = getDpaMaps_().byId[safeString_(row[dpaIdx])] || null;
      const uraian = safeString_(row[uraianIdx]);
      const detail = dpa ? safeString_(dpa.detail_kegiatan) : '';
      const subRincian = dpa ? safeString_(dpa.sub_rincian) : '';
      const u = [uraian, detail, subRincian].filter(Boolean).join(' — ');
      if (u) map[id][u] = true;
    });
    Object.keys(map).forEach(function(id) {
      const arr = Object.keys(map[id]);
      ids[id].detail_count = arr.length;
      ids[id].uraian_summary = arr.slice(0, 2).join('; ') + (arr.length > 2 ? ' +' + (arr.length - 2) + ' uraian' : '');
    });
  }
  const dok = getSheet_(APP.SHEETS.SPJ_DOKUMEN);
  if (dok && dok.getLastRow() > 1) {
    const rawDok = getRawSheet_(APP.SHEETS.SPJ_DOKUMEN);
    const dokIdx = headerIndexMapFromHeaders_(rawDok.headers || []);
    const idCol = dokIdx[normalizeKey_('id_spj')] !== undefined ? dokIdx[normalizeKey_('id_spj')] : 1;
    rawDok.rows.forEach(function(r) {
      let id = safeString_(r[idCol]);
      if (!ids[id]) {
        const found = r.some(function(cell) { return ids[safeString_(cell)]; });
        if (found) {
          for (let i = 0; i < r.length; i++) { const v = safeString_(r[i]); if (ids[v]) { id = v; break; } }
        }
      }
      if (ids[id]) ids[id].dokumen_count++;
    });
  }
}


function getDaftarSpjFromDetailFallback_() {
  const sheet = getSheet_(APP.SHEETS.SPJ_DETAIL);
  if (!sheet) return [];
  const raw = getRawSheet_(APP.SHEETS.SPJ_DETAIL);
  if (!raw || !raw.headers || !raw.headers.length) return [];
  const idx = headerIndexMapFromHeaders_(raw.headers);
  function col_(name, fallback) {
    const key = normalizeKey_(name);
    return idx[key] !== undefined ? idx[key] : fallback;
  }
  const c = {
    id: col_('id_spj', COL_SPJ_DETAIL.ID_SPJ),
    tanggal: col_('tanggal_spj', COL_SPJ_DETAIL.TANGGAL_SPJ),
    bulan: col_('bulan', COL_SPJ_DETAIL.BULAN),
    status: col_('status_spj', COL_SPJ_DETAIL.STATUS),
    total: col_('nilai_bruto', COL_SPJ_DETAIL.NILAI_BRUTO),
    created: col_('created_at', COL_SPJ_DETAIL.CREATED_AT),
    updated: col_('updated_at', COL_SPJ_DETAIL.UPDATED_AT)
  };
  const grouped = {};
  raw.rows.forEach(function(row) {
    const id = safeString_(row[c.id]);
    if (!id) return;
    if (!grouped[id]) grouped[id] = { id_spj: id, nomor_spj: id, tanggal: '', bulan: '', pptk: '-', status: '', total: 0, updatedAt: '', sortTime: 0 };
    const g = grouped[id];
    g.total += asNumber_(row[c.total]);
    if (!g.bulan) g.bulan = safeString_(row[c.bulan]);
    if (!g.status) g.status = normalizeStatus_(row[c.status]);
    const tanggal = row[c.tanggal];
    if (!g.tanggal && tanggal) {
      try {
        g.tanggal = tanggal instanceof Date ? Utilities.formatDate(tanggal, APP.TIMEZONE, 'yyyy-MM-dd') : String(tanggal).split('T')[0];
      } catch (e) {
        g.tanggal = String(tanggal);
      }
    }
    const updatedAt = row[c.updated] || row[c.created] || tanggal || '';
    let sortVal = 0;
    try {
      if (updatedAt) sortVal = new Date(updatedAt).getTime();
    } catch (e) {}
    if (sortVal >= (g.sortTime || 0)) { g.updatedAt = String(updatedAt); g.sortTime = sortVal; }
  });
  return Object.keys(grouped).map(function(id) { return grouped[id]; }).sort(function(a, b) { return (b.sortTime || 0) - (a.sortTime || 0); });
}

/***************************************************************************
 * Mutation functions
 ***************************************************************************/
function simpanKendala(kendalaData, sessionToken) {
  const session = requireSession_(sessionToken, APP.VIEW_ROLES);
  const sheet = ensureSheetHeaders_(APP.SHEETS.KENDALA_LOG, SHEET_HEADERS.KENDALA_LOG);
  const id = makeId_('KD');
  const timestamp = new Date();
  const row = [
    id,
    safeString_(kendalaData.subKode),
    safeString_(kendalaData.bulan),
    safeString_(kendalaData.tahun || APP.TAHUN_DEFAULT),
    safeString_(kendalaData.permasalahan),
    safeString_(kendalaData.solusi),
    safeString_(kendalaData.status || 'Belum Ditangani'),
    timestamp,
    session.email
  ];
  if (!row[1] || !row[4]) throw new Error('Sub kegiatan dan permasalahan wajib diisi.');
  sheet.appendRow(row);
  clearRfkCache_();
  logActivity_(session.email, 'SIMPAN_KENDALA', 'KENDALA_LOG', id, null, { subKode: row[1], bulan: row[2] }, 'OK', 'Kendala disimpan');
  return { success: true, id: id };
}

function resolveDpaFromInputRow_(input, maps) {
  if (input.id_dpa && maps.byId[input.id_dpa]) return maps.byId[input.id_dpa];

  let subKode = safeString_(input.sub_kegiatan_kode || input.subKode || input.kode_sub_kegiatan);
  const subNameCandidate = safeString_(input.sub_kegiatan_nama || input.sub_kegiatan || input.nama_sub_kegiatan);
  const kodeRek = safeString_(input.kode_rekening);
  const uraian = safeString_(input.uraian_belanja);

  if (!subKode && isSubKode_(input.sub_kegiatan)) subKode = safeString_(input.sub_kegiatan);
  if (!subKode && maps.subNameToCode[normalizeKey_(subNameCandidate)]) subKode = maps.subNameToCode[normalizeKey_(subNameCandidate)];
  if (!subKode && isSubKode_(kodeRek) && maps.subCodeInfo[kodeRek]) subKode = kodeRek; // legacy UI

  const exactKey = [subKode, kodeRek, uraian].map(normalizeKey_).join('|');
  if (maps.byExact[exactKey]) return maps.byExact[exactKey];
  const subRekKey = [subKode, kodeRek].map(normalizeKey_).join('|');
  if (maps.bySubRek[subRekKey] && maps.bySubRek[subRekKey].length === 1) return maps.bySubRek[subRekKey][0];

  if (subKode && maps.subCodeInfo[subKode]) {
    return {
      id_dpa: '',
      sub_kegiatan_kode: subKode,
      sub_kegiatan_nama: maps.subCodeInfo[subKode].nama,
      kode_rekening: kodeRek || subKode,
      uraian_belanja: uraian || maps.subCodeInfo[subKode].nama,
      pagu_total: maps.subCodeInfo[subKode].pagu,
      sumber_dana: maps.subCodeInfo[subKode].sumberDana,
      tahun: APP.TAHUN_DEFAULT
    };
  }
  return null;
}

function buildSpjDetailRows_(idSpj, headerData, detailRows, session, timestamp) {
  const maps = getDpaMaps_();
  const rows = [];
  let total = 0;
  const perDpaInput = {};

  if (!Array.isArray(detailRows) || detailRows.length === 0) throw new Error('Tambahkan minimal satu item SPJ.');

  detailRows.forEach(function(input, idx) {
    const nilai = asNumber_(input.nilai_bruto);
    if (nilai <= 0) throw new Error('Nilai bruto item ke-' + (idx + 1) + ' harus lebih dari nol.');

    const dpa = resolveDpaFromInputRow_(input, maps);
    if (!dpa || !dpa.sub_kegiatan_kode) {
      throw new Error('Item ke-' + (idx + 1) + ' tidak cocok dengan data MASTER_DPA. Periksa sub kegiatan/rekening/uraian.');
    }

    const dpaKey = dpa.id_dpa || [dpa.sub_kegiatan_kode, dpa.kode_rekening, dpa.uraian_belanja].map(normalizeKey_).join('|');
    perDpaInput[dpaKey] = (perDpaInput[dpaKey] || 0) + nilai;
    total += nilai;

    rows.push([
      makeId_('DTL'),
      idSpj,
      APP.TAHUN_DEFAULT,
      safeString_(headerData.bulan),
      APP.OPD_NAMA,
      APP.BIDANG_DEFAULT,
      dpa.sub_kegiatan_kode,
      dpa.sub_kegiatan_nama,
      dpa.kode_rekening || safeString_(input.kode_rekening),
      dpa.uraian_belanja || safeString_(input.uraian_belanja),
      safeString_(input.pelaksana),
      nilai,
      0,
      nilai,
      dpa.pagu_total,
      safeString_(headerData.jenis_spj),
      normalizeStatus_(headerData.status_spj || 'Draft'),
      '',
      0,
      0,
      0,
      0,
      'OK',
      '',
      timestamp,
      session.email,
      safeString_(headerData.tanggal_spj),
      dpa.id_dpa,
      true,
      timestamp,
      session.email
    ]);
  });

  return { rows: rows, total: total, perDpaInput: perDpaInput };
}

function getExistingActiveValuesByDpa_(excludeIdSpj) {
  const detailSheet = getSheet_(APP.SHEETS.SPJ_DETAIL);
  const result = {};
  if (!detailSheet || detailSheet.getLastRow() < 2) return result;

  const headerStatusMap = getHeaderStatusMap_();
  const maps = getDpaMaps_();
  const data = detailSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const idSpj = safeString_(row[COL_SPJ_DETAIL.ID_SPJ]);
    if (!idSpj || idSpj === excludeIdSpj) continue;
    if (row.length > COL_SPJ_DETAIL.IS_ACTIVE && !isActiveValue_(row[COL_SPJ_DETAIL.IS_ACTIVE])) continue;
    const status = normalizeStatus_(headerStatusMap[idSpj] || row[COL_SPJ_DETAIL.STATUS]);
    if (APP.SPJ_ACTIVE_STATUSES.indexOf(status) === -1) continue;
    const dpa = resolveDpaFromDetailRow_(row, maps);
    if (!dpa) continue;
    const dpaKey = dpa.id_dpa || [dpa.sub_kegiatan_kode, dpa.kode_rekening, dpa.uraian_belanja].map(normalizeKey_).join('|');
    result[dpaKey] = (result[dpaKey] || 0) + asNumber_(row[COL_SPJ_DETAIL.NILAI_BRUTO]);
  }
  return result;
}


function buildExistingActiveValuesByDpaFromRows_(detailRows, excludeIdSpj) {
  const result = {};
  const headerStatusMap = getHeaderStatusMap_();
  const maps = getDpaMaps_();
  (detailRows || []).forEach(function(row) {
    const idSpj = safeString_(row[COL_SPJ_DETAIL.ID_SPJ]);
    if (!idSpj || idSpj === excludeIdSpj) return;
    if (row.length > COL_SPJ_DETAIL.IS_ACTIVE && !isActiveValue_(row[COL_SPJ_DETAIL.IS_ACTIVE])) return;
    const status = normalizeStatus_(headerStatusMap[idSpj] || row[COL_SPJ_DETAIL.STATUS]);
    if (APP.SPJ_ACTIVE_STATUSES.indexOf(status) === -1) return;
    const dpa = resolveDpaFromDetailRow_(row, maps);
    if (!dpa) return;
    const dpaKey = dpa.id_dpa || [dpa.sub_kegiatan_kode, dpa.kode_rekening, dpa.uraian_belanja].map(normalizeKey_).join('|');
    result[dpaKey] = (result[dpaKey] || 0) + asNumber_(row[COL_SPJ_DETAIL.NILAI_BRUTO]);
  });
  return result;
}

function validateSpjAgainstPagu_(perDpaInput, excludeIdSpj, existingValues) {
  const maps = getDpaMaps_();
  const existing = existingValues || getExistingActiveValuesByDpa_(excludeIdSpj);
  Object.keys(perDpaInput).forEach(function(dpaKey) {
    let dpa = maps.byId[dpaKey];
    if (!dpa) {
      dpa = maps.rows.find(function(item) {
        const key = [item.sub_kegiatan_kode, item.kode_rekening, item.uraian_belanja].map(normalizeKey_).join('|');
        return key === dpaKey;
      });
    }
    if (!dpa) return;
    const totalSetelah = (existing[dpaKey] || 0) + perDpaInput[dpaKey];
    if (dpa.pagu_total > 0 && totalSetelah > dpa.pagu_total + 1) {
      throw new Error('Nilai SPJ melebihi pagu DPA untuk ' + dpa.uraian_belanja + '. Pagu ' + dpa.pagu_total + ', setelah input ' + totalSetelah + '.');
    }
  });
}

function simpanSpj(headerData, detailRows, sessionToken) {
  let locked = false;
  const lock = LockService.getScriptLock();
  const session = requireSession_(sessionToken, APP.MUTATION_ROLES);
  try {
    locked = lock.tryLock(30000);
    if (!locked) throw new Error('Sistem sedang memproses antrean lain. Coba sesaat lagi.');

    const headerSheet = ensureSheetHeaders_(APP.SHEETS.SPJ_HEADER, SHEET_HEADERS.SPJ_HEADER);
    const detailSheet = ensureSheetHeaders_(APP.SHEETS.SPJ_DETAIL, SHEET_HEADERS.SPJ_DETAIL);
    const historySheet = ensureSheetHeaders_(APP.SHEETS.SPJ_DETAIL_HISTORY, SHEET_HEADERS.SPJ_DETAIL_HISTORY);

    const timestamp = new Date();
    const idSpj = safeString_(headerData.id_spj) || makeId_('SPJ');
    const statusSpj = normalizeStatus_(headerData.status_spj || 'Draft');
    if (APP.SPJ_STATUSES.indexOf(statusSpj) === -1) throw new Error('Status SPJ tidak valid: ' + statusSpj);
    if (!safeString_(headerData.nomor_spj)) throw new Error('Nomor SPJ wajib diisi.');
    if (!safeString_(headerData.tanggal_spj)) throw new Error('Tanggal SPJ wajib diisi.');
    if (monthIndex_(headerData.bulan) < 0) throw new Error('Bulan kas tidak valid.');
    if (!safeString_(headerData.pptk)) throw new Error('PPTK wajib diisi.');

    const detailBuild = buildSpjDetailRows_(idSpj, headerData, detailRows, session, timestamp);
    const totalClient = asNumber_(headerData.total_bruto);
    if (Math.abs(detailBuild.total - totalClient) > 1) {
      throw new Error('Total header tidak sama dengan total detail. Header: ' + totalClient + ', detail: ' + detailBuild.total + '.');
    }
    const detailLastRow = detailSheet.getLastRow();
    const dt = detailLastRow > 1 ? detailSheet.getRange(2, 1, detailLastRow - 1, Math.max(detailSheet.getLastColumn(), SHEET_HEADERS.SPJ_DETAIL.length)).getValues() : [];
    const existingByDpa = buildExistingActiveValuesByDpaFromRows_(dt, idSpj);
    validateSpjAgainstPagu_(detailBuild.perDpaInput, idSpj, existingByDpa);

    const headerLastRow = headerSheet.getLastRow();
    const hd = headerLastRow > 1 ? headerSheet.getRange(2, 1, headerLastRow - 1, Math.max(headerSheet.getLastColumn(), SHEET_HEADERS.SPJ_HEADER.length)).getValues() : [];
    let headerIndex = -1;
    let beforeHeader = null;
    for (let i = 0; i < hd.length; i++) {
      if (safeString_(hd[i][COL_SPJ_HEADER.ID_SPJ]) === idSpj) {
        headerIndex = i + 2;
        beforeHeader = hd[i];
        break;
      }
    }

    const createdAt = beforeHeader ? beforeHeader[COL_SPJ_HEADER.CREATED_AT] : timestamp;
    const createdBy = beforeHeader ? beforeHeader[COL_SPJ_HEADER.CREATED_BY] : session.email;
    const rowHeader = [
      idSpj,
      safeString_(headerData.nomor_spj),
      safeString_(headerData.tanggal_spj),
      APP.TAHUN_DEFAULT,
      safeString_(headerData.bulan),
      APP.OPD_NAMA,
      APP.BIDANG_DEFAULT,
      safeString_(headerData.pptk),
      safeString_(headerData.penerima),
      statusSpj,
      safeString_(headerData.jenis_spj),
      safeString_(headerData.keterangan || 'Input via Web'),
      detailBuild.total,
      0,
      detailBuild.total,
      createdAt,
      createdBy,
      timestamp,
      session.email
    ];

    if (headerIndex > 0) {
      headerSheet.getRange(headerIndex, 1, 1, rowHeader.length).setValues([rowHeader]);
    } else {
      headerSheet.appendRow(rowHeader);
    }

    // Preserve audit trail: old active detail rows are deactivated, not deleted.
    const historyRows = [];
    const deactivateRowNums = [];
    for (let i = dt.length - 1; i >= 0; i--) {
      if (safeString_(dt[i][COL_SPJ_DETAIL.ID_SPJ]) === idSpj && isActiveValue_(dt[i][COL_SPJ_DETAIL.IS_ACTIVE])) {
        historyRows.push([timestamp, 'DEACTIVATE_ON_EDIT', idSpj, dt[i][COL_SPJ_DETAIL.ID_DETAIL], JSON.stringify(dt[i]), session.email]);
        deactivateRowNums.push(i + 2);
      }
    }
    if (deactivateRowNums.length) {
      deactivateRowNums.forEach(function(rowNum) {
        detailSheet.getRange(rowNum, COL_SPJ_DETAIL.STATUS + 1, 1, 1).setValue('Digantikan');
        detailSheet.getRange(rowNum, COL_SPJ_DETAIL.IS_ACTIVE + 1, 1, 3).setValues([[false, timestamp, session.email]]);
      });
    }
    if (historyRows.length) {
      historySheet.getRange(historySheet.getLastRow() + 1, 1, historyRows.length, historyRows[0].length).setValues(historyRows);
    }

    detailSheet.getRange(detailSheet.getLastRow() + 1, 1, detailBuild.rows.length, detailBuild.rows[0].length).setValues(detailBuild.rows);

    SpreadsheetApp.flush();
    clearSpjMutationCache_();
    logActivity_(session.email, beforeHeader ? 'UPDATE_SPJ' : 'SIMPAN_SPJ', 'SPJ_HEADER', idSpj, beforeHeader, rowHeader, 'OK', 'SPJ tersimpan');
    return { success: true, id_spj: idSpj, total: detailBuild.total };
  } catch (err) {
    logActivity_(session.email, 'SIMPAN_SPJ_GAGAL', 'SPJ_HEADER', headerData && headerData.id_spj, null, headerData, 'FAILED', err.message);
    throw err;
  } finally {
    if (locked) lock.releaseLock();
  }
}


function getSpjDetailForEdit(idSpj, sessionToken) {
  requireSession_(sessionToken, APP.VIEW_ROLES);
  idSpj = safeString_(idSpj);
  const headerRaw = getRawSheet_(APP.SHEETS.SPJ_HEADER);
  const detailRaw = getRawSheet_(APP.SHEETS.SPJ_DETAIL);
  const docsRaw = getSheet_(APP.SHEETS.SPJ_DOKUMEN) ? getRawSheet_(APP.SHEETS.SPJ_DOKUMEN) : { headers: [], rows: [] };
  const h = headerIndexMapFromHeaders_(headerRaw.headers || []);
  const d = headerIndexMapFromHeaders_(detailRaw.headers || []);
  const headerRow = (headerRaw.rows || []).find(function(r) { return safeString_(r[h[normalizeKey_('id_spj')] || 0]) === idSpj; });
  if (!headerRow) throw new Error('SPJ tidak ditemukan.');
  const header = {
    id_spj: idSpj,
    nomor_spj: safeString_(headerRow[h[normalizeKey_('nomor_spj')] || COL_SPJ_HEADER.NOMOR_SPJ]),
    tanggal_spj: headerRow[h[normalizeKey_('tanggal_spj')] || COL_SPJ_HEADER.TANGGAL] instanceof Date ? Utilities.formatDate(headerRow[h[normalizeKey_('tanggal_spj')] || COL_SPJ_HEADER.TANGGAL], APP.TIMEZONE, 'yyyy-MM-dd') : safeString_(headerRow[h[normalizeKey_('tanggal_spj')] || COL_SPJ_HEADER.TANGGAL]),
    bulan: safeString_(headerRow[h[normalizeKey_('bulan')] || COL_SPJ_HEADER.BULAN]),
    pptk: safeString_(headerRow[h[normalizeKey_('pptk')] || COL_SPJ_HEADER.PPTK]),
    jenis_spj: safeString_(headerRow[h[normalizeKey_('jenis_spj')] || COL_SPJ_HEADER.JENIS_SPJ]),
    status: normalizeStatus_(headerRow[h[normalizeKey_('status_spj')] || COL_SPJ_HEADER.STATUS]),
    total: asNumber_(headerRow[h[normalizeKey_('total_bruto')] || COL_SPJ_HEADER.TOTAL_BRUTO])
  };
  const maps = getDpaMaps_();
  const details = (detailRaw.rows || []).filter(function(r) { return safeString_(r[d[normalizeKey_('id_spj')] || COL_SPJ_DETAIL.ID_SPJ]) === idSpj && isActiveValue_(r[d[normalizeKey_('is_active')] || COL_SPJ_DETAIL.IS_ACTIVE]); }).map(function(r) {
    const idDpa = safeString_(r[d[normalizeKey_('id_dpa')] || COL_SPJ_DETAIL.ID_DPA]);
    const dpa = maps.byId[idDpa] || null;
    return {
      id_detail: safeString_(r[d[normalizeKey_('id_detail')] || COL_SPJ_DETAIL.ID_DETAIL]), id_dpa: idDpa, sub_kegiatan_kode: safeString_(r[d[normalizeKey_('sub_kegiatan_kode')] || COL_SPJ_DETAIL.SUB_KODE]), sub_kegiatan_nama: safeString_(r[d[normalizeKey_('sub_kegiatan_nama')] || COL_SPJ_DETAIL.SUB_NAMA]), kode_rekening: safeString_(r[d[normalizeKey_('kode_rekening')] || COL_SPJ_DETAIL.KODE_REKENING]), uraian_belanja: safeString_(r[d[normalizeKey_('uraian_belanja')] || COL_SPJ_DETAIL.URAIAN_BELANJA]), detail_kegiatan: dpa ? safeString_(dpa.detail_kegiatan) : '', sub_rincian: dpa ? safeString_(dpa.sub_rincian) : '', pelaksana: safeString_(r[d[normalizeKey_('pelaksana')] || COL_SPJ_DETAIL.PELAKSANA]), nilai_bruto: asNumber_(r[d[normalizeKey_('nilai_bruto')] || COL_SPJ_DETAIL.NILAI_BRUTO]) } });
  const docIdx = headerIndexMapFromHeaders_(docsRaw.headers || []);
  const docIdCol = docIdx[normalizeKey_('id_spj')] !== undefined ? docIdx[normalizeKey_('id_spj')] : 1;
  const nameCol = docIdx[normalizeKey_('nama_file')] !== undefined ? docIdx[normalizeKey_('nama_file')] : 2;
  const urlCol = docIdx[normalizeKey_('drive_url')] !== undefined ? docIdx[normalizeKey_('drive_url')] : 5;
  const uploadedCol = docIdx[normalizeKey_('uploaded_at')] !== undefined ? docIdx[normalizeKey_('uploaded_at')] : 6;
  const fileIdCol = docIdx[normalizeKey_('drive_file_id')] !== undefined ? docIdx[normalizeKey_('drive_file_id')] : 4;
  const docs = (docsRaw.rows || []).filter(function(r) {
    if (safeString_(r[docIdCol]) === idSpj) return true;
    return r.some(function(cell) { return safeString_(cell) === idSpj; });
  }).map(function(r) {
    const fileId = safeString_(r[fileIdCol]);
    const url = safeString_(r[urlCol]) || (fileId ? 'https://drive.google.com/file/d/' + fileId + '/view' : '');
    return { nama_file: safeString_(r[nameCol]) || 'Dokumen SPJ', drive_url: url, uploaded_at: String(r[uploadedCol] || '') };
  });
  return { header: header, details: details, dokumen: docs };
}

function safeDriveFilename_(value) {
  return safeString_(value).replace(/[\\/:*?"<>|#%{}~&]/g, '-').replace(/\s+/g, ' ').trim().substring(0, 150) || 'dokumen';
}

function hapusSpj(idSpj, sessionToken) {
  const session = requireSession_(sessionToken, ['ADMIN', 'OPERATOR']);
  return updateStatusSpj(idSpj, 'Batal', sessionToken);
}

function uploadDokumenSpj(payload, sessionToken) {
  const session = requireSession_(sessionToken, APP.MUTATION_ROLES);
  payload = payload || {};
  const idSpj = safeString_(payload.id_spj);
  if (!idSpj) throw new Error('ID SPJ wajib diisi.');
  const folder = DriveApp.getFolderById('167YEQmkyzuA51X86dWZfetvUjOzQKi9m');
  const bytes = Utilities.base64Decode(String(payload.base64 || '').split(',').pop());
  const originalName = safeString_(payload.nama_file || ('dokumen_' + idSpj));
  const extMatch = originalName.match(/(\.[A-Za-z0-9]{1,8})$/);
  const ext = extMatch ? extMatch[1] : '';
  let nomorSpj = idSpj;
  let detailName = 'dokumen';
  try {
    const spjData = getSpjDetailForEdit(idSpj, sessionToken);
    nomorSpj = spjData.header && spjData.header.nomor_spj ? spjData.header.nomor_spj : idSpj;
    const firstDetail = spjData.details && spjData.details[0] ? spjData.details[0] : null;
    detailName = firstDetail ? (firstDetail.detail_kegiatan || firstDetail.sub_rincian || firstDetail.uraian_belanja || 'dokumen') : 'dokumen';
  } catch (e) {}
  const renamed = safeDriveFilename_(nomorSpj) + '-' + safeDriveFilename_(detailName) + '-' + Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyyMMdd-HHmmss') + ext;
  const blob = Utilities.newBlob(bytes, safeString_(payload.mime_type || 'application/octet-stream'), renamed);
  const file = folder.createFile(blob);
  const sheet = ensureSheetHeaders_(APP.SHEETS.SPJ_DOKUMEN, SHEET_HEADERS.SPJ_DOKUMEN);
  const row = [makeId_('DOC'), idSpj, file.getName(), blob.getContentType(), file.getId(), file.getUrl(), new Date(), session.email, safeString_(payload.keterangan)];
  sheet.appendRow(row);
  clearRfkCache_();
  return { success: true, url: file.getUrl(), name: file.getName() };
}

function updateStatusSpj(idSpj, statusBaru, sessionToken) {
  const session = requireSession_(sessionToken, APP.APPROVAL_ROLES);
  const status = normalizeStatus_(statusBaru);
  if (APP.SPJ_STATUSES.indexOf(status) === -1) throw new Error('Status SPJ tidak valid: ' + status);
  const headerSheet = ensureSheetHeaders_(APP.SHEETS.SPJ_HEADER, SHEET_HEADERS.SPJ_HEADER);
  const detailSheet = ensureSheetHeaders_(APP.SHEETS.SPJ_DETAIL, SHEET_HEADERS.SPJ_DETAIL);
  const timestamp = new Date();
  let found = false;
  let beforeStatus = '';

  const hd = headerSheet.getDataRange().getValues();
  for (let i = 1; i < hd.length; i++) {
    if (safeString_(hd[i][COL_SPJ_HEADER.ID_SPJ]) === safeString_(idSpj)) {
      found = true;
      beforeStatus = normalizeStatus_(hd[i][COL_SPJ_HEADER.STATUS]);
      headerSheet.getRange(i + 1, COL_SPJ_HEADER.STATUS + 1).setValue(status);
      headerSheet.getRange(i + 1, COL_SPJ_HEADER.UPDATED_AT + 1).setValue(timestamp);
      headerSheet.getRange(i + 1, COL_SPJ_HEADER.UPDATED_BY + 1).setValue(session.email);
      break;
    }
  }
  if (!found) throw new Error('SPJ tidak ditemukan: ' + idSpj);

  const dt = detailSheet.getDataRange().getValues();
  for (let i = 1; i < dt.length; i++) {
    if (safeString_(dt[i][COL_SPJ_DETAIL.ID_SPJ]) === safeString_(idSpj) && isActiveValue_(dt[i][COL_SPJ_DETAIL.IS_ACTIVE])) {
      detailSheet.getRange(i + 1, COL_SPJ_DETAIL.STATUS + 1).setValue(status);
      detailSheet.getRange(i + 1, COL_SPJ_DETAIL.UPDATED_AT + 1).setValue(timestamp);
      detailSheet.getRange(i + 1, COL_SPJ_DETAIL.UPDATED_BY + 1).setValue(session.email);
    }
  }
  SpreadsheetApp.flush();
  clearRfkCache_();
  logActivity_(session.email, 'UPDATE_STATUS_SPJ', 'SPJ_HEADER', idSpj, { status: beforeStatus }, { status: status }, 'OK', 'Status SPJ diperbarui');
  return { success: true, status: status };
}


function normalizeHeaderRows_(sheetName) {
  const sheet = ensureSheetHeaders_(sheetName, getHeaderForSheet_(sheetName));
  const raw = getRawSheet_(sheetName);
  const headers = raw.headers.map(function(h) { return safeString_(h); });
  return raw.rows.map(function(row, idx) {
    const obj = { rowNumber: idx + 2 };
    headers.forEach(function(h, colIdx) { if (h) obj[h] = row[colIdx]; });
    return obj;
  }).filter(function(obj) {
    return Object.keys(obj).some(function(k) { return k !== 'rowNumber' && safeString_(obj[k]) !== ''; });
  });
}

function getMasterDpaRows(sessionToken) {
  requireSession_(sessionToken, APP.VIEW_ROLES);
  return normalizeHeaderRows_(APP.SHEETS.MASTER_DPA).map(function(r) {
    return {
      rowNumber: r.rowNumber,
      id_dpa: safeString_(r.id_dpa),
      kode_opd: safeString_(r.kode_opd || APP.OPD_KODE),
      nama_opd: safeString_(r.nama_opd || APP.OPD_NAMA),
      program: safeString_(r.program || '1.02.02'),
      sub_kegiatan: safeString_(r.sub_kegiatan),
      sub_kode: safeString_(r.sub_kode),
      kode_rekening: safeString_(r.kode_rekening),
      uraian_belanja: safeString_(r.uraian_belanja),
      volume: asNumber_(r.volume || 1),
      satuan: safeString_(r.satuan || 'Paket/Kegiatan'),
      harga_satuan: asNumber_(r.harga_satuan || r.pagu_total),
      pagu_total: asNumber_(r.pagu_total),
      sumber_dana: safeString_(r.sumber_dana),
      tahun: safeString_(r.tahun || APP.TAHUN_DEFAULT),
      status: safeString_(r.status || 'Aktif'),
      detail_kegiatan: safeString_(r.detail_kegiatan),
      sub_rincian: safeString_(r.sub_rincian),
      level_rincian: safeString_(r.level_rincian || 'DETAIL_KEGIATAN'),
      source_pdf: safeString_(r.source_pdf)
    };
  });
}


function saveMasterDpaDanRakRow(dpaPayload, rakPayload, sessionToken) {
  const session = requireSession_(sessionToken, APP.MUTATION_ROLES);
  dpaPayload = dpaPayload || {};
  rakPayload = rakPayload || {};
  
  // 1. Save DPA
  const dpaSheet = ensureSheetHeaders_(APP.SHEETS.MASTER_DPA, SHEET_HEADERS.MASTER_DPA);
  const dpaHeaders = dpaSheet.getRange(1, 1, 1, dpaSheet.getLastColumn()).getValues()[0].map(function(h) { return safeString_(h); });
  const idDpa = safeString_(dpaPayload.id_dpa) || makeId_('DPA');
  const dpaValues = {
    id_dpa: idDpa,
    kode_opd: safeString_(dpaPayload.kode_opd || APP.OPD_KODE),
    nama_opd: safeString_(dpaPayload.nama_opd || APP.OPD_NAMA),
    program: safeString_(dpaPayload.program || '1.02.02'),
    sub_kegiatan: safeString_(dpaPayload.sub_kegiatan),
    sub_kode: safeString_(dpaPayload.sub_kode),
    kode_rekening: safeString_(dpaPayload.kode_rekening),
    uraian_belanja: safeString_(dpaPayload.uraian_belanja),
    volume: asNumber_(dpaPayload.volume || 1),
    satuan: safeString_(dpaPayload.satuan || 'Paket/Kegiatan'),
    harga_satuan: asNumber_(dpaPayload.harga_satuan || dpaPayload.pagu_total),
    pagu_total: asNumber_(dpaPayload.pagu_total),
    sumber_dana: safeString_(dpaPayload.sumber_dana),
    tahun: safeString_(dpaPayload.tahun || APP.TAHUN_DEFAULT),
    status: safeString_(dpaPayload.status || 'Aktif'),
    detail_kegiatan: safeString_(dpaPayload.detail_kegiatan),
    sub_rincian: safeString_(dpaPayload.sub_rincian),
    level_rincian: safeString_(dpaPayload.level_rincian || 'DETAIL_KEGIATAN'),
    source_pdf: safeString_(dpaPayload.source_pdf)
  };
  if (!dpaValues.sub_kode || !dpaValues.sub_kegiatan || !dpaValues.kode_rekening || !dpaValues.uraian_belanja) {
    throw new Error('Sub kegiatan, kode rekening, dan uraian belanja wajib diisi.');
  }
  const dpaRow = dpaHeaders.map(function(h) { return dpaValues[h] !== undefined ? dpaValues[h] : ''; });
  let dpaTarget = -1;
  const dpaData = dpaSheet.getDataRange().getValues();
  for (let i = 1; i < dpaData.length; i++) {
    if (safeString_(dpaData[i][0]) === idDpa) { dpaTarget = i + 1; break; }
  }
  if (dpaTarget > 0) dpaSheet.getRange(dpaTarget, 1, 1, dpaRow.length).setValues([dpaRow]);
  else dpaSheet.getRange(dpaSheet.getLastRow() + 1, 1, 1, dpaRow.length).setValues([dpaRow]);
  
  // 2. Save RAK
  const rakSheet = ensureSheetHeaders_(APP.SHEETS.MASTER_ANGGARAN_KAS, SHEET_HEADERS.MASTER_ANGGARAN_KAS);
  const rakHeaders = rakSheet.getRange(1, 1, 1, rakSheet.getLastColumn()).getValues()[0].map(function(h) { return safeString_(h); });
  
  let idKas = safeString_(rakPayload.id_kas);
  const rakData = rakSheet.getDataRange().getValues();
  if (!idKas) {
    for (let i = 1; i < rakData.length; i++) {
      if (safeString_(rakData[i][1]) === dpaValues.sub_kode && 
          safeString_(rakData[i][3]) === dpaValues.kode_rekening && 
          safeString_(rakData[i][22]) === dpaValues.detail_kegiatan) {
        idKas = safeString_(rakData[i][0]);
        break;
      }
    }
  }
  if (!idKas) idKas = makeId_('AK');

  const months = ['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
  const monthly = months.map(function(m) { return asNumber_(rakPayload['bulan_' + m]); });
  const tw = [
    monthly.slice(0, 3).reduce(function(a, b) { return a + b; }, 0),
    monthly.slice(3, 6).reduce(function(a, b) { return a + b; }, 0),
    monthly.slice(6, 9).reduce(function(a, b) { return a + b; }, 0),
    monthly.slice(9, 12).reduce(function(a, b) { return a + b; }, 0)
  ];
  const total = tw.reduce(function(a, b) { return a + b; }, 0);
  const rakValues = {
    id_kas: idKas,
    sub_kegiatan_kode: dpaValues.sub_kode,
    sub_kegiatan_nama: dpaValues.sub_kegiatan,
    kode_rekening: dpaValues.kode_rekening,
    uraian_belanja: dpaValues.uraian_belanja,
    tw_1: tw[0], tw_2: tw[1], tw_3: tw[2], tw_4: tw[3], total: total,
    bulan_januari: monthly[0], bulan_februari: monthly[1], bulan_maret: monthly[2],
    bulan_april: monthly[3], bulan_mei: monthly[4], bulan_juni: monthly[5],
    bulan_juli: monthly[6], bulan_agustus: monthly[7], bulan_september: monthly[8],
    bulan_oktober: monthly[9], bulan_november: monthly[10], bulan_desember: monthly[11],
    tahun: dpaValues.tahun,
    detail_kegiatan: dpaValues.detail_kegiatan,
    sub_rincian: dpaValues.sub_rincian,
    pagu_dpa_referensi: dpaValues.pagu_total,
    metode_alokasi: safeString_(rakPayload.metode_alokasi || 'Input manual'),
    source_pdf: dpaValues.source_pdf
  };
  const rakRow = rakHeaders.map(function(h) { return rakValues[h] !== undefined ? rakValues[h] : ''; });
  let rakTarget = -1;
  for (let i = 1; i < rakData.length; i++) {
    if (safeString_(rakData[i][0]) === idKas) { rakTarget = i + 1; break; }
  }
  if (rakTarget > 0) rakSheet.getRange(rakTarget, 1, 1, rakRow.length).setValues([rakRow]);
  else rakSheet.getRange(rakSheet.getLastRow() + 1, 1, 1, rakRow.length).setValues([rakRow]);

  clearRfkCache_();
  logActivity_(session.email, 'UPDATE_INTEGRATED_DPA_RAK', 'MASTER_DPA', idDpa, null, { dpa: dpaValues, rak: rakValues }, 'OK', 'Master DPA & RAK tersimpan terintegrasi.');
  return { success: true, id_dpa: idDpa, id_kas: idKas, message: 'Data Master DPA dan RAK berhasil disimpan secara sinkron.' };
}

function deleteMasterDpaDanRakRow(idDpa, sessionToken) {
  const session = requireSession_(sessionToken, APP.MUTATION_ROLES);
  
  // 1. Get DPA details to match and delete RAK
  const dpaSheet = ensureSheetHeaders_(APP.SHEETS.MASTER_DPA, SHEET_HEADERS.MASTER_DPA);
  const dpaData = dpaSheet.getDataRange().getValues();
  let dpaRowIndex = -1;
  let subKode = '', kodeRek = '', detailKeg = '';
  
  for (let i = 1; i < dpaData.length; i++) {
    if (safeString_(dpaData[i][0]) === safeString_(idDpa)) {
      dpaRowIndex = i + 1;
      subKode = safeString_(dpaData[i][5]);
      kodeRek = safeString_(dpaData[i][6]);
      detailKeg = safeString_(dpaData[i][15]);
      break;
    }
  }
  
  if (dpaRowIndex === -1) {
    throw new Error('Master DPA tidak ditemukan: ' + idDpa);
  }
  
  // Disable or delete DPA
  const headerMap = getHeaderIndexMap_(dpaSheet);
  const statusIdx = headerMap[normalizeKey_('status')];
  if (statusIdx !== undefined) {
    dpaSheet.getRange(dpaRowIndex, statusIdx + 1).setValue('Nonaktif');
  } else {
    dpaSheet.deleteRow(dpaRowIndex);
  }
  
  // 2. Find and delete corresponding RAK row
  const rakSheet = ensureSheetHeaders_(APP.SHEETS.MASTER_ANGGARAN_KAS, SHEET_HEADERS.MASTER_ANGGARAN_KAS);
  const rakData = rakSheet.getDataRange().getValues();
  for (let i = 1; i < rakData.length; i++) {
    if (safeString_(rakData[i][1]) === subKode && 
        safeString_(rakData[i][3]) === kodeRek && 
        safeString_(rakData[i][22]) === detailKeg) {
      rakSheet.deleteRow(i + 1);
      break;
    }
  }
  
  clearRfkCache_();
  logActivity_(session.email, 'DELETE_INTEGRATED_DPA_RAK', 'MASTER_DPA', idDpa, null, null, 'OK', 'Master DPA & RAK berhasil dinonaktifkan/dihapus.');
  return { success: true, message: 'Data Master DPA dan RAK berhasil dihapus.' };
}

function saveMasterDpaRow(payload, sessionToken) {
  const session = requireSession_(sessionToken, APP.MUTATION_ROLES);
  payload = payload || {};
  const sheet = ensureSheetHeaders_(APP.SHEETS.MASTER_DPA, SHEET_HEADERS.MASTER_DPA);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return safeString_(h); });
  const id = safeString_(payload.id_dpa) || makeId_('DPA');
  const values = {
    id_dpa: id,
    kode_opd: safeString_(payload.kode_opd || APP.OPD_KODE),
    nama_opd: safeString_(payload.nama_opd || APP.OPD_NAMA),
    program: safeString_(payload.program || '1.02.02'),
    sub_kegiatan: safeString_(payload.sub_kegiatan),
    sub_kode: safeString_(payload.sub_kode),
    kode_rekening: safeString_(payload.kode_rekening),
    uraian_belanja: safeString_(payload.uraian_belanja),
    volume: asNumber_(payload.volume || 1),
    satuan: safeString_(payload.satuan || 'Paket/Kegiatan'),
    harga_satuan: asNumber_(payload.harga_satuan || payload.pagu_total),
    pagu_total: asNumber_(payload.pagu_total),
    sumber_dana: safeString_(payload.sumber_dana),
    tahun: safeString_(payload.tahun || APP.TAHUN_DEFAULT),
    status: safeString_(payload.status || 'Aktif'),
    detail_kegiatan: safeString_(payload.detail_kegiatan),
    sub_rincian: safeString_(payload.sub_rincian),
    level_rincian: safeString_(payload.level_rincian || 'DETAIL_KEGIATAN'),
    source_pdf: safeString_(payload.source_pdf)
  };
  if (!values.sub_kode || !values.sub_kegiatan || !values.kode_rekening || !values.uraian_belanja) {
    throw new Error('Sub kegiatan, kode rekening, dan uraian belanja wajib diisi.');
  }
  const row = headers.map(function(h) { return values[h] !== undefined ? values[h] : ''; });
  let target = -1;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (safeString_(data[i][0]) === id) { target = i + 1; break; }
  }
  if (target > 0) sheet.getRange(target, 1, 1, row.length).setValues([row]);
  else sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  clearRfkCache_();
  logActivity_(session.email, target > 0 ? 'UPDATE_MASTER_DPA' : 'CREATE_MASTER_DPA', 'MASTER_DPA', id, null, values, 'OK', 'Master DPA tersimpan');
  return { success: true, id_dpa: id, message: 'Master DPA tersimpan.' };
}

function deleteMasterDpaRow(id, sessionToken) {
  const session = requireSession_(sessionToken, APP.MUTATION_ROLES);
  const sheet = ensureSheetHeaders_(APP.SHEETS.MASTER_DPA, SHEET_HEADERS.MASTER_DPA);
  const headerMap = getHeaderIndexMap_(sheet);
  const statusIdx = headerMap[normalizeKey_('status')];
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (safeString_(data[i][0]) === safeString_(id)) {
      if (statusIdx !== undefined) sheet.getRange(i + 1, statusIdx + 1).setValue('Nonaktif');
      else sheet.deleteRow(i + 1);
      clearRfkCache_();
      logActivity_(session.email, 'DELETE_MASTER_DPA', 'MASTER_DPA', id, null, null, 'OK', 'Master DPA dinonaktifkan');
      return { success: true, message: 'Master DPA dinonaktifkan.' };
    }
  }
  throw new Error('Master DPA tidak ditemukan: ' + id);
}

function getMasterAngkasRows(sessionToken) {
  requireSession_(sessionToken, APP.VIEW_ROLES);
  return normalizeHeaderRows_(APP.SHEETS.MASTER_ANGGARAN_KAS).map(function(r) {
    return {
      rowNumber: r.rowNumber,
      id_kas: safeString_(r.id_kas),
      sub_kegiatan_kode: safeString_(r.sub_kegiatan_kode),
      sub_kegiatan_nama: safeString_(r.sub_kegiatan_nama),
      kode_rekening: safeString_(r.kode_rekening),
      uraian_belanja: safeString_(r.uraian_belanja),
      tw_1: asNumber_(r.tw_1),
      tw_2: asNumber_(r.tw_2),
      tw_3: asNumber_(r.tw_3),
      tw_4: asNumber_(r.tw_4),
      total: asNumber_(r.total),
      bulan_januari: asNumber_(r.bulan_januari),
      bulan_februari: asNumber_(r.bulan_februari),
      bulan_maret: asNumber_(r.bulan_maret),
      bulan_april: asNumber_(r.bulan_april),
      bulan_mei: asNumber_(r.bulan_mei),
      bulan_juni: asNumber_(r.bulan_juni),
      bulan_juli: asNumber_(r.bulan_juli),
      bulan_agustus: asNumber_(r.bulan_agustus),
      bulan_september: asNumber_(r.bulan_september),
      bulan_oktober: asNumber_(r.bulan_oktober),
      bulan_november: asNumber_(r.bulan_november),
      bulan_desember: asNumber_(r.bulan_desember),
      tahun: safeString_(r.tahun || APP.TAHUN_DEFAULT),
      detail_kegiatan: safeString_(r.detail_kegiatan),
      sub_rincian: safeString_(r.sub_rincian),
      pagu_dpa_referensi: asNumber_(r.pagu_dpa_referensi),
      metode_alokasi: safeString_(r.metode_alokasi),
      source_pdf: safeString_(r.source_pdf)
    };
  });
}

function saveMasterAngkasRow(payload, sessionToken) {
  const session = requireSession_(sessionToken, APP.MUTATION_ROLES);
  payload = payload || {};
  const sheet = ensureSheetHeaders_(APP.SHEETS.MASTER_ANGGARAN_KAS, SHEET_HEADERS.MASTER_ANGGARAN_KAS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return safeString_(h); });
  const id = safeString_(payload.id_kas) || makeId_('AK');
  const months = ['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
  const monthly = months.map(function(m) { return asNumber_(payload['bulan_' + m]); });
  const tw = [
    monthly.slice(0, 3).reduce(function(a, b) { return a + b; }, 0),
    monthly.slice(3, 6).reduce(function(a, b) { return a + b; }, 0),
    monthly.slice(6, 9).reduce(function(a, b) { return a + b; }, 0),
    monthly.slice(9, 12).reduce(function(a, b) { return a + b; }, 0)
  ];
  const total = tw.reduce(function(a, b) { return a + b; }, 0);
  const values = {
    id_kas: id,
    sub_kegiatan_kode: safeString_(payload.sub_kegiatan_kode),
    sub_kegiatan_nama: safeString_(payload.sub_kegiatan_nama),
    kode_rekening: safeString_(payload.kode_rekening),
    uraian_belanja: safeString_(payload.uraian_belanja),
    tw_1: tw[0], tw_2: tw[1], tw_3: tw[2], tw_4: tw[3], total: total,
    bulan_januari: monthly[0], bulan_februari: monthly[1], bulan_maret: monthly[2],
    bulan_april: monthly[3], bulan_mei: monthly[4], bulan_juni: monthly[5],
    bulan_juli: monthly[6], bulan_agustus: monthly[7], bulan_september: monthly[8],
    bulan_oktober: monthly[9], bulan_november: monthly[10], bulan_desember: monthly[11],
    tahun: safeString_(payload.tahun || APP.TAHUN_DEFAULT),
    detail_kegiatan: safeString_(payload.detail_kegiatan),
    sub_rincian: safeString_(payload.sub_rincian),
    pagu_dpa_referensi: asNumber_(payload.pagu_dpa_referensi),
    metode_alokasi: safeString_(payload.metode_alokasi || 'Input manual'),
    source_pdf: safeString_(payload.source_pdf)
  };
  if (!values.sub_kegiatan_kode || !values.sub_kegiatan_nama) throw new Error('Sub kegiatan wajib diisi.');
  const row = headers.map(function(h) { return values[h] !== undefined ? values[h] : ''; });
  let target = -1;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (safeString_(data[i][0]) === id) { target = i + 1; break; }
  }
  if (target > 0) sheet.getRange(target, 1, 1, row.length).setValues([row]);
  else sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  clearRfkCache_();
  logActivity_(session.email, target > 0 ? 'UPDATE_MASTER_ANGKAS' : 'CREATE_MASTER_ANGKAS', 'MASTER_ANGGARAN_KAS', id, null, values, 'OK', 'Master Anggaran Kas tersimpan');
  return { success: true, id_kas: id, message: 'Master Anggaran Kas tersimpan.' };
}

function deleteMasterAngkasRow(id, sessionToken) {
  const session = requireSession_(sessionToken, APP.MUTATION_ROLES);
  const sheet = ensureSheetHeaders_(APP.SHEETS.MASTER_ANGGARAN_KAS, SHEET_HEADERS.MASTER_ANGGARAN_KAS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (safeString_(data[i][0]) === safeString_(id)) {
      sheet.deleteRow(i + 1);
      clearRfkCache_();
      logActivity_(session.email, 'DELETE_MASTER_ANGKAS', 'MASTER_ANGGARAN_KAS', id, null, null, 'OK', 'Master Anggaran Kas dihapus');
      return { success: true, message: 'Master Anggaran Kas dihapus.' };
    }
  }
  throw new Error('Master Anggaran Kas tidak ditemukan: ' + id);
}

function clearRfkCachePublic(sessionToken) {
  requireSession_(sessionToken, APP.MUTATION_ROLES);
  clearRfkCache_();
  return { success: true, message: 'Cache RFK dibersihkan.' };
}

/***************************************************************************
 * Import reference data
 ***************************************************************************/
function importSumberDana() {
  const sheet = ensureSheetHeaders_(APP.SHEETS.MASTER_SUMBER_DANA, SHEET_HEADERS.MASTER_SUMBER_DANA);
  const data = [
    ['SD001', 'Pendapatan Bagi Hasil Pajak Rokok', 'PAJAK ROKOK', 'Dari bagi hasil cukai rokok'],
    ['SD002', 'DAK Non Fisik-Dana BOK', 'DAK', 'Dana Alokasi Khusus Non Fisik'],
    ['SD003', 'PENDAPATAN ASLI DAERAH (PAD)', 'PAD', 'Pendapatan asli daerah'],
    ['SD004', 'Dana BOK-BOK Dinas-BOK Kabupaten/Kota', 'DAK', 'Bantuan Operasional Kesehatan']
  ];
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
  return 'âœ… Master Sumber Dana berhasil diimport: ' + data.length + ' data.';
}

function getDefaultDpaData_() {
  return [
    {
      kode: '1.02.02.2.02.0020',
      nama: 'Pengelolaan Surveilans Kesehatan',
      items: [
        {
          kodeRekening: '5.1.02.01.01.0052',
          uraianBelanja: 'Belanja Makanan dan Minuman Rapat',
          detailKegiatan: 'Rapat Evaluasi Pengelola Program bagi Petugas Surveilans di Puskesmas',
          subRincian: 'Belanja Makanan dan Minuman Rapat Evaluasi Pengelola Program bagi Petugas Surveilans di Puskesmas',
          volume: 1,
          satuan: 'Paket',
          hargaSatuan: 19190000,
          pagu: 19190000,
          sumber: 'Pendapatan Bagi Hasil Pajak Rokok'
        },
        {
          kodeRekening: '5.1.02.02.01.0004',
          uraianBelanja: 'Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia',
          detailKegiatan: 'Rapat Koordinasi dan Evaluasi Surveilans Kesehatan',
          subRincian: 'Honorarium narasumber/moderator/panitia kegiatan surveilans kesehatan',
          volume: 1,
          satuan: 'Paket',
          hargaSatuan: 24200000,
          pagu: 24200000,
          sumber: 'Pendapatan Bagi Hasil Pajak Rokok'
        },
        {
          kodeRekening: '5.1.02.02.01.0005',
          uraianBelanja: 'Honorarium Tim Pelaksana Kegiatan dan Sekretariat Tim Pelaksana Kegiatan',
          detailKegiatan: 'Tim Pelaksana Pengelolaan Surveilans Kesehatan',
          subRincian: 'Honorarium tim pelaksana kegiatan surveilans kesehatan',
          volume: 1,
          satuan: 'Paket',
          hargaSatuan: 18000000,
          pagu: 18000000,
          sumber: 'Pendapatan Bagi Hasil Pajak Rokok'
        },
        {
          kodeRekening: '5.1.02.02.01.0029',
          uraianBelanja: 'Belanja Jasa Tenaga Kesehatan',
          detailKegiatan: 'Dukungan Petugas Surveilans Kesehatan',
          subRincian: 'Jasa tenaga kesehatan dalam pelaksanaan surveilans',
          volume: 1,
          satuan: 'Paket',
          hargaSatuan: 30000000,
          pagu: 30000000,
          sumber: 'Pendapatan Bagi Hasil Pajak Rokok'
        },
        {
          kodeRekening: '5.1.02.02.12.0001',
          uraianBelanja: 'Belanja Kursus Singkat/Pelatihan',
          detailKegiatan: 'Peningkatan Kapasitas Petugas Surveilans',
          subRincian: 'Pelatihan teknis surveilans kesehatan',
          volume: 1,
          satuan: 'Paket',
          hargaSatuan: 35000000,
          pagu: 35000000,
          sumber: 'Pendapatan Bagi Hasil Pajak Rokok'
        },
        {
          kodeRekening: '5.1.02.02.15.0001',
          uraianBelanja: 'Belanja Perjalanan Dinas Dalam Kota',
          detailKegiatan: 'Monitoring Surveilans Kesehatan ke Puskesmas',
          subRincian: 'Perjalanan dinas dalam kota untuk pembinaan dan monitoring surveilans',
          volume: 1,
          satuan: 'Paket',
          hargaSatuan: 42000000,
          pagu: 42000000,
          sumber: 'Pendapatan Bagi Hasil Pajak Rokok'
        },
        {
          kodeRekening: '5.1.02.02.15.0002',
          uraianBelanja: 'Belanja Perjalanan Dinas Biasa',
          detailKegiatan: 'Koordinasi Surveilans Kesehatan Tingkat Provinsi/Pusat',
          subRincian: 'Perjalanan dinas luar daerah untuk koordinasi program surveilans',
          volume: 1,
          satuan: 'Paket',
          hargaSatuan: 32000000,
          pagu: 32000000,
          sumber: 'Pendapatan Bagi Hasil Pajak Rokok'
        },
        {
          kodeRekening: '5.1.02.01.01.0024',
          uraianBelanja: 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor',
          detailKegiatan: 'Dukungan ATK Kegiatan Surveilans Kesehatan',
          subRincian: 'ATK dan bahan administrasi kegiatan surveilans',
          volume: 1,
          satuan: 'Paket',
          hargaSatuan: 6500000,
          pagu: 6500000,
          sumber: 'Pendapatan Bagi Hasil Pajak Rokok'
        },
        {
          kodeRekening: '5.1.02.01.01.0025',
          uraianBelanja: 'Belanja Alat/Bahan untuk Kegiatan Kantor-Kertas dan Cover',
          detailKegiatan: 'Dukungan Cetak Dokumen Surveilans Kesehatan',
          subRincian: 'Kertas dan cover dokumen laporan surveilans',
          volume: 1,
          satuan: 'Paket',
          hargaSatuan: 5900000,
          pagu: 5900000,
          sumber: 'Pendapatan Bagi Hasil Pajak Rokok'
        },
        {
          kodeRekening: '5.1.02.01.01.0026',
          uraianBelanja: 'Belanja Alat/Bahan untuk Kegiatan Kantor-Bahan Cetak',
          detailKegiatan: 'Cetak Formulir dan Media Surveilans Kesehatan',
          subRincian: 'Bahan cetak formulir, laporan, dan media surveilans',
          volume: 1,
          satuan: 'Paket',
          hargaSatuan: 12600000,
          pagu: 12600000,
          sumber: 'Pendapatan Bagi Hasil Pajak Rokok'
        },
        {
          kodeRekening: '5.1.02.01.01.0053',
          uraianBelanja: 'Belanja Makanan dan Minuman Aktivitas Lapangan',
          detailKegiatan: 'Pertemuan Lapangan Surveilans Kesehatan',
          subRincian: 'Konsumsi aktivitas lapangan surveilans kesehatan',
          volume: 1,
          satuan: 'Paket',
          hargaSatuan: 66400000,
          pagu: 66400000,
          sumber: 'Pendapatan Bagi Hasil Pajak Rokok'
        }
      ],
      indikator: {
        keluaran: 'Jumlah Dokumen Hasil Pengelolaan Surveilans Kesehatan',
        target: '4 Dokumen'
      }
    },
    {
      kode: '1.02.02.2.02.0028',
      nama: 'Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional',
      items: [
        { kodeRekening: '5.1.02.01.01.0026', uraianBelanja: 'Belanja Alat/Bahan untuk Kegiatan Kantor-Bahan Cetak', detailKegiatan: 'Cetak Formulir Pengambilan dan Pengiriman Spesimen KLB', subRincian: 'Formulir, label, dan dokumen pendukung spesimen', volume: 1, satuan: 'Paket', hargaSatuan: 15000000, pagu: 15000000, sumber: 'DAK Non Fisik-Dana BOK-BOK Dinas-BOK Kabupaten/Kota; Pendapatan Bagi Hasil Pajak Rokok' },
        { kodeRekening: '5.1.02.01.01.0052', uraianBelanja: 'Belanja Makanan dan Minuman Rapat', detailKegiatan: 'Rapat Koordinasi Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB', subRincian: 'Konsumsi rapat koordinasi spesimen KLB', volume: 1, satuan: 'Paket', hargaSatuan: 28500000, pagu: 28500000, sumber: 'DAK Non Fisik-Dana BOK-BOK Dinas-BOK Kabupaten/Kota; Pendapatan Bagi Hasil Pajak Rokok' },
        { kodeRekening: '5.1.02.02.01.0029', uraianBelanja: 'Belanja Jasa Tenaga Kesehatan', detailKegiatan: 'Petugas Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB', subRincian: 'Jasa petugas kesehatan pengambilan, pengepakan, dan pengiriman spesimen', volume: 1, satuan: 'Paket', hargaSatuan: 640000000, pagu: 640000000, sumber: 'DAK Non Fisik-Dana BOK-BOK Dinas-BOK Kabupaten/Kota; Pendapatan Bagi Hasil Pajak Rokok' },
        { kodeRekening: '5.1.02.02.15.0001', uraianBelanja: 'Belanja Perjalanan Dinas Dalam Kota', detailKegiatan: 'Distribusi dan Pengambilan Spesimen Penyakit Potensial KLB di Fasyankes', subRincian: 'Transport lokal petugas pengambilan dan pengiriman spesimen', volume: 1, satuan: 'Paket', hargaSatuan: 175158000, pagu: 175158000, sumber: 'DAK Non Fisik-Dana BOK-BOK Dinas-BOK Kabupaten/Kota; Pendapatan Bagi Hasil Pajak Rokok' },
        { kodeRekening: '5.1.02.02.15.0002', uraianBelanja: 'Belanja Perjalanan Dinas Biasa', detailKegiatan: 'Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional', subRincian: 'Perjalanan dinas/kurir spesimen ke laboratorium rujukan atau nasional', volume: 1, satuan: 'Paket', hargaSatuan: 55000000, pagu: 55000000, sumber: 'DAK Non Fisik-Dana BOK-BOK Dinas-BOK Kabupaten/Kota; Pendapatan Bagi Hasil Pajak Rokok' }
      ],
      indikator: {
        keluaran: 'Jumlah Spesimen Penyakit Potensial Kejadian Luar Biasa (KLB) ke Laboratorium Rujukan/Nasional yang Didistribusikan',
        target: '982 Paket'
      }
    },
    {
      kode: '1.02.02.2.02.0036',
      nama: 'Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal)',
      items: [
        { kodeRekening: '5.1.02.01.01.0052', uraianBelanja: 'Belanja Makanan dan Minuman Rapat', detailKegiatan: 'Rapat Koordinasi Investigasi Awal KIPI dan Pemberian Obat Massal', subRincian: 'Konsumsi rapat koordinasi investigasi awal KIPI/POMP', volume: 1, satuan: 'Paket', hargaSatuan: 9250000, pagu: 9250000, sumber: 'Pendapatan Bagi Hasil Pajak Rokok' },
        { kodeRekening: '5.1.02.02.01.0029', uraianBelanja: 'Belanja Jasa Tenaga Kesehatan', detailKegiatan: 'Petugas Investigasi Awal KIPI dan Kejadian Tidak Diharapkan', subRincian: 'Jasa petugas kesehatan investigasi awal KIPI/POMP', volume: 1, satuan: 'Paket', hargaSatuan: 7000000, pagu: 7000000, sumber: 'Pendapatan Bagi Hasil Pajak Rokok' },
        { kodeRekening: '5.1.02.02.15.0001', uraianBelanja: 'Belanja Perjalanan Dinas Dalam Kota', detailKegiatan: 'Kunjungan Lapangan Investigasi Awal KIPI dan Pemberian Obat Massal', subRincian: 'Transport lokal investigasi awal KIPI/POMP', volume: 1, satuan: 'Paket', hargaSatuan: 12000000, pagu: 12000000, sumber: 'Pendapatan Bagi Hasil Pajak Rokok' }
      ],
      indikator: {
        keluaran: 'Jumlah Laporan Hasil Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal)',
        target: '2 Laporan'
      }
    },
    {
      kode: '1.02.02.2.02.0037',
      nama: 'Pelaksanaan Kewaspadaan Dini dan Respon Wabah',
      items: [
        { kodeRekening: '5.1.02.01.01.0026', uraianBelanja: 'Belanja Alat/Bahan untuk Kegiatan Kantor-Bahan Cetak', detailKegiatan: 'Cetak Formulir Kewaspadaan Dini dan Respon Wabah', subRincian: 'Formulir laporan dan media kewaspadaan dini', volume: 1, satuan: 'Paket', hargaSatuan: 2500000, pagu: 2500000, sumber: 'Pendapatan Bagi Hasil Pajak Rokok' },
        { kodeRekening: '5.1.02.01.01.0052', uraianBelanja: 'Belanja Makanan dan Minuman Rapat', detailKegiatan: 'Rapat Koordinasi Kewaspadaan Dini dan Respon Wabah', subRincian: 'Konsumsi rapat koordinasi SKDR/respon wabah', volume: 1, satuan: 'Paket', hargaSatuan: 5430000, pagu: 5430000, sumber: 'Pendapatan Bagi Hasil Pajak Rokok' },
        { kodeRekening: '5.1.02.02.01.0029', uraianBelanja: 'Belanja Jasa Tenaga Kesehatan', detailKegiatan: 'Petugas Kewaspadaan Dini dan Respon Wabah', subRincian: 'Jasa tenaga kesehatan pelaksanaan kewaspadaan dini/respon wabah', volume: 1, satuan: 'Paket', hargaSatuan: 3500000, pagu: 3500000, sumber: 'Pendapatan Bagi Hasil Pajak Rokok' },
        { kodeRekening: '5.1.02.02.15.0001', uraianBelanja: 'Belanja Perjalanan Dinas Dalam Kota', detailKegiatan: 'Kunjungan Lapangan Kewaspadaan Dini dan Respon Wabah', subRincian: 'Transport lokal respon cepat dan monitoring kewaspadaan dini', volume: 1, satuan: 'Paket', hargaSatuan: 7000000, pagu: 7000000, sumber: 'Pendapatan Bagi Hasil Pajak Rokok' }
      ],
      indikator: {
        keluaran: 'Jumlah Dokumen Hasil Pelaksanaan Kewaspadaan Dini dan Respon Wabah',
        target: '2 Dokumen'
      }
    },
    {
      kode: '1.02.02.2.02.0048',
      nama: 'Pengelolaan Layanan Imunisasi',
      items: [
        { kodeRekening: '5.1.02.01.01.0052', uraianBelanja: 'Belanja Makanan dan Minuman Rapat', detailKegiatan: 'Rapat Evaluasi Pengelola Program bagi Petugas Imunisasi di Puskesmas', subRincian: 'Belanja Makanan dan Minuman Rapat Evaluasi Pengelola Program bagi Petugas Imunisasi di Puskesmas', volume: 50 * 4, satuan: 'Orang Kali', hargaSatuan: 37000, pagu: 7400000, sumber: 'PENDAPATAN ASLI DAERAH (PAD)' },
        { kodeRekening: '5.1.02.01.01.0052', uraianBelanja: 'Belanja Makanan dan Minuman Rapat', detailKegiatan: 'Sosialisasi Managemen Imunisasi ke Bidan di Kota Depok (per Ranting)', subRincian: 'Belanja Makanan dan Minuman Rapat Sosialisasi Managemen Imunisasi ke Bidan di Kota Depok (per Ranting)', volume: 45 * 11 * 1, satuan: 'Orang Kali Hari', hargaSatuan: 37000, pagu: 18315000, sumber: 'PENDAPATAN ASLI DAERAH (PAD)' },
        { kodeRekening: '5.1.02.01.01.0026', uraianBelanja: 'Belanja Alat/Bahan untuk Kegiatan Kantor-Bahan Cetak', detailKegiatan: 'Cetak Format Pencatatan dan Pelaporan Layanan Imunisasi', subRincian: 'Cetak format pencatatan dan pelaporan imunisasi', volume: 1, satuan: 'Paket', hargaSatuan: 6250000, pagu: 6250000, sumber: 'PENDAPATAN ASLI DAERAH (PAD)' },
        { kodeRekening: '5.1.02.02.15.0001', uraianBelanja: 'Belanja Perjalanan Dinas Dalam Kota', detailKegiatan: 'Monitoring dan Pembinaan Layanan Imunisasi ke Puskesmas', subRincian: 'Transport lokal monitoring layanan imunisasi', volume: 1, satuan: 'Paket', hargaSatuan: 8800000, pagu: 8800000, sumber: 'PENDAPATAN ASLI DAERAH (PAD)' },
        { kodeRekening: '5.1.02.02.01.0029', uraianBelanja: 'Belanja Jasa Tenaga Kesehatan', detailKegiatan: 'Dukungan Petugas Pengelolaan Layanan Imunisasi', subRincian: 'Jasa tenaga kesehatan untuk layanan imunisasi', volume: 1, satuan: 'Paket', hargaSatuan: 9020000, pagu: 9020000, sumber: 'PENDAPATAN ASLI DAERAH (PAD)' }
      ],
      indikator: {
        keluaran: 'Jumlah Dokumen Hasil Pengelolaan Layanan Imunisasi',
        target: '6 Dokumen'
      }
    }
  ];
}

function getFlattenedDefaultDpaData_() {
  const rows = [];
  getDefaultDpaData_().forEach(function(sub) {
    sub.items.forEach(function(item, idx) {
      rows.push(Object.assign({
        id: 'DPA-' + sub.kode + '-' + String(idx + 1).padStart(2, '0'),
        kode: sub.kode,
        nama: sub.nama,
        indikator: sub.indikator
      }, item));
    });
  });
  return rows;
}

function getReviewedDpaImportRows_() {
  return [
  [
    "DPA-102022020020-51020100100027-001",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.01.001.00027",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Benda Pos",
    1,
    "Paket/Kegiatan",
    320000,
    320000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Belanja Alat/Bahan untuk Kegiatan Kantor - Benda Pos",
    "Belanja Alat/Bahan untuk Kegiatan Kantor - Benda Pos",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020100100052-002",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.01.001.00052",
    "Belanja Makanan dan Minuman Rapat",
    1,
    "Paket/Kegiatan",
    1850000,
    1850000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Workshop Pemantapan Petugas Sistem Komputerisasi Haji Terpadu Bidang Kesehatan",
    "Belanja Makanan dan Minuman Rapat Workshop Pemantapan Petugas Sistem Komputerisasi Haji Terpadu Bidang Kesehatan",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020200100003-003",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    1,
    "Paket/Kegiatan",
    3600000,
    3600000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Evaluasi Penyelenggaraan Surveilans Penyakit bagi Petugas Puskesmas dan RS",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Evaluasi Penyelenggaraan Surveilans Penyakit bagi Petugas Puskesmas dan RS",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020200100003-004",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    1,
    "Paket/Kegiatan",
    3600000,
    3600000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Workshop Pemantapan Petugas Sistem Komputerisasi Haji Terpadu Bidang Kesehatan",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Workshop pemantapan petugas Sistem Komputerisasi Haji Terpadu Bidang Kesehatan",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020200100014-005",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.02.001.00014",
    "Belanja Jasa Tenaga Kesehatan",
    1,
    "Paket/Kegiatan",
    115050000,
    115050000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "PJLP Layanan Kesehatan Surveilans",
    "Apresiasi Upah PJLP Layanan Kesehatan Epidemiolog Kesehatan",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020200100080-006",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.02.001.00080",
    "Belanja Honorarium Penanggungjawaban Pengelola Keuangan",
    1,
    "Paket/Kegiatan",
    16920000,
    16920000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Honorarium Pejabat Pelaksana Teknis Kegiatan (PPTK)",
    "Belanja Honorarium Penanggungjawaban Pengelola Keuangan Honorarium Pejabat Pelaksana Teknis Kegiatan (PPTK)",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020200100085-007",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.02.001.00085",
    "Belanja jasa Pegawai Pemerintah dengan Perjanjian Kerja (PPPK) Paruh Waktu pada jabatan tenaga kesehatan",
    1,
    "Paket/Kegiatan",
    57525000,
    57525000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "PPPK Paruh Waktu pada Jabatan Epidemiolog Kesehatan Ahli Pertama",
    "PPPK Paruh Waktu pada Jabatan Epidemiolog Kesehatan Ahli Pertama",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020200100085-008",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.02.001.00085",
    "Belanja jasa Pegawai Pemerintah dengan Perjanjian Kerja (PPPK) Paruh Waktu pada jabatan tenaga kesehatan",
    1,
    "Paket/Kegiatan",
    49855000,
    49855000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "PPPK Paruh Waktu pada Jabatan Tenaga Kesehatan",
    "PPPK Paruh Waktu pada Jabatan Tenaga Kesehatan",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020200200005-009",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.02.002.00005",
    "Belanja Iuran Jaminan Kesehatan bagi Non ASN",
    1,
    "Paket/Kegiatan",
    5500000,
    5500000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Iuran BPJS Kesehatan",
    "Belanja Iuran Jaminan Kesehatan bagi Non ASN Iuran Jaminan Kesehatan bagi Non ASN",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020200200006-010",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.02.002.00006",
    "Belanja Iuran Jaminan Kecelakaan Kerja bagi Non ASN",
    1,
    "Paket/Kegiatan",
    4800000,
    4800000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Iuran BPJS Ketenagakerjaan",
    "Belanja Iuran Jaminan Kecelakaan Kerja bagi Non ASN Iuran BPJS Ketenagakerjaan",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020200200016-011",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.02.002.00016",
    "Belanja Iuran Jaminan Kesehatan bagi PPPK Paruh Waktu pada Jabatan Tenaga Kesehatan",
    1,
    "Paket/Kegiatan",
    2750000,
    2750000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Iuran Jaminan Kesehatan bagi PPPK Paruh Waktu",
    "Iuran Jaminan Kesehatan PPPK Paruh Waktu",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020200200024-012",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.02.002.00024",
    "Belanja Iuran Jaminan Kecelakaan Kerja bagi PPPK Paruh Waktu pada Jabatan Tenaga Kesehatan",
    1,
    "Paket/Kegiatan",
    4800000,
    4800000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Iuran Jaminan Kecelakaan Kerja bagi PPPK Paruh Waktu pada Jabatan Tenaga Kesehatan",
    "Iuran Jaminan Kecelakaan Kerja bagi PPPK Paruh Waktu pada Jabatan Tenaga Kesehatan",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020400100001-013",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.04.001.00001",
    "Belanja Perjalanan Dinas Biasa",
    1,
    "Paket/Kegiatan",
    11200000,
    11200000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Pelayanan Haji di Debarkasi",
    "Belanja Perjalanan Dinas Biasa Pelayanan Haji di Debarkasi",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020400100001-014",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.04.001.00001",
    "Belanja Perjalanan Dinas Biasa",
    1,
    "Paket/Kegiatan",
    11200000,
    11200000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Pelayanan Haji di Embarkasi",
    "Belanja Perjalanan Dinas Biasa Pelayanan Haji di Embarkasi",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020020-51020400100001-015",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Surveilans Kesehatan",
    "1.02.02.2.02.0020",
    "5.1.02.04.001.00001",
    "Belanja Perjalanan Dinas Biasa",
    1,
    "Paket/Kegiatan",
    2820000,
    2820000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Pengambilan Sarana Prasarana Kesehatan Jemaah Haji",
    "Belanja Perjalanan Dinas Biasa Pengambilan Sarana Prasarana Kesehatan Jemaah Haji",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0020 Pengelolaan Surveilans Kesehatan.pdf"
  ],
  [
    "DPA-102022020028-51020100100012-001",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional",
    "1.02.02.2.02.0028",
    "5.1.02.01.001.00012",
    "Belanja Bahan-Bahan Lainnya",
    1,
    "Paket/Kegiatan",
    82800000,
    82800000,
    "DAK Non Fisik-Dana BOK-BOK Dinas-BOK Kabupaten/Kota",
    2026,
    "Aktif",
    "BMHP pengemasan spesimen DNA HPV",
    "BMHP pengemasan spesimen DNA HPV (DAK Non Fisik)",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0028 Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan_Nasional.pdf"
  ],
  [
    "DPA-102022020028-51020100100024-002",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional",
    "1.02.02.2.02.0028",
    "5.1.02.01.001.00024",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor",
    1,
    "Paket/Kegiatan",
    358000,
    358000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0028 Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan_Nasional.pdf"
  ],
  [
    "DPA-102022020028-51020200100015-003",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional",
    "1.02.02.2.02.0028",
    "5.1.02.02.001.00015",
    "Belanja Jasa Tenaga Laboratorium",
    1,
    "Paket/Kegiatan",
    720000000,
    720000000,
    "DAK Non Fisik-Dana BOK-BOK Dinas-BOK Kabupaten/Kota",
    2026,
    "Aktif",
    "Jasa Pemeriksaan spesimen DNA HPV",
    "Jasa Pemeriksaan spesimen DNA HPV",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0028 Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan_Nasional.pdf"
  ],
  [
    "DPA-102022020028-51020200100064-004",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional",
    "1.02.02.2.02.0028",
    "5.1.02.02.001.00064",
    "Belanja Paket/Pengiriman",
    1,
    "Paket/Kegiatan",
    9500000,
    9500000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Biaya Jasa Pengiriman Spesimen Kasus Potensial KLB ke Bandung Jawa Barat",
    "Belanja Paket/Pengiriman Biaya Jasa Pengiriman Spesimen Kasus Potensial KLB ke Bandung Jawa Barat",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0028 Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan_Nasional.pdf"
  ],
  [
    "DPA-102022020028-51020200100064-005",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional",
    "1.02.02.2.02.0028",
    "5.1.02.02.001.00064",
    "Belanja Paket/Pengiriman",
    1,
    "Paket/Kegiatan",
    11000000,
    11000000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Biaya Jasa Pengiriman Spesimen Kasus Potensial KLB ke Jakarta",
    "Belanja Paket/Pengiriman Biaya Jasa Pengiriman Spesimen Kasus Potensial KLB ke Jakarta",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0028 Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan_Nasional.pdf"
  ],
  [
    "DPA-102022020028-51020400100003-006",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional",
    "1.02.02.2.02.0028",
    "5.1.02.04.001.00003",
    "Belanja Perjalanan Dinas Dalam Kota",
    1,
    "Paket/Kegiatan",
    90000000,
    90000000,
    "DAK Non Fisik-Dana BOK-BOK Dinas-BOK Kabupaten/Kota",
    2026,
    "Aktif",
    "Biaya Jasa Pengiriman spesimen DNA HPV",
    "Transport Petugas Puskesmas Pengiriman Spesimen DNA HPV (DAK Non Fisik)",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0028 Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan_Nasional.pdf"
  ],
  [
    "DPA-102022020036-51020200100003-001",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal)",
    "1.02.02.2.02.0036",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    1,
    "Paket/Kegiatan",
    1800000,
    1800000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Rapat Koordinasi Audit Kasus KIPI",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Rapat Koordinasi Audit Kasus KIPI",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0036 Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal).pdf"
  ],
  [
    "DPA-102022020036-51020200100004-002",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal)",
    "1.02.02.2.02.0036",
    "5.1.02.02.001.00004",
    "Honorarium Tim Pelaksana Kegiatan dan Sekretariat Tim Pelaksana Kegiatan",
    1,
    "Paket/Kegiatan",
    23250000,
    23250000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Honorarium Tim Pokja Kejadian Ikutan Paska Imunisasi (KIPI)",
    "Honorarium Tim Pelaksana Kegiatan dan Sekretariat Tim Pelaksana Kegiatan Honorarium Tim Pokja Kejadian Ikutan Paska Imunisasi (KIPI)",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0036 Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal).pdf"
  ],
  [
    "DPA-102022020036-51020400100003-003",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal)",
    "1.02.02.2.02.0036",
    "5.1.02.04.001.00003",
    "Belanja Perjalanan Dinas Dalam Kota",
    1,
    "Paket/Kegiatan",
    3200000,
    3200000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Audit kasus KIPI",
    "Belanja Perjalanan Dinas Dalam Kota Audit kasus KIPI",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0036 Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal).pdf"
  ],
  [
    "DPA-102022020037-51020100100004-001",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pelaksanaan Kewaspadaan Dini dan Respon Wabah",
    "1.02.02.2.02.0037",
    "5.1.02.01.001.00004",
    "Belanja Bahan-Bahan Bakar dan Pelumas",
    1,
    "Paket/Kegiatan",
    1000000,
    1000000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Kendaraan Operasional Penanganan dan penaggulangan KLB/wabah Penyakit Menular",
    "Belanja Bahan-Bahan Bakar dan Pelumas Kendaraan Operasional Penanganan dan penaggulangan KLB/wabah Penyakit Menular",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0037 Pelaksanaan Kewaspadaan Dini dan Respon Wabah.pdf"
  ],
  [
    "DPA-102022020037-51020200100003-002",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pelaksanaan Kewaspadaan Dini dan Respon Wabah",
    "1.02.02.2.02.0037",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    1,
    "Paket/Kegiatan",
    3600000,
    3600000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Workshop Sistem Kewaspadaan Dini dan Respon (SKDR)",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Workshop Sistem Kewaspadaan Dini dan Respon (SKDR)",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0037 Pelaksanaan Kewaspadaan Dini dan Respon Wabah.pdf"
  ],
  [
    "DPA-102022020037-51020400100001-003",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pelaksanaan Kewaspadaan Dini dan Respon Wabah",
    "1.02.02.2.02.0037",
    "5.1.02.04.001.00001",
    "Belanja Perjalanan Dinas Biasa",
    1,
    "Paket/Kegiatan",
    4830000,
    4830000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Investigasi kasus yang dilakukan Penyelidikan Epidemiologi (PE) di RS Luar Kota Depok",
    "Belanja Perjalanan Dinas Biasa Investigasi kasus yang dilakukan Penyelidikan Epidemiologi (PE) di RS Luar Kota Depok",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0037 Pelaksanaan Kewaspadaan Dini dan Respon Wabah.pdf"
  ],
  [
    "DPA-102022020037-51020400100003-004",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pelaksanaan Kewaspadaan Dini dan Respon Wabah",
    "1.02.02.2.02.0037",
    "5.1.02.04.001.00003",
    "Belanja Perjalanan Dinas Dalam Kota",
    1,
    "Paket/Kegiatan",
    9000000,
    9000000,
    "Pendapatan Bagi Hasil Pajak Rokok",
    2026,
    "Aktif",
    "Investigasi kasus yang dilakukan Penyelidikan Epidemiologi (PE) di Kota Depok",
    "Belanja Perjalanan Dinas Dalam Kota Investigasi kasus yang dilakukan Penyelidikan Epidemiologi (PE) di Kota Depok",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0037 Pelaksanaan Kewaspadaan Dini dan Respon Wabah.pdf"
  ],
  [
    "DPA-102022020048-51020100100027-001",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Layanan Imunisasi",
    "1.02.02.2.02.0048",
    "5.1.02.01.001.00027",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Benda Pos",
    1,
    "Paket/Kegiatan",
    260000,
    260000,
    "PENDAPATAN ASLI DAERAH (PAD)",
    2026,
    "Aktif",
    "Buku Cek",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Benda Pos Buku Cek",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0048 Pengelolaan Layanan Imunisasi.pdf"
  ],
  [
    "DPA-102022020048-51020100100027-002",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Layanan Imunisasi",
    "1.02.02.2.02.0048",
    "5.1.02.01.001.00027",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Benda Pos",
    1,
    "Paket/Kegiatan",
    110000,
    110000,
    "PENDAPATAN ASLI DAERAH (PAD)",
    2026,
    "Aktif",
    "Materai",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Benda Pos Materai",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0048 Pengelolaan Layanan Imunisasi.pdf"
  ],
  [
    "DPA-102022020048-51020100100052-003",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Layanan Imunisasi",
    "1.02.02.2.02.0048",
    "5.1.02.01.001.00052",
    "Belanja Makanan dan Minuman Rapat",
    1,
    "Paket/Kegiatan",
    7400000,
    7400000,
    "PENDAPATAN ASLI DAERAH (PAD)",
    2026,
    "Aktif",
    "Rapat Evaluasi Pengelola Program bagi Petugas Imunisasi di Puskesmas",
    "Belanja Makanan dan Minuman Rapat Evaluasi Pengelola Program bagi Petugas Imunisasi di Puskesmas",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0048 Pengelolaan Layanan Imunisasi.pdf"
  ],
  [
    "DPA-102022020048-51020100100052-004",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Layanan Imunisasi",
    "1.02.02.2.02.0048",
    "5.1.02.01.001.00052",
    "Belanja Makanan dan Minuman Rapat",
    1,
    "Paket/Kegiatan",
    18315000,
    18315000,
    "PENDAPATAN ASLI DAERAH (PAD)",
    2026,
    "Aktif",
    "Sosialisasi Managemen Imunisasi ke Bidan di Kota Depok (per Ranting)",
    "Belanja Makanan dan Minuman Rapat Sosialisasi Managemen Imunisasi ke Bidan di Kota Depok (per Ranting)",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0048 Pengelolaan Layanan Imunisasi.pdf"
  ],
  [
    "DPA-102022020048-51020200100003-005",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Layanan Imunisasi",
    "1.02.02.2.02.0048",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    1,
    "Paket/Kegiatan",
    7200000,
    7200000,
    "PENDAPATAN ASLI DAERAH (PAD)",
    2026,
    "Aktif",
    "Seminar Imunisasi bagi Masyarakat",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Seminar Imunisasi bagi Masyarakat",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0048 Pengelolaan Layanan Imunisasi.pdf"
  ],
  [
    "DPA-102022020048-51020200100003-006",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Layanan Imunisasi",
    "1.02.02.2.02.0048",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    1,
    "Paket/Kegiatan",
    1800000,
    1800000,
    "PENDAPATAN ASLI DAERAH (PAD)",
    2026,
    "Aktif",
    "Sosialisasi Managemen Vaksin bagi Petugas Farmasi di Puskesmas dan RS",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Sosialisasi Managemen Vaksin bagi Petugas Farmasi di Puskesmas dan RS",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0048 Pengelolaan Layanan Imunisasi.pdf"
  ],
  [
    "DPA-102022020048-51020200100003-007",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Layanan Imunisasi",
    "1.02.02.2.02.0048",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    1,
    "Paket/Kegiatan",
    1800000,
    1800000,
    "PENDAPATAN ASLI DAERAH (PAD)",
    2026,
    "Aktif",
    "Sosialisasi Pelaksanaan Imunisasi untuk Guru Sekolah",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Sosialisasi Pelaksanaan Imunisasi untuk Guru Sekolah",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0048 Pengelolaan Layanan Imunisasi.pdf"
  ],
  [
    "DPA-102022020048-51020200100011-008",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Layanan Imunisasi",
    "1.02.02.2.02.0048",
    "5.1.02.02.001.00011",
    "Honorarium Penyelenggaraan Kegiatan Pendidikan dan Pelatihan",
    1,
    "Paket/Kegiatan",
    3300000,
    3300000,
    "PENDAPATAN ASLI DAERAH (PAD)",
    2026,
    "Aktif",
    "Sosialisasi Managemen Imunisasi ke Bidan di Kota Depok (per Ranting)",
    "Honorarium Penyelenggaraan Kegiatan Pendidikan dan Pelatihan 'Sosialisasi Managemen Imunisasi ke Bidan di kota Depok ( per Ranting)",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0048 Pengelolaan Layanan Imunisasi.pdf"
  ],
  [
    "DPA-102022020048-51020400100003-009",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Layanan Imunisasi",
    "1.02.02.2.02.0048",
    "5.1.02.04.001.00003",
    "Belanja Perjalanan Dinas Dalam Kota",
    1,
    "Paket/Kegiatan",
    3300000,
    3300000,
    "PENDAPATAN ASLI DAERAH (PAD)",
    2026,
    "Aktif",
    "Pendampingan Petugas Dalam Kegiatan Sosialisasi Managemen Imunisasi ke Bidan di Kota Depok",
    "Belanja Perjalanan Dinas Dalam Kota Pendampingan Petugas Dalam Kegiatan Sosialisasi Managemen Imunisasi ke Bidan di Kota Depok",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0048 Pengelolaan Layanan Imunisasi.pdf"
  ],
  [
    "DPA-102022020048-51020400100003-010",
    "1.02.0.00.0.00.01.0000",
    "DINAS KESEHATAN",
    "1.02.02",
    "Pengelolaan Layanan Imunisasi",
    "1.02.02.2.02.0048",
    "5.1.02.04.001.00003",
    "Belanja Perjalanan Dinas Dalam Kota",
    1,
    "Paket/Kegiatan",
    6300000,
    6300000,
    "PENDAPATAN ASLI DAERAH (PAD)",
    2026,
    "Aktif",
    "Rapid Convenience Assesment Tingkat Kelurahan",
    "Belanja Perjalanan Dinas Dalam Kota Rapid Convenience Assesment Tingkat Kelurahan",
    "DETAIL_KEGIATAN",
    "Sistem Informasi Pemerintahan Daerah - Cetak RKA Rincian Belanja 1.02.02.2.02.0048 Pengelolaan Layanan Imunisasi.pdf"
  ]
];
}

function getReviewedAngkasImportRows_() {
  return [
  [
    "AK-102022020020-51020100100027-001",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.01.001.00027",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Benda Pos",
    320000,
    0,
    0,
    0,
    320000,
    320000,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Belanja Alat/Bahan untuk Kegiatan Kantor - Benda Pos",
    "Belanja Alat/Bahan untuk Kegiatan Kantor - Benda Pos",
    320000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020100100052-001",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.01.001.00052",
    "Belanja Makanan dan Minuman Rapat",
    0,
    0,
    0,
    1250000,
    1250000,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1250000,
    0,
    0,
    2026,
    "Workshop Pemantapan Petugas Sistem Komputerisasi Haji Terpadu Bidang Kesehatan",
    "Belanja Makanan dan Minuman Rapat Workshop Pemantapan Petugas Sistem Komputerisasi Haji Terpadu Bidang Kesehatan",
    1850000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020200100003-001",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    0,
    900000,
    0,
    900000,
    1800000,
    0,
    0,
    0,
    0,
    0,
    900000,
    0,
    0,
    0,
    900000,
    0,
    0,
    2026,
    "Evaluasi Penyelenggaraan Surveilans Penyakit bagi Petugas Puskesmas dan RS",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Evaluasi Penyelenggaraan Surveilans Penyakit bagi Petugas Puskesmas dan RS",
    3600000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020200100003-002",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    0,
    900000,
    0,
    900000,
    1800000,
    0,
    0,
    0,
    0,
    0,
    900000,
    0,
    0,
    0,
    900000,
    0,
    0,
    2026,
    "Workshop Pemantapan Petugas Sistem Komputerisasi Haji Terpadu Bidang Kesehatan",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Workshop pemantapan petugas Sistem Komputerisasi Haji Terpadu Bidang Kesehatan",
    3600000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020200100014-001",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.02.001.00014",
    "Belanja Jasa Tenaga Kesehatan",
    26550000,
    35400000,
    26550000,
    26550000,
    115050000,
    8850000,
    8850000,
    8850000,
    17700000,
    8850000,
    8850000,
    8850000,
    8850000,
    8850000,
    8850000,
    8850000,
    8850000,
    2026,
    "PJLP Layanan Kesehatan Surveilans",
    "Apresiasi Upah PJLP Layanan Kesehatan Epidemiolog Kesehatan",
    115050000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020200100080-001",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.02.001.00080",
    "Belanja Honorarium Penanggungjawaban Pengelola Keuangan",
    4230000,
    4230000,
    4230000,
    4230000,
    16920000,
    1410000,
    1410000,
    1410000,
    1410000,
    1410000,
    1410000,
    1410000,
    1410000,
    1410000,
    1410000,
    1410000,
    1410000,
    2026,
    "Honorarium Pejabat Pelaksana Teknis Kegiatan (PPTK)",
    "Belanja Honorarium Penanggungjawaban Pengelola Keuangan Honorarium Pejabat Pelaksana Teknis Kegiatan (PPTK)",
    16920000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020200100085-001",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.02.001.00085",
    "Belanja jasa Pegawai Pemerintah dengan Perjanjian Kerja (PPPK) Paruh Waktu pada jabatan tenaga kesehatan",
    17700000,
    13275000,
    13275000,
    13275000,
    57525000,
    4425000,
    4425000,
    8850000,
    4425000,
    4425000,
    4425000,
    4425000,
    4425000,
    4425000,
    4425000,
    4425000,
    4425000,
    2026,
    "PPPK Paruh Waktu pada Jabatan Epidemiolog Kesehatan Ahli Pertama",
    "PPPK Paruh Waktu pada Jabatan Epidemiolog Kesehatan Ahli Pertama",
    57525000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020200100085-002",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.02.001.00085",
    "Belanja jasa Pegawai Pemerintah dengan Perjanjian Kerja (PPPK) Paruh Waktu pada jabatan tenaga kesehatan",
    15340000,
    11505000,
    11505000,
    11505000,
    49855000,
    3835000,
    3835000,
    7670000,
    3835000,
    3835000,
    3835000,
    3835000,
    3835000,
    3835000,
    3835000,
    3835000,
    3835000,
    2026,
    "PPPK Paruh Waktu pada Jabatan Tenaga Kesehatan",
    "PPPK Paruh Waktu pada Jabatan Tenaga Kesehatan",
    49855000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020200200005-001",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.02.002.00005",
    "Belanja Iuran Jaminan Kesehatan bagi Non ASN",
    1374000,
    1374000,
    1374000,
    1378000,
    5500000,
    458000,
    458000,
    458000,
    458000,
    458000,
    458000,
    458000,
    458000,
    458000,
    458000,
    458000,
    462000,
    2026,
    "Iuran BPJS Kesehatan",
    "Belanja Iuran Jaminan Kesehatan bagi Non ASN Iuran Jaminan Kesehatan bagi Non ASN",
    5500000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020200200006-001",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.02.002.00006",
    "Belanja Iuran Jaminan Kecelakaan Kerja bagi Non ASN",
    1200000,
    1200000,
    1200000,
    1200000,
    4800000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    2026,
    "Iuran BPJS Ketenagakerjaan",
    "Belanja Iuran Jaminan Kecelakaan Kerja bagi Non ASN Iuran BPJS Ketenagakerjaan",
    4800000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020200200016-001",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.02.002.00016",
    "Belanja Iuran Jaminan Kesehatan bagi PPPK Paruh Waktu pada Jabatan Tenaga Kesehatan",
    687000,
    687000,
    687000,
    689000,
    2750000,
    229000,
    229000,
    229000,
    229000,
    229000,
    229000,
    229000,
    229000,
    229000,
    229000,
    229000,
    231000,
    2026,
    "Iuran Jaminan Kesehatan bagi PPPK Paruh Waktu",
    "Iuran Jaminan Kesehatan PPPK Paruh Waktu",
    2750000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020200200024-001",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.02.002.00024",
    "Belanja Iuran Jaminan Kecelakaan Kerja bagi PPPK Paruh Waktu pada Jabatan Tenaga Kesehatan",
    1200000,
    1200000,
    1200000,
    1200000,
    4800000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    2026,
    "Iuran Jaminan Kecelakaan Kerja bagi PPPK Paruh Waktu pada Jabatan Tenaga Kesehatan",
    "Iuran Jaminan Kecelakaan Kerja bagi PPPK Paruh Waktu pada Jabatan Tenaga Kesehatan",
    4800000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020400100001-001",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.04.001.00001",
    "Belanja Perjalanan Dinas Biasa",
    626170,
    5600000,
    4973830,
    0,
    11200000,
    0,
    626170,
    0,
    626170,
    4973830,
    0,
    4973830,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Pelayanan Haji di Debarkasi",
    "Belanja Perjalanan Dinas Biasa Pelayanan Haji di Debarkasi",
    11200000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020400100001-002",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.04.001.00001",
    "Belanja Perjalanan Dinas Biasa",
    626170,
    5600000,
    4973830,
    0,
    11200000,
    0,
    626170,
    0,
    626170,
    4973830,
    0,
    4973830,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Pelayanan Haji di Embarkasi",
    "Belanja Perjalanan Dinas Biasa Pelayanan Haji di Embarkasi",
    11200000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020020-51020400100001-003",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "5.1.02.04.001.00001",
    "Belanja Perjalanan Dinas Biasa",
    157660,
    1410000,
    1252340,
    0,
    2820000,
    0,
    157660,
    0,
    157660,
    1252340,
    0,
    1252340,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Pengambilan Sarana Prasarana Kesehatan Jemaah Haji",
    "Belanja Perjalanan Dinas Biasa Pengambilan Sarana Prasarana Kesehatan Jemaah Haji",
    2820000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Surveilans.pdf"
  ],
  [
    "AK-102022020028-51020100100012-001",
    "1.02.02.2.02.0028",
    "Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional",
    "5.1.02.01.001.00012",
    "Belanja Bahan-Bahan Lainnya",
    0,
    41400000,
    0,
    41400000,
    82800000,
    0,
    0,
    0,
    0,
    0,
    41400000,
    0,
    0,
    0,
    0,
    41400000,
    0,
    2026,
    "BMHP pengemasan spesimen DNA HPV",
    "BMHP pengemasan spesimen DNA HPV (DAK Non Fisik)",
    82800000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Spesimen.pdf"
  ],
  [
    "AK-102022020028-51020100100024-001",
    "1.02.02.2.02.0028",
    "Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional",
    "5.1.02.01.001.00024",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor",
    358000,
    0,
    0,
    0,
    358000,
    0,
    358000,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor",
    358000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Spesimen.pdf"
  ],
  [
    "AK-102022020028-51020200100015-001",
    "1.02.02.2.02.0028",
    "Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional",
    "5.1.02.02.001.00015",
    "Belanja Jasa Tenaga Laboratorium",
    144000000,
    216000000,
    216000000,
    144000000,
    720000000,
    0,
    0,
    144000000,
    72000000,
    72000000,
    72000000,
    72000000,
    72000000,
    72000000,
    72000000,
    72000000,
    0,
    2026,
    "Jasa Pemeriksaan spesimen DNA HPV",
    "Jasa Pemeriksaan spesimen DNA HPV",
    720000000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Spesimen.pdf"
  ],
  [
    "AK-102022020028-51020200100064-001",
    "1.02.02.2.02.0028",
    "Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional",
    "5.1.02.02.001.00064",
    "Belanja Paket/Pengiriman",
    695122,
    2548780,
    3128049,
    3128049,
    9500000,
    0,
    0,
    695122,
    695122,
    926829,
    926829,
    1042683,
    1042683,
    1042683,
    1042683,
    1042683,
    1042683,
    2026,
    "Biaya Jasa Pengiriman Spesimen Kasus Potensial KLB ke Bandung Jawa Barat",
    "Belanja Paket/Pengiriman Biaya Jasa Pengiriman Spesimen Kasus Potensial KLB ke Bandung Jawa Barat",
    9500000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Spesimen.pdf"
  ],
  [
    "AK-102022020028-51020200100064-002",
    "1.02.02.2.02.0028",
    "Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional",
    "5.1.02.02.001.00064",
    "Belanja Paket/Pengiriman",
    804878,
    2951220,
    3621951,
    3621951,
    11000000,
    0,
    0,
    804878,
    804878,
    1073171,
    1073171,
    1207317,
    1207317,
    1207317,
    1207317,
    1207317,
    1207317,
    2026,
    "Biaya Jasa Pengiriman Spesimen Kasus Potensial KLB ke Jakarta",
    "Belanja Paket/Pengiriman Biaya Jasa Pengiriman Spesimen Kasus Potensial KLB ke Jakarta",
    11000000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Spesimen.pdf"
  ],
  [
    "AK-102022020028-51020400100003-001",
    "1.02.02.2.02.0028",
    "Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional",
    "5.1.02.04.001.00003",
    "Belanja Perjalanan Dinas Dalam Kota",
    18000000,
    27000000,
    27000000,
    18000000,
    90000000,
    0,
    0,
    18000000,
    9000000,
    9000000,
    9000000,
    9000000,
    9000000,
    9000000,
    9000000,
    9000000,
    0,
    2026,
    "Biaya Jasa Pengiriman spesimen DNA HPV",
    "Transport Petugas Puskesmas Pengiriman Spesimen DNA HPV (DAK Non Fisik)",
    90000000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Spesimen.pdf"
  ],
  [
    "AK-102022020036-51020200100003-001",
    "1.02.02.2.02.0036",
    "Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal)",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Rapat Koordinasi Audit Kasus KIPI",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Rapat Koordinasi Audit Kasus KIPI",
    1800000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_KIPI.pdf"
  ],
  [
    "AK-102022020036-51020200100004-001",
    "1.02.02.2.02.0036",
    "Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal)",
    "5.1.02.02.001.00004",
    "Honorarium Tim Pelaksana Kegiatan dan Sekretariat Tim Pelaksana Kegiatan",
    0,
    0,
    0,
    15500000,
    15500000,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    7750000,
    7750000,
    0,
    2026,
    "Honorarium Tim Pokja Kejadian Ikutan Paska Imunisasi (KIPI)",
    "Honorarium Tim Pelaksana Kegiatan dan Sekretariat Tim Pelaksana Kegiatan Honorarium Tim Pokja Kejadian Ikutan Paska Imunisasi (KIPI)",
    23250000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_KIPI.pdf"
  ],
  [
    "AK-102022020036-51020400100003-001",
    "1.02.02.2.02.0036",
    "Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal)",
    "5.1.02.04.001.00003",
    "Belanja Perjalanan Dinas Dalam Kota",
    0,
    1200000,
    1200000,
    800000,
    3200000,
    0,
    0,
    0,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    400000,
    0,
    2026,
    "Audit kasus KIPI",
    "Belanja Perjalanan Dinas Dalam Kota Audit kasus KIPI",
    3200000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_KIPI.pdf"
  ],
  [
    "AK-102022020037-51020100100004-001",
    "1.02.02.2.02.0037",
    "Pelaksanaan Kewaspadaan Dini dan Respon Wabah",
    "5.1.02.01.001.00004",
    "Belanja Bahan-Bahan Bakar dan Pelumas",
    0,
    0,
    500000,
    500000,
    1000000,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    250000,
    250000,
    250000,
    250000,
    0,
    2026,
    "Kendaraan Operasional Penanganan dan penaggulangan KLB/wabah Penyakit Menular",
    "Belanja Bahan-Bahan Bakar dan Pelumas Kendaraan Operasional Penanganan dan penaggulangan KLB/wabah Penyakit Menular",
    1000000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Kewaspadaan.pdf"
  ],
  [
    "AK-102022020037-51020200100003-001",
    "1.02.02.2.02.0037",
    "Pelaksanaan Kewaspadaan Dini dan Respon Wabah",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    1800000,
    0,
    0,
    0,
    1800000,
    0,
    1800000,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Workshop Sistem Kewaspadaan Dini dan Respon (SKDR)",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Workshop Sistem Kewaspadaan Dini dan Respon (SKDR)",
    3600000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Kewaspadaan.pdf"
  ],
  [
    "AK-102022020037-51020400100001-001",
    "1.02.02.2.02.0037",
    "Pelaksanaan Kewaspadaan Dini dan Respon Wabah",
    "5.1.02.04.001.00001",
    "Belanja Perjalanan Dinas Biasa",
    0,
    1610000,
    1610000,
    1610000,
    4830000,
    0,
    0,
    0,
    0,
    1610000,
    0,
    1610000,
    0,
    0,
    1610000,
    0,
    0,
    2026,
    "Investigasi kasus yang dilakukan Penyelidikan Epidemiologi (PE) di RS Luar Kota Depok",
    "Belanja Perjalanan Dinas Biasa Investigasi kasus yang dilakukan Penyelidikan Epidemiologi (PE) di RS Luar Kota Depok",
    4830000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Kewaspadaan.pdf"
  ],
  [
    "AK-102022020037-51020400100003-001",
    "1.02.02.2.02.0037",
    "Pelaksanaan Kewaspadaan Dini dan Respon Wabah",
    "5.1.02.04.001.00003",
    "Belanja Perjalanan Dinas Dalam Kota",
    1500000,
    3000000,
    1500000,
    3000000,
    9000000,
    0,
    1500000,
    0,
    1500000,
    0,
    1500000,
    0,
    1500000,
    0,
    1500000,
    1500000,
    0,
    2026,
    "Investigasi kasus yang dilakukan Penyelidikan Epidemiologi (PE) di Kota Depok",
    "Belanja Perjalanan Dinas Dalam Kota Investigasi kasus yang dilakukan Penyelidikan Epidemiologi (PE) di Kota Depok",
    9000000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Kewaspadaan.pdf"
  ],
  [
    "AK-102022020048-51020100100027-001",
    "1.02.02.2.02.0048",
    "Pengelolaan Layanan Imunisasi",
    "5.1.02.01.001.00027",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Benda Pos",
    260000,
    0,
    0,
    0,
    260000,
    260000,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Buku Cek",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Benda Pos Buku Cek",
    260000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Imunisasi.pdf"
  ],
  [
    "AK-102022020048-51020100100027-002",
    "1.02.02.2.02.0048",
    "Pengelolaan Layanan Imunisasi",
    "5.1.02.01.001.00027",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Benda Pos",
    110000,
    0,
    0,
    0,
    110000,
    110000,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Materai",
    "Belanja Alat/Bahan untuk Kegiatan Kantor-Benda Pos Materai",
    110000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Imunisasi.pdf"
  ],
  [
    "AK-102022020048-51020100100052-001",
    "1.02.02.2.02.0048",
    "Pengelolaan Layanan Imunisasi",
    "5.1.02.01.001.00052",
    "Belanja Makanan dan Minuman Rapat",
    5112230,
    1050359,
    187050,
    359712,
    6709351,
    0,
    5112230,
    0,
    690647,
    359712,
    0,
    187050,
    0,
    0,
    359712,
    0,
    0,
    2026,
    "Rapat Evaluasi Pengelola Program bagi Petugas Imunisasi di Puskesmas",
    "Belanja Makanan dan Minuman Rapat Evaluasi Pengelola Program bagi Petugas Imunisasi di Puskesmas",
    7400000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Imunisasi.pdf"
  ],
  [
    "AK-102022020048-51020100100052-002",
    "1.02.02.2.02.0048",
    "Pengelolaan Layanan Imunisasi",
    "5.1.02.01.001.00052",
    "Belanja Makanan dan Minuman Rapat",
    12652770,
    2599641,
    462950,
    890288,
    16605649,
    0,
    12652770,
    0,
    1709353,
    890288,
    0,
    462950,
    0,
    0,
    890288,
    0,
    0,
    2026,
    "Sosialisasi Managemen Imunisasi ke Bidan di Kota Depok (per Ranting)",
    "Belanja Makanan dan Minuman Rapat Sosialisasi Managemen Imunisasi ke Bidan di Kota Depok (per Ranting)",
    18315000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Imunisasi.pdf"
  ],
  [
    "AK-102022020048-51020200100003-001",
    "1.02.02.2.02.0048",
    "Pengelolaan Layanan Imunisasi",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Seminar Imunisasi bagi Masyarakat",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Seminar Imunisasi bagi Masyarakat",
    7200000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Imunisasi.pdf"
  ],
  [
    "AK-102022020048-51020200100003-002",
    "1.02.02.2.02.0048",
    "Pengelolaan Layanan Imunisasi",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Sosialisasi Managemen Vaksin bagi Petugas Farmasi di Puskesmas dan RS",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Sosialisasi Managemen Vaksin bagi Petugas Farmasi di Puskesmas dan RS",
    1800000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Imunisasi.pdf"
  ],
  [
    "AK-102022020048-51020200100003-003",
    "1.02.02.2.02.0048",
    "Pengelolaan Layanan Imunisasi",
    "5.1.02.02.001.00003",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia",
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Sosialisasi Pelaksanaan Imunisasi untuk Guru Sekolah",
    "Honorarium Narasumber atau Pembahas, Moderator, Pembawa Acara, dan Panitia Sosialisasi Pelaksanaan Imunisasi untuk Guru Sekolah",
    1800000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Imunisasi.pdf"
  ],
  [
    "AK-102022020048-51020200100011-001",
    "1.02.02.2.02.0048",
    "Pengelolaan Layanan Imunisasi",
    "5.1.02.02.001.00011",
    "Honorarium Penyelenggaraan Kegiatan Pendidikan dan Pelatihan",
    3300000,
    0,
    0,
    0,
    3300000,
    0,
    3300000,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Sosialisasi Managemen Imunisasi ke Bidan di Kota Depok (per Ranting)",
    "Honorarium Penyelenggaraan Kegiatan Pendidikan dan Pelatihan 'Sosialisasi Managemen Imunisasi ke Bidan di kota Depok ( per Ranting)",
    3300000,
    "RAK rekening sesuai satu detail_kegiatan",
    "Angkas_Imunisasi.pdf"
  ],
  [
    "AK-102022020048-51020400100003-001",
    "1.02.02.2.02.0048",
    "Pengelolaan Layanan Imunisasi",
    "5.1.02.04.001.00003",
    "Belanja Perjalanan Dinas Dalam Kota",
    3300000,
    0,
    0,
    0,
    3300000,
    0,
    3300000,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Pendampingan Petugas Dalam Kegiatan Sosialisasi Managemen Imunisasi ke Bidan di Kota Depok",
    "Belanja Perjalanan Dinas Dalam Kota Pendampingan Petugas Dalam Kegiatan Sosialisasi Managemen Imunisasi ke Bidan di Kota Depok",
    3300000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Imunisasi.pdf"
  ],
  [
    "AK-102022020048-51020400100003-002",
    "1.02.02.2.02.0048",
    "Pengelolaan Layanan Imunisasi",
    "5.1.02.04.001.00003",
    "Belanja Perjalanan Dinas Dalam Kota",
    6300000,
    0,
    0,
    0,
    6300000,
    0,
    6300000,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2026,
    "Rapid Convenience Assesment Tingkat Kelurahan",
    "Belanja Perjalanan Dinas Dalam Kota Rapid Convenience Assesment Tingkat Kelurahan",
    6300000,
    "RAK rekening dialokasikan proporsional ke detail_kegiatan berdasarkan pagu DPA per rekening",
    "Angkas_Imunisasi.pdf"
  ]
];
}

function getReviewedIndikatorImportRows_() {
  return [
  [
    "IND-1.02.02.2.02.0020",
    "1.02.02.2.02.0020",
    "Pengelolaan Surveilans Kesehatan",
    "Jumlah Dokumen Hasil Pengelolaan Surveilans Kesehatan",
    "4 Dokumen",
    "Jumlah Dokumen Hasil Pengelolaan Surveilans Kesehatan",
    2026
  ],
  [
    "IND-1.02.02.2.02.0028",
    "1.02.02.2.02.0028",
    "Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional",
    "Jumlah Spesimen Penyakit Potensial Kejadian Luar Biasa (KLB) ke Laboratorium Rujukan/Nasional yang Didistribusikan",
    "982 Paket",
    "Jumlah Spesimen Penyakit Potensial Kejadian Luar Biasa (KLB) ke Laboratorium Rujukan/Nasional yang Didistribusikan",
    2026
  ],
  [
    "IND-1.02.02.2.02.0036",
    "1.02.02.2.02.0036",
    "Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal)",
    "Jumlah Laporan Hasil Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal)",
    "2 Laporan",
    "Jumlah Laporan Hasil Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal)",
    2026
  ],
  [
    "IND-1.02.02.2.02.0037",
    "1.02.02.2.02.0037",
    "Pelaksanaan Kewaspadaan Dini dan Respon Wabah",
    "Jumlah Dokumen Hasil Pelaksanaan Kewaspadaan Dini dan Respon Wabah",
    "2 Dokumen",
    "Jumlah Dokumen Hasil Pelaksanaan Kewaspadaan Dini dan Respon Wabah",
    2026
  ],
  [
    "IND-1.02.02.2.02.0048",
    "1.02.02.2.02.0048",
    "Pengelolaan Layanan Imunisasi",
    "Jumlah Dokumen Hasil Pengelolaan Layanan Imunisasi",
    "6 Dokumen",
    "Jumlah Dokumen Hasil Pengelolaan Layanan Imunisasi",
    2026
  ]
];
}

function importDPA() {
  const sheet = ensureSheetHeaders_(APP.SHEETS.MASTER_DPA, SHEET_HEADERS.MASTER_DPA);
  const indikatorSheet = ensureSheetHeaders_(APP.SHEETS.MASTER_INDIKATOR, SHEET_HEADERS.MASTER_INDIKATOR);
  const rows = getReviewedDpaImportRows_();
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);

  const indikatorRows = getReviewedIndikatorImportRows_();
  if (indikatorSheet.getLastRow() > 1) indikatorSheet.getRange(2, 1, indikatorSheet.getLastRow() - 1, indikatorSheet.getLastColumn()).clearContent();
  indikatorSheet.getRange(2, 1, indikatorRows.length, indikatorRows[0].length).setValues(indikatorRows);

  clearRfkCache_();
  return 'DPA detail berhasil diimport dari file RFK_2026_4: ' + rows.length + ' baris rincian kegiatan. Indikator: ' + indikatorRows.length + ' baris.';
}

function getDefaultAngkasData_() {
  return [
    {
      kode: '1.02.02.2.02.0020',
      nama: 'Pengelolaan Surveilans Kesehatan',
      bulanan: [20327000, 21417000, 28267000, 30267000, 31207000, 21807000, 31207000, 20007000, 20007000, 20007000, 20007000, 23063000]
    },
    {
      kode: '1.02.02.2.02.0028',
      nama: 'Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional',
      bulanan: [0, 358000, 163500000, 82500000, 83000000, 124400000, 83250000, 83250000, 83250000, 70050000, 70050000, 70050000]
    },
    {
      kode: '1.02.02.2.02.0036',
      nama: 'Investigasi Awal Kejadian Tidak Diharapkan (KIPI)',
      bulanan: [0, 0, 0, 400000, 400000, 400000, 400000, 400000, 400000, 8150000, 8150000, 0]
    },
    {
      kode: '1.02.02.2.02.0037',
      nama: 'Pelaksanaan Kewaspadaan Dini dan Respon Wabah',
      bulanan: [0, 3300000, 0, 1500000, 1610000, 1500000, 1610000, 1750000, 250000, 3360000, 1750000, 0]
    },
    {
      kode: '1.02.02.2.02.0048',
      nama: 'Pengelolaan Layanan Imunisasi',
      bulanan: [370000, 30665000, 0, 2400000, 1250000, 0, 650000, 0, 0, 1250000, 0, 0]
    }
  ];
}

function importAnggaranKas() {
  const sheet = ensureSheetHeaders_(APP.SHEETS.MASTER_ANGGARAN_KAS, SHEET_HEADERS.MASTER_ANGGARAN_KAS);
  const rows = getReviewedAngkasImportRows_();
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  clearRfkCache_();
  return 'Anggaran Kas detail berhasil diimport dari file RFK_2026_4: ' + rows.length + ' baris rincian kegiatan.';
}

function importSemuaData() {
  const results = [];
  results.push(setupAllSheets());
  results.push(importSumberDana());
  results.push(importDPA());
  results.push(importAnggaranKas());
  return results.join('\n');
}

/***************************************************************************
 * Export monitoring
 ***************************************************************************/
function exportMonitoringRFK(sessionToken) {
  if (sessionToken) requireSession_(sessionToken, APP.MUTATION_ROLES);
  return generateMonitoringRFK();
}

function generateMonitoringRFK() {
  const ss = ss_();
  const sheet = ss.getSheetByName(APP.SHEETS.MONITORING_RFK) || ss.insertSheet(APP.SHEETS.MONITORING_RFK);
  sheet.clear();

  const headers = [
    'KODE SUB KEGIATAN', 'NAMA SUB KEGIATAN', 'TOTAL PAGU', 'SUMBER DANA',
    'ANGGARAN KAS', 'REALISASI VALID', 'SISA KAS', 'SISA PAGU',
    '% SERAPAN KAS', '% SERAPAN PAGU', 'STATUS BASIS REALISASI',
    'INDIKATOR KINERJA', 'TARGET KINERJA', 'KENDALA AKTIF', 'CATATAN'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1e3a8a')
    .setFontColor('white');
  sheet.setFrozenRows(1);

  const monitoring = getMonitoringRFKData_uncached_();
  const validasiMap = {};
  getValidasiAngkas_uncached_().forEach(function(v) { validasiMap[v.kode] = v; });
  const rows = monitoring.map(function(item) {
    const kendalaAktif = (item.kendala || []).filter(function(k) {
      return safeString_(k.status).toLowerCase() !== 'selesai';
    }).map(function(k) { return k.bulan + ': ' + k.permasalahan; }).join('; ');
    const validasi = validasiMap[item.kode] || {};
    return [
      item.kode,
      item.nama,
      item.pagu,
      item.sumberDana,
      item.angkasTotal,
      item.realisasiTotal,
      item.sisaTotal,
      item.sisaPagu,
      item.angkasTotal > 0 ? item.realisasiTotal / item.angkasTotal : 0,
      item.pagu > 0 ? item.realisasiTotal / item.pagu : 0,
      item.realisasiBasisStatus,
      item.indikator,
      item.targetIndikator,
      kendalaAktif || '-',
      validasi.catatan || ''
    ];
  });

  if (rows.length) sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  if (rows.length) {
    sheet.getRange(2, 3, rows.length, 5).setNumberFormat('#,##0');
    sheet.getRange(2, 8, rows.length, 1).setNumberFormat('#,##0');
    sheet.getRange(2, 9, rows.length, 2).setNumberFormat('0.00%');
  }
  sheet.autoResizeColumns(1, headers.length);
  return 'âœ… MONITORING_RFK berhasil di-generate: ' + rows.length + ' sub-kegiatan. Realisasi memakai status: ' + APP.REALISASI_VALID_STATUSES.join(', ') + '.';
}
