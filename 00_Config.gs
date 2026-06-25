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

