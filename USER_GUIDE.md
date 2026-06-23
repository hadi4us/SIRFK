# SI-RFK Monitoring APBD 2026 - Dokumentasi Penggunaan

## Access
- **URL:** https://script.google.com/macros/d/AKfycbzOTTWH9ZZCy-RD3qb2XYA6F7jIC5e31dSTnSLPd1udwAfW9nESJgqEKYAHqOI1T_vQ5g/exec
- **Project ID:** 1Oq0rSv4x0_IBW6g7GAv7hU7KiNEq9SvMd7YBXQ_et1Vl_LtHJlA6-4OM

---

## 1. MODUL DASHBOARD

### Fitur
- **Stat Cards:** Total Pagu, Total Anggaran Kas, Total Realisasi SPJ, Jumlah SPJ
- **Bar Chart:** Visualisasi perbandingan Anggaran Kas vs Realisasi per sub-kegiatan (CSS-based)
- **Recent SPJ:** 5 dokumen SPJ terakhir dengan status badge

### Cara Pakai
- Langsung tampil saat login
- Chart update otomatis dari data MASTER_DPA & SPJ_DETAIL
- Klik "Monitoring RFK" untuk detail per bulan

---

## 2. MODUL DPA & ANGGARAN KAS

### Fitur
- Tabel lengkap 5 sub-kegiatan dengan kolom:
  - Kode Sub
  - Nama Sub Kegiatan
  - Total Pagu
  - Anggaran Kas (TW1-TW4 + Total)
  - Selisih (Pagu - Angkas)
  - Status

### Cara Pakai
1. Klik menu **DPA & Anggaran** di sidebar
2. Lihat ringkasan per sub-kegiatan
3. Untuk detail anggaran kas per bulan, gunakan Monitoring RFK

---

## 3. MODUL INPUT SPJ

### Fitur
- **Form Identitas:** Nomor SPJ, Tanggal, Bulan Kas, PPTK, Jenis (NON SPPD/SPPD)
- **3-Tier Autocomplete:**
  - Level 1: Sub Kegiatan (input text + datalist)
  - Level 2: Kode Rekening (otomatis terisi)
  - Level 3: Uraian Belanja (otomatis terisi)
- **Info Dinamis:** Pagu tersedia berubah otomatis saat pilih sub-kegiatan
- **Antrean Items:** Tambah item sementara sebelum simpan
- **Validasi:** Cek anggaran tersedia saat input

### Cara Pakai
1. Klik menu **Input SPJ**
2. Isi identitas SPJ di atas
3. **Pilih Sub Kegiatan** — datalist otomatis terisi dari MASTER_DPA
4. **Kode Rekening** & **Uraian Belanja** otomatis terisi dari hierarki
5. Isi **Nilai Bruto** (contoh: 1500000)
6. Klik **+ Sisipkan Item** untuk menambah ke antrean
7. Ulangi untuk item lain
8. Klik **Simpan Dokumen SPJ** untuk menyimpan semua item

### Validasi Real-time
- Pagu tersedia berubah otomatis saat ganti sub-kegiatan
- Nilai bruto harus angka positif
- Sub-kegiatan wajib dipilih

---

## 4. MODUL MONITORING RFK

### Fitur
- **Selector Sub Kegiatan:** Dropdown pilih sub-kegiatan
- **Tabel 10 Kolom:**
  - Bulan (Januari-Desember)
  - Anggaran Kas (Rp)
  - Realisasi (Rp)
  - Sisa (Rp)
  - % Serap (persen)
  - Indikator
  - Target
  - Realisasi Kinerja
  - % Kinerja
  - Kendala
- **Export Excel:** Generate file Excel sesuai format resmi

### Cara Pakai
1. Klik menu **Monitoring RFK**
2. Pilih **Sub Kegiatan** dari dropdown
3. Tabel otomatis terisi data anggaran kas per bulan
4. Lengkapi kolom Realisasi, Indikator, Target, dll
5. Klik **Export ke Excel** untuk download file

### Export Excel
- Format sesuai template resmi BPK
- 1 sheet per sub-kegiatan
- Format angka Rupiah & persen otomatis

---

## 5. MODUL KENDALA & TINDAK LANJUT

### Fitur
- **Input Form:**
  - Sub Kegiatan
  - Bulan
  - Permasalahan (textarea)
  - Solusi / Tindak Lanjut (textarea)
- **Daftar Kendala:** Tabel semua catatan kendala

### Cara Pakai
1. Klik menu **Kendala & Tindak Lanjut**
2. Pilih Sub Kegiatan dan Bulan
3. Isi permasalahan yang dihadapi
4. Isi solusi atau tindak lanjut yang diambil
5. Klik **Simpan Kendala**
6. Semua data tersimpan di sheet LOG_AKTIVITAS

---

## 6. MODUL VALIDASI DATA

### Fitur
- **Summary Cards:** Total DPA, Total Anggaran Kas, Selisih
- **Tabel Validasi:** Cross-check per sub-kegiatan
  - Kode
  - Sub Kegiatan
  - Pagu DPA
  - Anggaran Kas
  - Selisih
  - Status (ok/warning/error)

### Cara Pakai
1. Klik menu **Validasi Data**
2. Lihat summary total
3. Scroll tabel untuk cek selisih per sub-kegiatan
4. Status badge:
   - 🟢 Ok: Selisih 0 atau positif
   - 🟡 Warning: Selisih negatif kecil
   - 🔴 Error: Selisih negatif besar

---

## 7. MODUL LAPORAN

### Fitur
- **Export Monitoring RFK:** Button export ke Excel
- **Laporan Summary:**
  - Total Pagu Anggaran
  - Total Anggaran Kas
  - Total Realisasi SPJ
  - Persen Serapan

### Cara Pakai
1. Klik menu **Laporan**
2. Lihat summary di kartu kanan
3. Klik **Export ke Excel** untuk download

---

## ROLES & ACCESS CONTROL

| Role | Akses |
|------|-------|
| **ADMIN** | Semua modul (input, monitoring, validasi, laporan) |
| **OPERATOR** | Input SPJ, Monitoring, Laporan |
| **PPTK** | Input SPJ (atas nama PPTK) |
| **VIEWER** | Dashboard, Monitoring RFK, Validasi, Laporan (read-only) |

---

## DATA SOURCE

### Sheet yang Digunakan
- **MASTER_DPA:** Data Rencana Anggaran Belanja
- **MASTER_ANGGARAN_KAS:** Distribusi anggaran kas per triwulan
- **SPJ_HEADER:** Header dokumen SPJ
- **SPJ_DETAIL:** Detail item SPJ
- **MONITORING_RFK:** Output monitoring per bulan
- **LOG_AKTIVITAS:** Log kendala & aktivitas
- **USER_ROLE:** Kredensial login (password SHA-256)

---

## TECH STACK

- **Backend:** Google Apps Script (V8)
- **Frontend:** HTML5 + Tailwind CSS 2.2.19 (CDN only)
- **Database:** Google Sheets
- **Auth:** Custom (username/password dengan SHA-256 hash)
- **Export:** Google Apps Script export ke Excel format

---

## TROUBLESHOOTING

### Login gagal
- Pastikan username & password benar (case-insensitive username)
- Cek sheet `USER_ROLE` untuk data user
- Password sudah di-hash, jangan ubah manual

### Chart tidak muncul
- Pastikan sheet `MASTER_DPA` ada data
- Pastikan kolom "Pagu" terisi

### Autocomplete tidak terisi
- Pastikan data di `MASTER_DPA` sudah lengkap
- Kode sub-kegiatan harus unik

### Export Excel error
- Pastikan sheet `MONITORING_RFK` ada
- Cek sheet `MASTER_ANGGARAN_KAS` untuk data anggaran kas

---

## VERSION HISTORY

| Versi | Tanggal | Fitur |
|-------|---------|-------|
| v1.0 | 2026-06-22 | 7 modul frontend, 13 backend functions, import system |
| v1.1 | 2026-06-22 | Ganti password, SHA-256 hashing, UI update |

---

## DEV NOTES

- **File:** `/home/survim/.openclaw/workspace/rfk-monitoring/`
- **Main:** `Code.js` + `Index.html`
- **Deploy:** `clasp push` → `clasp deploy`
- **Deploy ID:** `AKfycbzOTTWH9ZZCy-RD3qb2XYA6F7jIC5e31dSTnSLPd1udwAfW9nESJgqEKYAHqOI1T_vQ5g`

---

**Dinas Kesehatan Kota Depok — SI-RFK Monitoring APBD 2026**
