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

