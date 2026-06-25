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
