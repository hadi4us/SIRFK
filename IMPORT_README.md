# SI-RFK Monitoring — Import Tools

## Cara Import Data

### Langkah 1: Jalankan Setup (dari Apps Script Editor)
Buka script editor → Jalankan fungsi `importSemuaData()`

Fungsi ini akan:
1. ✅ Setup semua sheet yang diperlukan (MASTER_SUMBER_DANA, MASTER_ANGGARAN_KAS, MASTER_INDIKATOR, KENDALA_LOG)
2. ✅ Import data Sumber Dana (4 jenis)
3. ✅ Import data DPA (5 sub-kegiatan dari parsing PDF)
4. ✅ Import data Anggaran Kas (5 sub-kegiatan dengan alokasi bulanan & triwulanan)

### Langkah 2: Generate Monitoring RFK
Setelah import selesai, jalankan `generateMonitoringRFK()` untuk membuat sheet MONITORING_RFK.

### Langkah 3: Refresh Data
Jika ada perubahan data DPA/Angkas dari PDF baru:
1. Edit file `import_functions.js` → Update data di `importDPA()` atau `importAnggaranKas()`
2. Jalankan `clasp push` dari terminal
3. Jalankan ulang fungsi import di Apps Script

## Struktur Data yang Diimport

### MASTER_DPA
| Kolom | Deskripsi |
|---|---|
| id_dpa | ID unik (DPA-{kode}) |
| kode_opd | Kode OPD |
| nama_opd | Nama OPD |
| program | Kode program |
| sub_kegiatan | Nama sub-kegiatan |
| sub_kode | Kode sub-kegiatan |
| kode_rekening | Kode rekening leaf |
| uraian_belanja | Uraian belanja |
| volume, satuan, harga_satuan | Rincian |
| pagu_total | Total pagu |
| sumber_dana | Sumber pendanaan |
| tahun, status | Metadata |

### MASTER_ANGGARAN_KAS
| Kolom | Deskripsi |
|---|---|
| sub_kegiatan_kode | FK ke DPA |
| tw_1 - tw_4 | Alokasi per triwulan |
| bulan_januari - bulan_desember | Alokasi per bulan |
| total | Total alokasi kas |

### MONITORING_RFK (Auto-generated)
| Kolom | Deskripsi |
|---|---|
| KODE | Kode sub-kegiatan |
| NAMA KEGIATAN | Nama kegiatan |
| TOTAL PAGU | Total anggaran |
| SUMBER DANA | Sumber dana |
| TW I - TW IV | Anggaran kas per triwulan |
| TOTAL REALISASI | Akumulasi realisasi |
| SISA ANGGARAN | Pagu - Realisasi |
| % SERAPAN | Realisasi / Pagu |
| INDIKATOR KINERJA | Indikator output |
| TARGET KINERJA | Target yang ditetapkan |
| PERMASALAHAN | Kendala yang dihadapi |
| SOLUSI | Tindak lanjut |

## Data yang Sudah Di-parse dari PDF

### DPA (5 Sub-Kegiatan)
1. **1.02.02.2.02.0020** — Pengelolaan Surveilans Kesehatan (Rp 291.790.000)
2. **1.02.02.2.02.0028** — Pengambilan dan Pengiriman Spesimen KLB (Rp 913.658.000)
3. **1.02.02.2.02.0036** — Investigasi KIPI (Rp 28.250.000)
4. **1.02.02.2.02.0037** — Kewaspadaan Dini dan Respon Wabah (Rp 18.430.000)
5. **1.02.02.2.02.0048** — Pengelolaan Layanan Imunisasi (Rp 49.785.000)

### Anggaran Kas
Data alokasi kas per bulan dan per triwulan sudah di-import untuk semua 5 sub-kegiatan.

## File yang Relevan
- `import_functions.js` — Fungsi GAS untuk import & generate monitoring
- `parse_dpa.js` — Parser DPA PDF (Node.js)
- `parse_angkas.js` — Parser Anggaran Kas PDF (Node.js)
- `parsed_dpa.json` — Hasil parsing DPA
- `parsed_angkas.json` — Hasil parsing Anggaran Kas
