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
  clearSpjMutationCache_();
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
  clearSpjMutationCache_();
  logActivity_(session.email, 'UPDATE_STATUS_SPJ', 'SPJ_HEADER', idSpj, { status: beforeStatus }, { status: status }, 'OK', 'Status SPJ diperbarui');
  return { success: true, status: status };
}


