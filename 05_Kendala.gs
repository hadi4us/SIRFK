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
  clearKendalaMutationCache_();
  logActivity_(session.email, 'SIMPAN_KENDALA', 'KENDALA_LOG', id, null, { subKode: row[1], bulan: row[2] }, 'OK', 'Kendala disimpan');
  return { success: true, id: id };
}

