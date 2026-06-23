# BLUEPRINT PENGEMBANGAN SI-RFK MONITORING
## Sistem Informasi Rekening Fungsional Keuangan — APBD

**Versi:** 1.0
**Tanggal:** 22 Juni 2026
**Dasar Hukum:**
- PP 71/2010 tentang Penerapan Standar Akuntansi Pemerintahan
- Permendagri 90/2019 tentang Klasifikasi, Codename, dan Kode Rekening APBD
- Permendagri 33/2019 tentang Pedoman Penyusunan APBD
- PP 12/2019 tentang Pengelolaan Keuangan Daerah
- Peraturan BPK tentang Pengawasan APBD

---

## TUJUAN SISTEM

Membangun sistem monitoring RFK yang:
1. **Terintegrasi** — Satu platform input → output RFK otomatis
2. **Sesuai regulasi** — Mengikuti alur penatausahaan keuangan daerah
3. **Akuntabel** — Setiap transaksi tercatat, terverifikasi, dapat diaudit
4. **Real-time** — Monitoring serapan anggaran dan kinerja secara langsung

---

## ALUR PENATAKEUANGAN DAERAH (Referensi Regulasi)

```
┌─────────────────────────────────────────────────────────────┐
│                    ALUR PENATAKEUANGAN DAERAH               │
│                                                             │
│  1. PERENCANAAN        2. PELAKSANAAN       3. PERTANGGUNG │
│  ┌──────────┐         ┌──────────┐         JAWABAN         │
│  │ RKPD     │───────→│ DPA      │───────→ ┌──────────┐    │
│  │ RKA-SKPD │        │ Kontrak  │         │ SPJ      │    │
│  │ DPA      │        │ SPP      │         │ LPPD     │    │
│  └──────────┘        │ SPTB     │         │ LKPJ     │    │
│                      └──────────┘         └──────────┘    │
│                            │                     │          │
│                            ▼                     ▼          │
│                      ┌──────────┐         ┌──────────┐    │
│                      │REALISASI │         │ LAPORAN  │    │
│                      │ Anggaran │         │ KEUANGAN │    │
│                      └──────────┘         └──────────┘    │
│                                                             │
│  4. PENGAWASAN                                              │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Internal: Inspektorat / BPKAD                      │     │
│  │ Eksternal: BPK, DPRD                               │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## ARCHITECTURE — SISTEM SI-RFK MONITORING

### Struktur Sheet yang Diusulkan

```
Google Spreadsheet
├── [CONFIG]          — Setting aplikasi (tahun, OPD, periode)
├── [USER_ROLE]       — User management + role
├── [MASTER_DPA]      — Data DPA lengkap (rekening, pagu, sumber dana)
├── [MASTER_SUMBER_DANA] — Referensi sumber dana (PAJAK ROKOK, DAK, DLL)
├── [MASTER_ANGGARAN_KAS] — Alokasi kas per triwulan per sub-kegiatan
├── [MASTER_INDIKATOR] — Indikator kinerja program/kegiatan
├── [SPJ_HEADER]      — Header dokumen SPJ
├── [SPJ_DETAIL]      — Rincian belanja per SPJ
├── [REALISASI_BULANAN] — Realisasi bulanan per sumber dana
├── [MONITORING_RFK]  — ⭐ OUTPUT UTAMA — Format Excel RFK
├── [LOG_AKTIVITAS]   — Audit trail semua perubahan
└── [KENDALA_LOG]     — Log permasalahan dan tindak lanjut
```

---

### DETAIL SETIAP SHEET

#### 1. MASTER_DPA (Diperluas)

| Kolom | Field | Tipe | Keterangan |
|---|---|---|---|
| A | id_dpa | Text | ID unik DPA |
| B | kode_opd | Text | Kode OPD |
| C | nama_opd | Text | Nama OPD |
| D | program | Text | Program |
| E | sub_kegiatan | Text | Sub-Kegiatan (Level 3) |
| F | kode_rekening | Text | Kode Rekening (6-8 digit) |
| G | nama_rekening | Text | Nama Rekening |
| H | uraian_belanja | Text | Uraian Belanja |
| I | volume | Number | Volume |
| J | satuan | Text | Satuan |
| K | harga_satuan | Number | Harga Satuan |
| L | pagu_total | Number | Total Pagu |
| M | sumber_dana | Text | FK → MASTER_SUMBER_DANA |
| N | tahun | Text | Tahun Anggaran |
| O | status | Text | Aktif/Tidak Aktif |

#### 2. MASTER_SUMBER_DANA (Baru)

| Kolom | Field | Tipe |
|---|---|---|
| A | id_sumber | Text |
| B | nama_sumber | Text |
| C | jenis | Text (PAJAK ROKOK / DAK / LAINNYA) |
| D | keterangan | Text |

#### 3. MASTER_ANGGARAN_KAS (Baru)

| Kolom | Field | Tipe | Keterangan |
|---|---|---|---|
| A | id_kas | Text | |
| B | id_dpa | Text | FK → MASTER_DPA |
| C | sub_kegiatan | Text | |
| D | tw_1 | Number | Triwulan I |
| E | tw_2 | Number | Triwulan II |
| F | tw_3 | Number | Triwulan III |
| G | tw_4 | Number | Triwulan IV |
| H | tahun | Text | |

**Aturan: TW1 + TW2 + TW3 + TW4 = Total Pagu**

#### 4. MASTER_INDIKATOR (Baru)

| Kolom | Field | Tipe | Keterangan |
|---|---|---|---|
| A | id_indikator | Text | |
| B | sub_kegiatan | Text | FK |
| C | nama_indikator | Text | Contoh: "Jumlah Dokumen Hasil Surveilans" |
| D | target_tahun | Text | Target tahun berjalan (misal: "4 Dokumen") |
| E | target_tw_1 | Number | Realisasi fisik TW1 |
| F | target_tw_2 | Number | Realisasi fisik TW2 |
| G | target_tw_3 | Number | Realisasi fisik TW3 |
| H | target_tw_4 | Number | Realisasi fisik TW4 |

#### 5. REALISASI_BULANAN (Baru — pengganti REALISASI_AUTO)

| Kolom | Field | Tipe | Keterangan |
|---|---|---|---|
| A | id_realisasi | Text | |
| B | id_dpa | Text | FK → MASTER_DPA |
| C | sub_kegiatan | Text | |
| D | bulan | Text | Nama bulan |
| E | sumber_dana | Text | FK → MASTER_SUMBER_DANA |
| F | realisasi_anggaran | Number | Realisasi anggaran bulan ini |
| G | realisasi_kinerja | Number | Realisasi indikator bulan ini |
| H | tahun | Text | |

#### 6. MONITORING_RFK (Output Utama)

Sheet ini auto-generated dari gabungan data lain. Format sesuai Excel:

| Kolom | Field | Sumber Data |
|---|---|---|
| A | KODE (Sub-Kegiatan) | MASTER_DPA.sub_kegiatan |
| B | Uraian Kegiatan | MASTER_DPA.nama |
| C | TOTAL PAGU ANGGARAN | MASTER_DPA.pagu_total |
| D | SUMBER DANA | MASTER_SUMBER_DANA.nama |
| E | RINCIAN PER SUMBER DANA | MASTER_DPA (per sumber) |
| F | ANGGARAN KAS TW I | MASTER_ANGGARAN_KAS.tw_1 |
| G | ANGGARAN KAS TW II | MASTER_ANGGARAN_KAS.tw_2 |
| H | ANGGARAN KAS TW III | MASTER_ANGGARAN_KAS.tw_3 |
| I | ANGGARAN KAS TW IV | MASTER_ANGGARAN_KAS.tw_4 |
| J | REALISASI PER SUMBER DANA | REALISASI_BULANAN (per sumber) |
| K | TOTAL REALISASI | REALISASI_BULANAN (akumulasi) |
| L | SISA ANGGARAN | PAGU - TOTAL REALISASI |
| M | % CAPAIAN SERAPAN | REALISASI / PAGU × 100 |
| N | INDIKATOR KINERJA | MASTER_INDIKATOR.nama |
| O | TARGET KINERJA | MASTER_INDIKATOR.target |
| P | REALISASI TARGET | MASTER_INDIKATOR.realisasi |
| Q | % CAPAIAN KINERJA | REALISASI/TARGET × 100 |
| R | % CAPAIAN FISIK | REALISASI/TARGET × 100 |
| S | PERMASALAHAN | KENDALA_LOG |
| T | SOLUSI | KENDALA_LOG |

#### 7. KENDALA_LOG (Baru)

| Kolom | Field | Tipe |
|---|---|---|
| A | id_kendala | Text |
| B | sub_kegiatan | Text |
| C | bulan | Text |
| D | permasalahan | Text |
| E | solusi | Text |
| F | status_penyelesaian | Text |
| G | tgl_input | DateTime |
| H | input_by | Text |

---

### ALUR APLIKASI (User Flow)

```
┌──────────────────────────────────────────────────────────────┐
│                    USER FLOW SI-RFK MONITORING               │
│                                                              │
│  ┌─────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │LOGIN│───→│ DASHBOARD │───→│ INPUT    │───→│ MONITOR  │  │
│  │     │    │ (Admin)   │    │ SPJ      │    │ RFK      │  │
│  └─────┘    └──────────┘    └──────────┘    └──────────┘  │
│      │                                │              │       │
│      │            ┌──────────┐        │              │       │
│      └───────────→│ MASTER   │←───────┘              │       │
│                   │ DPA/SUMBER│                      │       │
│                   └──────────┘                      │       │
│                                                     │       │
│  ┌──────────────────────────────────────────────────┘       │
│  │                                                           │
│  ▼                                                           │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ GENERATE │───→│ EXPORT   │───→│ DOWNLOAD │              │
│  │ RFK      │    │ EXCEL    │    │ .XLSX    │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│                                                              │
│  ROLES:                                                      │
│  - ADMIN    : Full access                                   │
│  - OPERATOR : Input SPJ, lihat monitoring                   │
│  - PPTK     : Input SPJ, ubah status                       │
│  - VERIFIKATOR : Verifikasi SPJ, lihat semua               │
│  - PIMPINAN : Dashboard, monitoring, export                 │
│  - BENDAHARA : Verifikasi keuangan                         │
│  - VIEWER   : Lihat saja                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## RENCANA PENGEMBANGAN (Phasing)

### FASE 1 — REFACTORING & DATA FOUNDATION (Minggu 1-2)

**Tujuan:** Perbaiki fondasi, tambah sheet yang kurang

| # | Task | Detail |
|---|---|---|
| 1.1 | Ganti Auth System | Pakai `Session.getActiveUser().getEmail()`, hapus password plaintext |
| 1.2 | Buat sheet MASTER_SUMBER_DANA | Referensi sumber dana APBD |
| 1.3 | Buat sheet MASTER_ANGGARAN_KAS | Alokasi kas per triwulan per sub-kegiatan |
| 1.4 | Buat sheet MASTER_INDIKATOR | Indikator kinerja per sub-kegiatan |
| 1.5 | Buat sheet REALISASI_BULANAN | Realisasi bulanan per sumber dana |
| 1.6 | Buat sheet KENDALA_LOG | Log permasalahan dan tindak lanjut |
| 1.7 | Perluas MASTER_DPA | Tambah kolom sumber_dana, tahun, status |
| 1.8 | Hapus hardcoded "DINAS KESEHATAN" | Ambil dari CONFIG atau user session |

### FASE 2 — INPUT & VALIDASI (Minggu 3-4)

**Tujuan:** Perbaiki input, tambah validasi, perbaiki flow

| # | Task | Detail |
|---|---|---|
| 2.1 | Validasi pagu real-time | Cek sisa pagu sebelum sisip item |
| 2.2 | Input sumber dana per item | Pilih sumber dana saat input belanja |
| 2.3 | Input anggaran kas TW | Form alokasi kas per triwulan |
| 2.4 | Input indikator kinerja | Form target dan realisasi indikator |
| 2.5 | Input kendala/tindak lanjut | Form permasalahan per sub-kegiatan |
| 2.6 | Audit trail aktif | Log semua perubahan ke LOG_AKTIVITAS |
| 2.7 | Rate limiting | Prevent spam input |
| 2.8 | Input sanitization | Bersihkan semua input user |

### FASE 3 — MONITORING RFK (Minggu 5-6)

**Tujuan:** Bangun sheet monitoring, auto-generate dari data

| # | Task | Detail |
|---|---|---|
| 3.1 | Auto-generate MONITORING_RFK | Fungsi untuk populate sheet monitoring |
| 3.2 | Kalkulasi realisasi kumulatif | Akumulasi realisasi bulanan → per triwulan |
| 3.3 | Kalkulasi % serapan | Realisasi / Pagu × 100 |
| 3.4 | Kalkulasi % kinerja | Realisasi fisik / Target × 100 |
| 3.5 | Kalkulasi sisa anggaran | Pagu - Realisasi |
| 3.6 | Integrasi kendala ke monitoring | Pull dari KENDALA_LOG ke kolom S/T |
| 3.7 | Dashboard monitoring | Visualisasi serapan per bulan, TW, kumulatif |

### FASE 4 — REPORTING & EXPORT (Minggu 7-8)

**Tujuan:** Export otomatis ke Excel sesuai format RFK

| # | Task | Detail |
|---|---|---|
| 4.1 | Export ke Excel | Generate file .xlsx sesuai format RFK |
| 4.2 | Auto-format Excel | Bold header, warna baris, border |
| 4.3 | Export per OPD | Filter dan export per OPD |
| 4.4 | Export gabungan | Semua OPD dalam satu file |
| 4.5 | Print-friendly | Format cetak untuk hardcopy |
| 4.6 | Email otomatis | Kirim laporan via email ke pimpinan |

### FASE 5 — OPTIMASI & DEPLOY (Minggu 9-10)

**Tujuan:** Optimasi performa, keamanan, deploy production

| # | Task | Detail |
|---|---|---|
| 5.1 | Optimasi query | Cache data, kurangi read/write |
| 5.2 | Keamanan | Validasi role di server-side, prevent privilege escalation |
| 5.3 | Error handling | Try-catch lengkap, user-friendly error messages |
| 5.4 | UAT | User acceptance testing dengan operator |
| 5.5 | Dokumentasi | User manual, admin guide |
| 5.6 | Deploy production | Deploy web app, set permissions |

---

## REGULASI YANG HARUS DIPENUHI

### Struktur Kode Rekening (Permendagri 90/2019)
```
XXX.X.XX.XX.XX.XX.XXXX
│    │  │   │  │  │   └── Objek Belanja
│    │  │   │  │  └────── Rincian Objek Belanja
│    │  │   │  └───────── Kode Rekening
│    │  │   └──────────── Sub-Kegiatan
│    │  └──────────────── Kegiatan
│    └─────────────────── Program
└─────────────────────── Organisasi (OPD)
```

### Alur SPJ (Surat Pertanggungjawaban)
```
1. PPTK input SPJ → Status: DRAFT
2. Operator submit → Status: DIAJUKAN
3. Verifikator review → Status: DIVERIFIKASI / DITOLAK
4. Bendahara bayar → Status: DIBAYAR
5. Arsip otomatis → LOG_AKTIVITAS
```

### Anggaran Kas (PP 12/2019)
```
TW I (Jan-Mar)  : 25% dari pagu tahunan
TW II (Apr-Jun) : 25% dari pagu tahunan
TW III (Jul-Sep): 25% dari pagu tahunan
TW IV (Okt-Des) : 25% dari pagu tahunan

Catatan: Bisa berbeda berdasarkan RKPD masing-masing
```

### Indikator Kinerja (Permendagri 33/2019)
```
- Indikator harus SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Target harus terukur dengan satuan yang jelas
- Realisasi harus berbasis bukti (dokumen, foto, laporan)
```

---

## STANDAR OUTPUT RFK (Sesuai Excel)

### Format Per Sub-Kegiatan:
```
┌─────────────────────────────────────────────────────────────┐
│ KODE: 1.02.1.02.02.2.02.20                                 │
│ NAMA: Pengelolaan Surveilans Kesehatan                      │
│ TOTAL PAGU: Rp 291.790.000                                  │
│ SUMBER DANA: Pajak Rokok                                    │
├─────────┬──────────┬──────────┬──────────┬──────────┬──────┤
│ BULAN   │ KAS TW   │ REALISASI│ SISA     │ % SERAPAN│KINERJA│
├─────────┼──────────┼──────────┼──────────┼──────────┼──────┤
│ JAN     │ TW I     │ Rp xxx   │ Rp xxx   │ xx%      │ x/4  │
│ FEB     │ TW I     │ Rp xxx   │ Rp xxx   │ xx%      │ x/4  │
│ ...     │ ...      │ ...      │ ...      │ ...      │ ...  │
│ DES     │ TW IV    │ Rp 0     │ Rp xxx   │ xx%      │ x/4  │
├─────────┼──────────┼──────────┼──────────┼──────────┼──────┤
│ KENDALA: xxx                                                │
│ SOLUSI: xxx                                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## PRIORITAS PENGERJAAN

```
P0 (MUST HAVE):
├── Fix auth system (hapus plaintext password)
├── Tambah semua sheet yang kurang
├── Validasi pagu real-time
├── Auto-generate MONITORING_RFK
└── Export ke Excel

P1 (SHOULD HAVE):
├── Input anggaran kas TW
├── Input indikator kinerja
├── Input kendala/tindak lanjut
├── Dashboard monitoring visual
└── Audit trail

P2 (NICE TO HAVE):
├── Email otomatis
├── Mobile responsive
├── Multi-OPD support
├── Rekonsiliasi otomatis
└── API untuk integrasi
```

---

## CATATAN PENTING

1. **Multi-OPD:** Sistem harus bisa handle bukan hanya Dinas Kesehatan tapi semua OPD
2. **Tahunan:** Sistem harus support perubahan tahun anggaran
3. **Audit-ready:** Setiap perubahan harus tercatat dengan siapa, kapan, apa yang diubah
4. **Offline-capable:** Google Sheets bisa diakses offline, pertahankan fitur ini
5. **Backup:** Google Sheets otomatis backup, tapi tambah export manual juga
