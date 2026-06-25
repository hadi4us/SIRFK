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

