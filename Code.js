/***************************************************************************
 * RFK MONITORING - NEW BACKEND FUNCTIONS
 ***************************************************************************/

/**
 * Helper: get sheet data as array of objects
 */
function getSheetData_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

/**
 * Helper: get raw sheet data
 */
function getRawSheet_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { headers: [], rows: [] };
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return { headers: [], rows: [] };
  return { headers: data[0], rows: data.slice(1) };
}

/**
 * Dashboard stats
 */
function getDashboardStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dpaSheet = ss.getSheetByName('MASTER_DPA');
  const angkasSheet = ss.getSheetByName('MASTER_ANGGARAN_KAS');
  const spjSheet = ss.getSheetByName('SPJ_HEADER');
  
  let totalPagu = 0;
  let totalAngkas = 0;
  let totalRealisasi = 0;
  let jumlahSubKegiatan = 0;
  
  if (dpaSheet && dpaSheet.getLastRow() > 1) {
    const dpaData = dpaSheet.getDataRange().getValues();
    jumlahSubKegiatan = dpaData.length - 1;
    for (let i = 1; i < dpaData.length; i++) {
      totalPagu += Number(dpaData[i][11] || 0);
    }
  }
  
  if (angkasSheet && angkasSheet.getLastRow() > 1) {
    const akData = angkasSheet.getDataRange().getValues();
    for (let i = 1; i < akData.length; i++) {
      totalAngkas += Number(akData[i][7] || 0);
    }
  }
  
  const detailSheet = ss.getSheetByName('SPJ_DETAIL');
  if (detailSheet && detailSheet.getLastRow() > 1) {
    const dtData = detailSheet.getDataRange().getValues();
    for (let i = 1; i < dtData.length; i++) {
      totalRealisasi += Number(dtData[i][11] || 0);
    }
  }
  
  let jumlahSPJ = 0;
  let spjPerStatus = { Draft: 0, Diajukan: 0, Diverifikasi: 0, Dibayar: 0 };
  
  if (spjSheet && spjSheet.getLastRow() > 1) {
    const spjData = spjSheet.getDataRange().getValues();
    jumlahSPJ = spjData.length - 1;
    for (let i = 1; i < spjData.length; i++) {
      const status = String(spjData[i][9] || 'Draft');
      if (spjPerStatus[status] !== undefined) {
        spjPerStatus[status]++;
      } else {
        spjPerStatus[status] = 1;
      }
    }
  }
  
  const persenSerap = totalPagu > 0 ? (totalRealisasi / totalPagu * 100) : 0;
  
  return {
    totalPagu: totalPagu,
    totalAngkas: totalAngkas,
    totalRealisasi: totalRealisasi,
    persenSerap: Math.round(persenSerap * 100) / 100,
    jumlahSubKegiatan: jumlahSubKegiatan,
    jumlahSPJ: jumlahSPJ,
    spjPerStatus: spjPerStatus
  };
}

/**
 * DPA list with details
 */
function getDpaList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dpaSheet = ss.getSheetByName('MASTER_DPA');
  const angkasSheet = ss.getSheetByName('MASTER_ANGGARAN_KAS');
  
  if (!dpaSheet || dpaSheet.getLastRow() < 2) return [];
  
  const dpaData = dpaSheet.getDataRange().getValues();
  
  let angkasMap = {};
  if (angkasSheet && angkasSheet.getLastRow() > 1) {
    const akData = angkasSheet.getDataRange().getValues();
    for (let i = 1; i < akData.length; i++) {
      angkasMap[akData[i][1]] = Number(akData[i][7] || 0);
    }
  }
  
  let realisasiMap = {};
  const detailSheet = ss.getSheetByName('SPJ_DETAIL');
  if (detailSheet && detailSheet.getLastRow() > 1) {
    const dtData = detailSheet.getDataRange().getValues();
    for (let i = 1; i < dtData.length; i++) {
      const kode = String(dtData[i][8] || '');
      realisasiMap[kode] = (realisasiMap[kode] || 0) + Number(dtData[i][11] || 0);
    }
  }
  
  const list = [];
  for (let i = 1; i < dpaData.length; i++) {
    const kode = String(dpaData[i][5] || '');
    const nama = dpaData[i][4];
    const pagu = Number(dpaData[i][11] || 0);
    const sumberDana = dpaData[i][12] || '';
    const angkas = angkasMap[kode] || 0;
    const realisasi = realisasiMap[kode] || 0;
    const sisa = pagu - angkas;
    const persen = pagu > 0 ? (angkas / pagu * 100) : 0;
    
    list.push({
      kode: kode,
      nama: nama,
      pagu: pagu,
      sumberDana: sumberDana,
      angkas: angkas,
      realisasi: realisasi,
      sisa: sisa,
      persen: Math.round(persen * 100) / 100
    });
  }
  
  return list;
}

/**
 * Anggaran kas detail per sub-kegiatan
 */
function getAnggaranKasDetail(subKode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const angkasSheet = ss.getSheetByName('MASTER_ANGGARAN_KAS');
  
  if (!angkasSheet || angkasSheet.getLastRow() < 2) return null;
  
  const data = angkasSheet.getDataRange().getValues();
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(subKode)) {
      return {
        kode: data[i][1],
        nama: data[i][2],
        tw1: Number(data[i][3] || 0),
        tw2: Number(data[i][4] || 0),
        tw3: Number(data[i][5] || 0),
        tw4: Number(data[i][6] || 0),
        total: Number(data[i][7] || 0),
        bulanan: months.map((m, idx) => ({
          nama: m,
          nilai: Number(data[i][8 + idx] || 0)
        }))
      };
    }
  }
  
  return null;
}

/**
 * Monitoring RFK data
 */
function getMonitoringRFKData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dpaSheet = ss.getSheetByName('MASTER_DPA');
  const angkasSheet = ss.getSheetByName('MASTER_ANGGARAN_KAS');
  const indikatorSheet = ss.getSheetByName('MASTER_INDIKATOR');
  const spjDetailSheet = ss.getSheetByName('SPJ_DETAIL');
  const kendalaSheet = ss.getSheetByName('KENDALA_LOG');
  
  if (!dpaSheet || !angkasSheet) return [];
  
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  let angkasMap = {};
  if (angkasSheet.getLastRow() > 1) {
    const akData = angkasSheet.getDataRange().getValues();
    for (let i = 1; i < akData.length; i++) {
      angkasMap[akData[i][1]] = {
        bulanan: months.map((m, idx) => Number(akData[i][8 + idx] || 0)),
        total: Number(akData[i][7] || 0)
      };
    }
  }
  
  let indikatorMap = {};
  if (indikatorSheet && indikatorSheet.getLastRow() > 1) {
    const indData = indikatorSheet.getDataRange().getValues();
    for (let i = 1; i < indData.length; i++) {
      indikatorMap[indData[i][1]] = {
        nama: indData[i][3],
        target: indData[i][4]
      };
    }
  }
  
  let realisasiMap = {};
  if (spjDetailSheet && spjDetailSheet.getLastRow() > 1) {
    const dtData = spjDetailSheet.getDataRange().getValues();
    for (let i = 1; i < dtData.length; i++) {
      const kode = String(dtData[i][8] || '');
      const bulan = String(dtData[i][3] || '');
      const nilai = Number(dtData[i][11] || 0);
      const bulanIdx = months.indexOf(bulan);
      if (bulanIdx >= 0) {
        if (!realisasiMap[kode]) realisasiMap[kode] = {};
        realisasiMap[kode][bulanIdx] = (realisasiMap[kode][bulanIdx] || 0) + nilai;
      }
    }
  }
  
  let kendalaMap = {};
  if (kendalaSheet && kendalaSheet.getLastRow() > 1) {
    const kData = kendalaSheet.getDataRange().getValues();
    for (let i = 1; i < kData.length; i++) {
      const kode = String(kData[i][1] || '');
      const bulan = String(kData[i][2] || '');
      if (!kendalaMap[kode]) kendalaMap[kode] = [];
      kendalaMap[kode].push({
        bulan: bulan,
        permasalahan: kData[i][4],
        solusi: kData[i][5],
        status: kData[i][6]
      });
    }
  }
  
  const dpaData = dpaSheet.getDataRange().getValues();
  const result = [];
  
  for (let i = 1; i < dpaData.length; i++) {
    const kode = String(dpaData[i][5] || '');
    const nama = dpaData[i][4];
    const pagu = Number(dpaData[i][11] || 0);
    const sumberDana = dpaData[i][12] || '';
    
    const angkas = angkasMap[kode] || { bulanan: months.map(() => 0), total: 0 };
    const indikator = indikatorMap[kode] || { nama: '-', target: '-' };
    const realisasiBulanan = realisasiMap[kode] || {};
    
    let totalRealisasi = 0;
    const perBulan = months.map((m, idx) => {
      const angBulan = angkas.bulanan[idx] || 0;
      const relBulan = realisasiBulanan[idx] || 0;
      const sisaBulan = angBulan - relBulan;
      const persenBulan = angBulan > 0 ? Math.round(relBulan / angBulan * 10000) / 100 : 0;
      totalRealisasi += relBulan;
      return {
        bulan: m,
        anggaranKas: angBulan,
        realisasi: relBulan,
        sisa: sisaBulan,
        persenSerap: persenBulan
      };
    });
    
    const sisaTotal = angkas.total - totalRealisasi;
    const persenSerapTotal = angkas.total > 0 ? Math.round(totalRealisasi / angkas.total * 10000) / 100 : 0;
    
    result.push({
      kode: kode,
      nama: nama,
      pagu: pagu,
      sumberDana: sumberDana,
      angkasTotal: angkas.total,
      realisasiTotal: totalRealisasi,
      sisaTotal: sisaTotal,
      persenSerapTotal: persenSerapTotal,
      indikator: indikator.nama,
      targetIndikator: indikator.target,
      realisasiKinerja: '-',
      persenKinerja: 0,
      perBulan: perBulan,
      kendala: kendalaMap[kode] || []
    });
  }
  
  return result;
}

/**
 * Kendala management
 */
function getKendalaList() {
  const data = getSheetData_('KENDALA_LOG');
  return data.map(row => ({
    id: row['id_kendala'] || '',
    subKode: row['sub_kegiatan_kode'] || '',
    bulan: row['bulan'] || '',
    tahun: row['tahun'] || '',
    permasalahan: row['permasalahan'] || '',
    solusi: row['solusi'] || '',
    status: row['status_penyelesaian'] || '',
    tglInput: row['tgl_input'] || '',
    inputBy: row['input_by'] || ''
  }));
}

function simpanKendala(kendalaData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('KENDALA_LOG');
  if (!sheet) {
    const setupResult = setupAllSheets();
    sheet = ss.getSheetByName('KENDALA_LOG');
  }
  
  const id = 'KD-' + Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
  const timestamp = new Date();
  
  sheet.appendRow([
    id,
    kendalaData.subKode || '',
    kendalaData.bulan || '',
    kendalaData.tahun || APP.TAHUN_DEFAULT,
    kendalaData.permasalahan || '',
    kendalaData.solusi || '',
    kendalaData.status || 'Belum Ditangani',
    timestamp,
    kendalaData.inputBy || 'system'
  ]);
  
  return { success: true, id: id };
}

/**
 * Rekap sub kegiatan
 */
function getRekapSubKegiatan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('DPA_SUBKEGIATAN');
  if (sheet && sheet.getLastRow() > 1) {
    return getSheetData_('DPA_SUBKEGIATAN');
  }
  const dpaSheet = ss.getSheetByName('MASTER_DPA');
  if (!dpaSheet || dpaSheet.getLastRow() < 2) return [];
  const dpaData = dpaSheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < dpaData.length; i++) {
    result.push({
      kode: String(dpaData[i][5] || ''),
      nama: dpaData[i][4],
      pagu: Number(dpaData[i][11] || 0),
      sumberDana: dpaData[i][12] || '',
      status: dpaData[i][14] || 'Aktif'
    });
  }
  return result;
}

/**
 * Rekap rekening
 */
function getRekapRekening() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('REKAP_REKENING');
  if (sheet && sheet.getLastRow() > 1) {
    return getSheetData_('REKAP_REKENING');
  }
  const dpaSheet = ss.getSheetByName('MASTER_DPA');
  if (!dpaSheet || dpaSheet.getLastRow() < 2) return [];
  const dpaData = dpaSheet.getDataRange().getValues();
  const grouped = {};
  for (let i = 1; i < dpaData.length; i++) {
    const rek = String(dpaData[i][6] || '');
    if (!grouped[rek]) {
      grouped[rek] = {
        kode_rekening: rek,
        uraian: dpaData[i][7],
        total_pagu: 0,
        jumlah_item: 0
      };
    }
    grouped[rek].total_pagu += Number(dpaData[i][11] || 0);
    grouped[rek].jumlah_item++;
  }
  return Object.values(grouped);
}

/**
 * Validasi angkas
 */
function getValidasiAngkas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('VALIDASI_ANGKAS');
  if (sheet && sheet.getLastRow() > 1) {
    return getSheetData_('VALIDASI_ANGKAS');
  }
  const dpaSheet = ss.getSheetByName('MASTER_DPA');
  const angkasSheet = ss.getSheetByName('MASTER_ANGGARAN_KAS');
  if (!dpaSheet || dpaSheet.getLastRow() < 2) return [];
  const dpaData = dpaSheet.getDataRange().getValues();
  let angkasMap = {};
  if (angkasSheet && angkasSheet.getLastRow() > 1) {
    const akData = angkasSheet.getDataRange().getValues();
    for (let i = 1; i < akData.length; i++) {
      angkasMap[akData[i][1]] = Number(akData[i][7] || 0);
    }
  }
  const result = [];
  for (let i = 1; i < dpaData.length; i++) {
    const kode = String(dpaData[i][5] || '');
    const nama = dpaData[i][4];
    const pagu = Number(dpaData[i][11] || 0);
    const angkas = angkasMap[kode] || 0;
    const selisih = pagu - angkas;
    const status = Math.abs(selisih) < 1 ? 'OK' : Math.abs(selisih) <= pagu * 0.05 ? 'WARNING' : 'ERROR';
    result.push({
      kode: kode,
      nama: nama,
      pagu: pagu,
      angkas: angkas,
      selisih: selisih,
      status: status
    });
  }
  return result;
}

/**
 * Export monitoring to spreadsheet format
 */
function exportMonitoringRFK() {
  return generateMonitoringRFK();
}

/***************************************************************************
 * IMPORT FUNCTIONS - Import DPA & Anggaran Kas data into Spreadsheet
 * Run these from Apps Script editor or via clasp
 ***************************************************************************/

/**
 * Setup all required sheets with headers
 */
function setupAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheets = {
    'MASTER_SUMBER_DANA': [
      'id_sumber', 'nama_sumber', 'jenis', 'keterangan'
    ],
    'MASTER_ANGGARAN_KAS': [
      'id_kas', 'sub_kegiatan_kode', 'sub_kegiatan_nama', 
      'tw_1', 'tw_2', 'tw_3', 'tw_4', 'total',
      'bulan_januari', 'bulan_februari', 'bulan_maret', 'bulan_april',
      'bulan_mei', 'bulan_juni', 'bulan_juli', 'bulan_agustus',
      'bulan_september', 'bulan_oktober', 'bulan_november', 'bulan_desember',
      'tahun'
    ],
    'MASTER_INDIKATOR': [
      'id_indikator', 'sub_kegiatan_kode', 'sub_kegiatan_nama',
      'nama_indikator', 'target_kinerja', 'keluaran', 'tahun'
    ],
    'KENDALA_LOG': [
      'id_kendala', 'sub_kegiatan_kode', 'bulan', 'tahun',
      'permasalahan', 'solusi', 'status_penyelesaian',
      'tgl_input', 'input_by'
    ]
  };
  
  Object.entries(sheets).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    // Only set headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });
  
  return '✅ Semua sheet sudah disiapkan!';
}

/**
 * Import master sumber dana
 */
function importSumberDana() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('MASTER_SUMBER_DANA');
  if (!sheet) {
    setupAllSheets();
    sheet = ss.getSheetByName('MASTER_SUMBER_DANA');
  }
  
  const sumberDana = [
    ['SD001', 'Pendapatan Bagi Hasil Pajak Rokok', 'PAJAK ROKOK', 'Dari bagi hasil cukai rokok'],
    ['SD002', 'DAK Non Fisik-Dana BOK', 'DAK', 'Dana Alokasi Khusus Non Fisik'],
    ['SD003', 'PENDAPATAN ASLI DAERAH (PAD)', 'PAD', 'Pendapatan asli daerah'],
    ['SD004', 'Dana BOK-BOK Dinas-BOK Kabupaten/Kota', 'DAK', 'Bantuan Operasional Kesehatan'],
  ];
  
  // Clear existing data (keep header)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clear();
  }
  
  sheet.getRange(2, 1, sumberDana.length, sumberDana[0].length).setValues(sumberDana);
  
  return '✅ Master Sumber Dana berhasil diimport: ' + sumberDana.length + ' data';
}

/**
 * Import data DPA dari hasil parsing PDF
 * Data hardcode dari 5 DPA yang sudah di-parse
 */
function importDPA() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dpaSheet = ss.getSheetByName('MASTER_DPA');
  
  if (!dpaSheet) {
    return '❌ Sheet MASTER_DPA tidak ditemukan! Buat dulu.';
  }
  
  // Data DPA dari parsing PDF (5 sub-kegiatan)
  const dpaData = [
    // Surveilans Kesehatan
    {
      kode: '1.02.02.2.02.0020',
      nama: 'Pengelolaan Surveilans Kesehatan',
      pagu: 291790000,
      sumber: 'Pajak Rokok',
      keluaran: 'Jumlah Dokumen Hasil Pengelolaan Surveilans Kesehatan',
      target: '4 Dokumen'
    },
    // Spesimen
    {
      kode: '1.02.02.2.02.0028',
      nama: 'Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional',
      pagu: 913658000,
      sumber: 'Pajak Rokok dan DAK',
      keluaran: 'Jumlah Spesimen Penyakit Potensial KLB ke Laboratorium Rujukan/Nasional yang Didistribusikan',
      target: '982 Paket'
    },
    // KIPI
    {
      kode: '1.02.02.2.02.0036',
      nama: 'Investigasi Awal Kejadian Tidak Diharapkan (Kejadian Ikutan Pasca Imunisasi dan Pemberian Obat Massal)',
      pagu: 28250000,
      sumber: 'Pajak Rokok',
      keluaran: 'Jumlah Laporan Hasil Investigasi Awal Kejadian Tidak Diharapkan (KIPI)',
      target: '2 Laporan'
    },
    // Kewaspadaan Dini
    {
      kode: '1.02.02.2.02.0037',
      nama: 'Pelaksanaan Kewaspadaan Dini dan Respon Wabah',
      pagu: 18430000,
      sumber: 'Pajak Rokok',
      keluaran: 'Jumlah Dokumen Hasil Pelaksanaan Kewaspadaan Dini dan Respon Wabah',
      target: '2 Dokumen'
    },
    // Layanan Imunisasi
    {
      kode: '1.02.02.2.02.0048',
      nama: 'Pengelolaan Layanan Imunisasi',
      pagu: 49785000,
      sumber: 'PAD',
      keluaran: 'Jumlah Dokumen Hasil Pengelolaan Layanan Imunisasi',
      target: '6 Dokumen'
    }
  ];
  
  // Get existing data to check for duplicates
  const existing = dpaSheet.getDataRange().getValues();
  const existingCodes = existing.slice(1).map(r => r[0]);
  
  let imported = 0;
  let updated = 0;
  
  dpaData.forEach(dpa => {
    const row = [
      'DPA-' + dpa.kode,           // id_dpa
      '1.02.0.00.0.00.01.0000',   // kode_opd
      'DINAS KESEHATAN',           // nama_opd
      '1.02.02',                   // program
      dpa.nama,                    // sub_kegiatan (nama)
      dpa.kode,                    // sub_kode
      dpa.kode.split('.').pop(),   // kode_rekening (leaf)
      dpa.nama,                    // uraian_belanja
      1,                           // volume
      'Paket',                     // satuan
      dpa.pagu,                    // harga_satuan
      dpa.pagu,                    // pagu_total
      dpa.sumber,                  // sumber_dana
      '2026',                      // tahun
      'Aktif'                      // status
    ];
    
    const existIdx = existingCodes.indexOf('DPA-' + dpa.kode);
    if (existIdx >= 0) {
      dpaSheet.getRange(existIdx + 2, 1, 1, row.length).setValues([row]);
      updated++;
    } else {
      dpaSheet.appendRow(row);
      imported++;
    }
  });
  
  // Also populate MASTER_INDIKATOR
  const indikatorSheet = ss.getSheetByName('MASTER_INDIKATOR');
  if (indikatorSheet) {
    if (indikatorSheet.getLastRow() > 1) {
      indikatorSheet.getRange(2, 1, indikatorSheet.getLastRow() - 1, indikatorSheet.getLastColumn()).clear();
    }
    
    dpaData.forEach(dpa => {
      indikatorSheet.appendRow([
        'IND-' + dpa.kode,
        dpa.kode,
        dpa.nama,
        dpa.keluaran,
        dpa.target,
        dpa.keluaran,
        '2026'
      ]);
    });
  }
  
  return '✅ DPA berhasil diimport: ' + imported + ' baru, ' + updated + ' diupdate. Indikator juga sudah di-populate.';
}

/**
 * Import data Anggaran Kas dari hasil parsing PDF
 * Data hardcode dari 5 Anggaran Kas yang sudah di-parse
 */
function importAnggaranKas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('MASTER_ANGGARAN_KAS');
  if (!sheet) {
    setupAllSheets();
    sheet = ss.getSheetByName('MASTER_ANGGARAN_KAS');
  }
  
  // Data Anggaran Kas dari parsing PDF (5 sub-kegiatan)
  const angkasData = [
    {
      kode: '1.02.02.2.02.0020',
      nama: 'Pengelolaan Surveilans Kesehatan',
      tw: [70011000, 83281000, 71221000, 63077000],
      bulanan: {
        Januari: 20327000, Februari: 21417000, Maret: 28267000,
        April: 30267000, Mei: 31207000, Juni: 21807000,
        Juli: 31207000, Agustus: 20007000, September: 20007000,
        Oktober: 20007000, November: 20007000, Desember: 20007000
      }
    },
    {
      kode: '1.02.02.2.02.0028',
      nama: 'Pengambilan dan Pengiriman Spesimen Penyakit Potensial KLB',
      tw: [163858000, 289900000, 249750000, 210150000],
      bulanan: {
        Januari: 0, Februari: 358000, Maret: 163500000,
        April: 82500000, Mei: 83000000, Juni: 124400000,
        Juli: 83250000, Agustus: 83250000, September: 83250000,
        Oktober: 83250000, November: 83250000, Desember: 83250000
      }
    },
    {
      kode: '1.02.02.2.02.0036',
      nama: 'Investigasi Awal Kejadian Tidak Diharapkan (KIPI)',
      tw: [0, 1200000, 1200000, 16300000],
      bulanan: {
        Januari: 0, Februari: 0, Maret: 0,
        April: 400000, Mei: 400000, Juni: 400000,
        Juli: 400000, Agustus: 400000, September: 400000,
        Oktober: 8150000, November: 8150000, Desember: 0
      }
    },
    {
      kode: '1.02.02.2.02.0037',
      nama: 'Pelaksanaan Kewaspadaan Dini dan Respon Wabah',
      tw: [3300000, 4610000, 3610000, 5110000],
      bulanan: {
        Januari: 0, Februari: 3300000, Maret: 0,
        April: 1500000, Mei: 1610000, Juni: 1500000,
        Juli: 1610000, Agustus: 1750000, September: 250000,
        Oktober: 3360000, November: 1750000, Desember: 0
      }
    },
    {
      kode: '1.02.02.2.02.0048',
      nama: 'Pengelolaan Layanan Imunisasi',
      tw: [31035000, 3650000, 650000, 1250000],
      bulanan: {
        Januari: 370000, Februari: 30665000, Maret: 0,
        April: 2400000, Mei: 1250000, Juni: 0,
        Juli: 650000, Agustus: 0, September: 0,
        Oktober: 1250000, November: 0, Desember: 0
      }
    }
  ];
  
  // Clear existing data (keep header)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clear();
  }
  
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                   'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  angkasData.forEach(item => {
    const total = item.tw.reduce((a, b) => a + b, 0);
    const row = [
      'AK-' + item.kode,     // id_kas
      item.kode,             // sub_kegiatan_kode
      item.nama,             // sub_kegiatan_nama
      item.tw[0],            // tw_1
      item.tw[1],            // tw_2
      item.tw[2],            // tw_3
      item.tw[3],            // tw_4
      total,                 // total
    ];
    
    // Add monthly values
    months.forEach(m => row.push(item.bulanan[m] || 0));
    
    row.push('2026'); // tahun
    
    sheet.appendRow(row);
  });
  
  return '✅ Anggaran Kas berhasil diimport: ' + angkasData.length + ' sub-kegiatan';
}

/**
 * Main function - Run all imports
 */
function importSemuaData() {
  let results = [];
  
  results.push(setupAllSheets());
  results.push(importSumberDana());
  results.push(importDPA());
  results.push(importAnggaranKas());
  
  return results.join('\n');
}

/**
 * Generate MONITORING_RFK sheet from imported data
 */
function generateMonitoringRFK() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Get or create monitoring sheet
  let monitorSheet = ss.getSheetByName('MONITORING_RFK');
  if (!monitorSheet) {
    monitorSheet = ss.insertSheet('MONITORING_RFK');
  }
  
  // Clear existing data
  if (monitorSheet.getLastRow() > 0) {
    monitorSheet.clear();
  }
  
  // Headers
  const headers = [
    'KODE', 'NAMA KEGIATAN', 'TOTAL PAGU', 'SUMBER DANA',
    'TW I', 'TW II', 'TW III', 'TW IV',
    'TOTAL REALISASI', 'SISA ANGGARAN', '% SERAPAN',
    'INDIKATOR KINERJA', 'TARGET KINERJA', 'REALISASI KINERJA', '% CAPAIAN KINERJA',
    'PERMASALAHAN', 'SOLUSI'
  ];
  
  monitorSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  monitorSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  monitorSheet.getRange(1, 1, 1, headers.length).setBackground('#1e3a8a');
  monitorSheet.getRange(1, 1, 1, headers.length).setFontColor('white');
  monitorSheet.setFrozenRows(1);
  
  // Get data from MASTER_DPA and MASTER_ANGGARAN_KAS
  const dpaSheet = ss.getSheetByName('MASTER_DPA');
  const angkasSheet = ss.getSheetByName('MASTER_ANGGARAN_KAS');
  const indikatorSheet = ss.getSheetByName('MASTER_INDIKATOR');
  
  if (!dpaSheet || !angkasSheet) {
    return '❌ Sheet MASTER_DPA atau MASTER_ANGGARAN_KAS tidak ditemukan!';
  }
  
  const dpaData = dpaSheet.getDataRange().getValues();
  const angkasData = angkasSheet.getDataRange().getValues();
  const indikatorData = indikatorSheet ? indikatorSheet.getDataRange().getValues() : [];
  
  // Build lookup maps
  const angkasMap = {};
  angkasData.slice(1).forEach(row => {
    angkasMap[row[1]] = { // key = sub_kegiatan_kode
      tw1: Number(row[3]) || 0,
      tw2: Number(row[4]) || 0,
      tw3: Number(row[5]) || 0,
      tw4: Number(row[6]) || 0,
      total: Number(row[7]) || 0
    };
  });
  
  const indikatorMap = {};
  indikatorData.slice(1).forEach(row => {
    indikatorMap[row[1]] = { // key = sub_kegiatan_kode
      nama: row[3],
      target: row[4]
    };
  });
  
  // Generate rows
  let rowNum = 2;
  dpaData.slice(1).forEach(dpaRow => {
    const kode = dpaRow[5]; // sub_kode
    const nama = dpaRow[4]; // nama
    const pagu = Number(dpaRow[11]) || 0;
    const sumber = dpaRow[12];
    
    const angkas = angkasMap[kode] || { tw1: 0, tw2: 0, tw3: 0, tw4: 0, total: 0 };
    const indikator = indikatorMap[kode] || { nama: '', target: '' };
    
    const sisa = pagu - angkas.total;
    const persenSerapan = pagu > 0 ? (angkas.total / pagu * 100) : 0;
    
    const row = [
      kode, nama, pagu, sumber,
      angkas.tw1, angkas.tw2, angkas.tw3, angkas.tw4,
      angkas.total, sisa, persenSerapan / 100,
      indikator.nama, indikator.target, 0, 0,
      '', ''
    ];
    
    monitorSheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
    
    // Format currency columns
    monitorSheet.getRange(rowNum, 3).setNumberFormat('#,##0');
    monitorSheet.getRange(rowNum, 5, 1, 6).setNumberFormat('#,##0');
    monitorSheet.getRange(rowNum, 11).setNumberFormat('0.00%');
    
    rowNum++;
  });
  
  // Auto-fit columns
  monitorSheet.autoResizeColumns(1, headers.length);
  
  return '✅ MONITORING_RFK berhasil di-generate: ' + (rowNum - 2) + ' sub-kegiatan';
}
/***************************************************************************
 * PORTAL KEUANGAN OPD - SI-RFK KENDALI SPJ & ANGKAS 2026 (FINAL PRODUCTION)
 * Fitur: Custom Auth (Anti-Stuck), 3-Tier Autocomplete, Auto-SPJ, & LockService
 ***************************************************************************/

const APP = {
  TIMEZONE: 'Asia/Jakarta',
  TAHUN_DEFAULT: '2026',
  SHEETS: {
    CONFIG: 'CONFIG',
    USER_ROLE: 'USER_ROLE',
    MASTER_DPA: 'MASTER_DPA',
    MASTER_ANGKAS: 'MASTER_ANGKAS',
    SPJ_HEADER: 'SPJ_HEADER',
    SPJ_DETAIL: 'SPJ_DETAIL',
    REALISASI_AUTO: 'REALISASI_AUTO',
    LOG: 'LOG_AKTIVITAS'
  },
  MONTHS: [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Portal Keuangan OPD 2026')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function prosesLoginKustom(username, password) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const roleSheet = ss.getSheetByName(APP.SHEETS.USER_ROLE);
    
    if (!roleSheet) throw new Error("Sheet dengan nama 'USER_ROLE' tidak ditemukan.");

    const roleData = roleSheet.getDataRange().getValues();
    const uClean = username.toLowerCase().trim();
    const pClean = String(password).trim();
    
    let userFound = null;
    if (roleData.length < 2) throw new Error("Data di sheet USER_ROLE kosong.");

    for (let i = 1; i < roleData.length; i++) {
      const sheetUser = roleData[i][0] ? String(roleData[i][0]).toLowerCase().trim() : "";
      const sheetRole = roleData[i][1] ? String(roleData[i][1]).toUpperCase().trim() : "VIEWER";
      const sheetPass = roleData[i][2] ? String(roleData[i][2]).trim() : ""; 
      const sheetNama = roleData[i][3] ? String(roleData[i][3]).trim() : sheetUser; 
      
      if (sheetUser === uClean && sheetPass === pClean) {
        userFound = { email: roleData[i][0], role: sheetRole, nama: sheetNama };
        break;
      }
    }
    
    if (userFound) {
      const realisasiSheet = ss.getSheetByName(APP.SHEETS.REALISASI_AUTO);
      if (!realisasiSheet) throw new Error("Sheet 'REALISASI_AUTO' tidak ditemukan.");

      const rData = realisasiSheet.getDataRange().getValues();
      let totalPagu = 0, totalSerapan = 0;
      for(let i = 1; i < rData.length; i++) {
        totalPagu += Number(rData[i][8] || 0); 
        totalSerapan += Number(rData[i][22] || 0); 
      }
      
      return {
        success: true,
        user: userFound,
        months: APP.MONTHS,
        stats: { pagu: totalPagu / 12, serapan: totalSerapan / 12 }
      };
    } else {
      return { success: false, message: "Kombinasi Username/Password salah atau tidak terdaftar!" };
    }
  } catch (err) {
    return { success: false, message: "Kesalahan Sistem: " + err.message };
  }
}

/**
 * SHA-256 hash password (client-side compatible)
 */
function hashPassword_(plainPassword) {
  const bytes = Utilities.newBlob(plainPassword).getBytes();
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return hash.map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
}

/**
 * Change password for logged-in user
 */
function ubahPassword(lama, baru) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const roleSheet = ss.getSheetByName(APP.SHEETS.USER_ROLE);
    
    if (!roleSheet) throw new Error("Sheet USER_ROLE tidak ditemukan");
    
    const data = roleSheet.getDataRange().getValues();
    const oldHash = hashPassword_(lama);
    let updated = false;
    
    for (let i = 1; i < data.length; i++) {
      const sheetPass = data[i][2] ? String(data[i][2]).trim() : "";
      if (sheetPass === oldHash) {
        const newHash = hashPassword_(baru);
        roleSheet.getRange(i + 1, 3).setValue(newHash);
        updated = true;
        break;
      }
    }
    
    if (!updated) {
      return { success: false, message: "Password lama salah" };
    }
    
    return { success: true, message: "Password berhasil diubah" };
  } catch (err) {
    return { success: false, message: "Error: " + err.message };
  }
}

function getDpaHierarkiTigaTingkat() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dpaSheet = ss.getSheetByName(APP.SHEETS.MASTER_DPA);
  const data = dpaSheet.getDataRange().getValues();
  const hierarki = {}; 
  
  for (let i = 1; i < data.length; i++) {
    const idDpa = data[i][0];
    if (!idDpa) continue;
    
    const subKeg = data[i][4];     
    const kodeRek = data[i][5];    
    const uraianBel = data[i][7];  
    const paguTotal = Number(data[i][11] || 0); 
    
    if (!hierarki[subKeg]) { hierarki[subKeg] = {}; }
    if (!hierarki[subKeg][kodeRek]) { hierarki[subKeg][kodeRek] = []; }
    
    hierarki[subKeg][kodeRek].push({
      id_dpa: idDpa, uraian_belanja: uraianBel, pagu: paguTotal
    });
  }
  return hierarki;
}

function getDaftarSpj() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const headerSheet = ss.getSheetByName(APP.SHEETS.SPJ_HEADER);
  const data = headerSheet.getDataRange().getValues();
  const list = [];
  
  for(let i = 1; i < data.length; i++) {
    if(!data[i][0]) continue;
    list.push({
      id_spj: data[i][0], nomor_spj: data[i][1],
      tanggal: Utilities.formatDate(new Date(data[i][2]), APP.TIMEZONE, 'yyyy-MM-dd'),
      bulan: data[i][4], pptk: data[i][7], status: data[i][9], total: Number(data[i][12] || 0)
    });
  }
  return list.reverse(); 
}

function simpanSpj(headerData, detailRows, userEmailSession) {
  const lock = LockService.getScriptLock();
  try {
    const hasLock = lock.tryLock(30000); 
    if (!hasLock) throw new Error("Sistem sibuk memproses antrean lain. Coba sesaat lagi.");

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const headerSheet = ss.getSheetByName(APP.SHEETS.SPJ_HEADER);
    const detailSheet = ss.getSheetByName(APP.SHEETS.SPJ_DETAIL);
    const emailAct = userEmailSession || "system-login";
    const timestamp = new Date();
    const idSpj = headerData.id_spj || makeId_('SPJ');

    let headerIndex = -1;
    if (headerData.id_spj) {
      const hd = headerSheet.getDataRange().getValues();
      for (let i = 1; i < hd.length; i++) {
        if (hd[i][0] === idSpj) { headerIndex = i + 1; break; }
      }
    }

    const rowHeader = [
      idSpj, headerData.nomor_spj, headerData.tanggal_spj, APP.TAHUN_DEFAULT, headerData.bulan,
      'DINAS KESEHATAN', 'Bidang P2P', headerData.pptk, '', headerData.status_spj || 'Draft',
      headerData.jenis_spj, 'Input via Web', headerData.total_bruto, 0, headerData.total_bruto,
      timestamp, emailAct, timestamp, emailAct
    ];

    if (headerIndex > 0) {
      headerSheet.getRange(headerIndex, 1, 1, rowHeader.length).setValues([rowHeader]);
    } else {
      headerSheet.appendRow(rowHeader);
    }

    if (headerData.id_spj) {
      const dt = detailSheet.getDataRange().getValues();
      for (let i = dt.length - 1; i >= 1; i--) {
        if (dt[i][1] === idSpj) detailSheet.deleteRow(i + 1);
      }
    }

    detailRows.forEach(function(row) {
      detailSheet.appendRow([
        makeId_('DTL'), idSpj, APP.TAHUN_DEFAULT, headerData.bulan, 'DINAS KESEHATAN', 'Bidang P2P',
        row.sub_kegiatan, row.nama_kegiatan || '', row.kode_rekening, row.uraian_belanja, row.pelaksana || '', 
        Number(row.nilai_bruto), 0, Number(row.nilai_bruto), Number(row.pagu_referensi), headerData.jenis_spj,
        headerData.status_spj || 'Draft', '', 0, 0, 0, 0, 'OK', '', timestamp, emailAct, headerData.tanggal_spj
      ]);
    });

    SpreadsheetApp.flush();
    return { success: true, id_spj: idSpj };
  } finally {
    lock.releaseLock(); 
  }
}

function updateStatusSpj(idSpj, statusBaru, userEmailSession) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const headerSheet = ss.getSheetByName(APP.SHEETS.SPJ_HEADER);
  const detailSheet = ss.getSheetByName(APP.SHEETS.SPJ_DETAIL);
  const hd = headerSheet.getDataRange().getValues();
  const dt = detailSheet.getDataRange().getValues();
  
  for (let i = 1; i < hd.length; i++) {
    if (hd[i][0] === idSpj) {
      headerSheet.getRange(i + 1, 10).setValue(statusBaru); 
      break;
    }
  }
  for (let i = 1; i < dt.length; i++) {
    if (dt[i][1] === idSpj) {
      detailSheet.getRange(i + 1, 17).setValue(statusBaru); 
    }
  }
  SpreadsheetApp.flush();
  return { success: true };
}

function makeId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
}