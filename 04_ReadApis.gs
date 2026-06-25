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

  const rowsBySub = {};
  (maps.rows || []).forEach(function(row) {
    const kode = row.sub_kegiatan_kode;
    if (!rowsBySub[kode]) rowsBySub[kode] = [];
    rowsBySub[kode].push(row);
  });

  Object.keys(maps.subCodeInfo).sort().forEach(function(kode) {
    const info = maps.subCodeInfo[kode];
    const angkas = angkasMap[kode] || { total: 0, totalBulanan: 0, totalTw: 0 };
    const realisasi = validAgg.bySub[kode] || 0;
    const selisihPaguAngkas = info.pagu - asNumber_(angkas.total);
    const rincian = (rowsBySub[kode] || []).map(function(row) {
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

  const rowsBySub = {};
  (maps.rows || []).forEach(function(row) {
    const kode = row.sub_kegiatan_kode;
    if (!rowsBySub[kode]) rowsBySub[kode] = [];
    rowsBySub[kode].push(row);
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

    const rincian = (rowsBySub[kode] || []).map(function(row) {
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
    subKode: col_('sub_kegiatan_kode', COL_SPJ_DETAIL.SUB_KODE),
    subNama: col_('sub_kegiatan_nama', COL_SPJ_DETAIL.SUB_NAMA),
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
    const dpa = resolveDpaFromDetailRow_(row, maps) || maps.byId[safeString_(row[c.idDpa])] || null;
    const kodeSub = dpa ? safeString_(dpa.sub_kegiatan_kode) : safeString_(row[c.subKode]);
    const namaSub = dpa ? safeString_(dpa.sub_kegiatan_nama) : safeString_(row[c.subNama]);
    const kodeRekening = dpa && safeString_(dpa.kode_rekening) ? safeString_(dpa.kode_rekening) : safeString_(row[c.kodeRekening]);
    const uraian = dpa && safeString_(dpa.uraian_belanja) ? safeString_(dpa.uraian_belanja) : safeString_(row[c.uraianBelanja]);
    const detail = dpa ? safeString_(dpa.detail_kegiatan) : '';
    const subRincian = dpa ? safeString_(dpa.sub_rincian) : '';
    const kegiatanKey = kodeSub || namaSub || 'TANPA_SUB_KEGIATAN';
    const kegiatanTitle = namaSub || kodeSub || 'Tanpa Sub Kegiatan';
    if (!result.tables[kegiatanKey]) {
      result.tables[kegiatanKey] = {
        key: kegiatanKey,
        title: kegiatanTitle,
        sub_kegiatan_kode: kodeSub,
        sub_kegiatan_nama: namaSub,
        rows: {},
        total: 0
      };
    }
    const table = result.tables[kegiatanKey];
    const rowKey = [kodeRekening, uraian, detail, subRincian, pelaksana].map(normalizeKey_).join('|');
    if (!table.rows[rowKey]) {
      table.rows[rowKey] = {
        kode_rekening: kodeRekening,
        uraian_belanja: uraian,
        detail_kegiatan: detail,
        sub_rincian: subRincian,
        pelaksana: pelaksana,
        months: APP.MONTHS.map(function() { return 0; }),
        total: 0
      };
    }
    table.rows[rowKey].months[monthIdx] += 1;
    table.rows[rowKey].total += 1;
    table.total += 1;
  });

  result.kegiatan = Object.keys(result.tables).sort(function(a, b) {
    return result.tables[a].title.localeCompare(result.tables[b].title);
  }).map(function(key) {
    const table = result.tables[key];
    table.rows = Object.keys(table.rows).sort(function(a, b) {
      const ra = table.rows[a], rb = table.rows[b];
      return [ra.kode_rekening, ra.uraian_belanja, ra.detail_kegiatan, ra.sub_rincian, ra.pelaksana].join('|').localeCompare([rb.kode_rekening, rb.uraian_belanja, rb.detail_kegiatan, rb.sub_rincian, rb.pelaksana].join('|'));
    }).map(function(rowKey) { return table.rows[rowKey]; });
    return { key: key, title: table.title, sub_kegiatan_kode: table.sub_kegiatan_kode, sub_kegiatan_nama: table.sub_kegiatan_nama, total: table.total };
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

