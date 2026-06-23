# REVIEW & AUDIT — SI-RFK KENDALI SPJ & ANGKAS 2026

**Script ID:** `1Oq0rSv4x0_IBW6g7GAv7hU7KiNEq9SvMd7YBXQ_et1Vl_LtHJlA6-4OM`
**File:** `Code.js`, `Index.html`, `appsscript.json`

---

## 1. RINGKASAN ARSITEKTUR SAAT INI

| Komponen | Status |
|---|---|
| Backend | Code.js — 6 fungsi server-side |
| Frontend | Index.html — SPA dengan Tailwind |
| Database | Google Sheets (8 sheet) |
| Auth | Custom login (plaintext password) |
| Deploy | Web App GAS, ANYONE_ANONYMOUS |

### Sheets yang Digunakan
1. `CONFIG` — Setup aplikasi
2. `USER_ROLE` — User, role, password
3. `MASTER_DPA` — Data DPA (hierarki 3-tier)
4. `MASTER_ANGKAS` — Data anggaran kas
5. `SPJ_HEADER` — Header SPJ
6. `SPJ_DETAIL` — Detail item SPJ
7. `REALISASI_AUTO` — Data realisasi
8. `LOG_AKTIVITAS` — Log aktivitas

### Fitur yang Sudah Ada
- ✅ Login kustom dengan role-based access
- ✅ 3-tier autocomplete (Sub-Kegiatan → Kode Rekening → Uraian)
- ✅ Input SPJ dengan multiple item
- ✅ Workflow status: Draft → Diajukan → Diverifikasi → Dibayar
- ✅ Dashboard sederhana (total pagu & serapan)
- ✅ LockService untuk konflik akses

---

## 2. TEMUAN AUDIT — MASALAH KRITIS

### 🔴 KRITIS

| # | Masalah | Lokasi | Dampak |
|---|---|---|---|
| 1 | **Password plaintext** | `USER_ROLE` col[2], login check | Keamanan — siapapun yang akses sheet bisa lihat password semua user |
| 2 | **webapp: ANYONE_ANONYMOUS** | `appsscript.json` | Semua orang bisa akses tanpa autentikasi Google |
| 3 | **Hardcoded "DINAS KESEHATAN" & "Bidang P2P"** | `simpanSpj()` baris 67-68 | Tidak bisa dipakai OPD lain |
| 4 | **Tidak ada validasi pagu** | `sisipkanItemKeTabel()` | User bisa input belanja melebihi pagu DPA tanpa peringatan |
| 5 | **Tidak ada sheet RFK monitoring** | Seluruh sistem | Output yang diharapkan (Excel) tidak bisa dihasilkan |

### 🟡 SEDANG

| # | Masalah | Lokasi | Dampak |
|---|---|---|---|
| 6 | **Login pakai email, tapi password input** | `prosesLoginKustom()` | Seharusnya pakai Google OAuth Session token |
| 7 | **Statistik pagu/serapan salah** | Login handler — dibagi 12 | Realisasi bukan rata-rata bulanan |
| 8 | **Tidak ada RBAC yang benar** | Login handler | Semua role bisa akses semua data |
| 9 | **Tidak ada audit trail benar** | `LOG_AKTIVITAS` tidak dipakai | Perubahan tidak dilog |
| 10 | **Tidak ada sheet Anggaran Kas TW** | MASTER_ANGKAS ada tapi tidak dipakai | Perencanaan kas per triwulan tidak ter-track |

### 🟢 RENDAH

| # | Masalah | Lokasi |
|---|---|---|
| 11 | Tidak ada input sanitization | Semua input user |
| 12 | Tidak ada rate limiting | Semua fungsi |
| 13 | Error handling kurang spesifik | Server-side functions |
| 14 | Tidak ada export/print | Frontend |
| 15 | UI tidak responsive untuk mobile | Index.html |

---

## 3. GAP vs OUTPUT YANG DIHARAPKAN (Excel RFK)

Kolom yang ada di Excel tapi **belum ada** di sistem:

| Kolom Excel | Status Sistem | Prioritas |
|---|---|---|
| KODE (Sub-Kegiatan) | ✅ Ada di MASTER_DPA | — |
| TOTAL PAGU ANGGARAN | ✅ Ada di MASTER_DPA | — |
| SUMBER DANA | ❌ Tidak ada | 🔴 |
| RINCIAN PER SUMBER DANA | ❌ Tidak ada | 🔴 |
| ANGGARAN KAS (TW I-IV) | ❌ MASTER_ANGKAS tidak terpakai | 🔴 |
| REALISASI PER SUMBER DANA | ❌ Tidak ada | 🔴 |
| TOTAL REALISASI | ⚠️ Ada tapi tidak per sub-keg | 🟡 |
| SISA ANGGARAN | ❌ Tidak ada | 🔴 |
| % CAPAIAN SERAPAN | ⚠️ Dashboard hanya total | 🟡 |
| INDIKATOR KINERJA | ❌ Tidak ada | 🔴 |
| TARGET KINERJA | ❌ Tidak ada | 🔴 |
| REALISASI TARGET KINERJA | ❌ Tidak ada | 🔴 |
| % CAPAIAN KINERJA | ❌ Tidak ada | 🔴 |
| PERMASALAHAN/KENDALA | ❌ Tidak ada | 🔴 |
| SOLUSI/TINDAK LANJUT | ❌ Tidak ada | 🟡 |

**Coverage: ~15% dari kebutuhan output RFK.**

---

## 4. TEMUAN POSITIF

- ✅ Hierarki 3-tier autocomplete konsepnya bagus
- ✅ LockService untuk prevent concurrent write
- ✅ ID unik dengan timestamp + random
- ✅ Workflow status SPJ cukup lengkap
- ✅ Frontend clean dengan Tailwind

---

## 5. REKOMENDASI DASAR

1. **Ganti auth** → Pakai `Session.getActiveUser().getEmail()` untuk identitas, bukan password input
2. **Tambah sheet RFK** → Master_indikator, RFK_monitoring
3. **Tambah Sumber Dana** → Master_sumber_dana, relasi ke DPA
4. **Implementasi Anggaran Kas TW** → Populate MASTER_ANGKAS dari DPA
5. **Validasi pagu** → Cek sisa pagu sebelum simpan
6. **Audit trail** → Log semua perubahan ke LOG_AKTIVITAS
7. **Export ke Excel** → Generate RFK sheet otomatis
