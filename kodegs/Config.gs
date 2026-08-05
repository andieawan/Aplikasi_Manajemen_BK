/**
 * Config.gs — Konstanta global Aplikasi Manajemen BK
 *
 * DIKONFIRMASI dari kode asli go_absen_siswa (kodegs/Config.gs,
 * kodegs/Auth.gs, js/config.js, js/ssocookie.js) -- KOREKSI dari asumsi
 * awal:
 * - SESSION_KEY ('sso_session') dan SSO_COOKIE_DOMAIN
 *   ('.smkibupakusari.sch.id') BUKAN konstanta backend .gs -- itu cuma
 *   ada di frontend (js/config.js CONFIG.SESSION_KEY / SSO_COOKIE_DOMAIN),
 *   dipakai js/ssocookie.js untuk baca/tulis cookie. Backend Apps Script
 *   sama sekali tidak menyentuhnya. Frontend BK app perlu config.js sendiri
 *   dengan 2 nilai ini SAMA PERSIS (lihat file frontend/config.js terpisah).
 * - SESSION_SECRET_KEY BUKAN konstanta kode sama sekali -- itu Script
 *   Property (PropertiesService), diisi lewat Project Settings > Script
 *   Properties. Nilainya harus disalin manual dari project go_absen_siswa
 *   ke project BK ini (lihat catatan di Auth.gs — getSessionSecret()
 *   sengaja error kalau belum di-set, bukan auto-generate).
 * - SPREADSHEET_MASTER_SISWA_ID & SPREADSHEET_MASTER_GURU_ID di bawah ini
 *   NILAI ASLINYA (disalin dari kodegs/Config.gs go_absen_siswa) --
 *   pastikan tetap ID yang sama kalau nanti diganti di sisi go_absen_siswa.
 */

const SPREADSHEET_MASTER_SISWA_ID = '1YYWe9qgwP5v4FvO9xR2vWOtu9NA89EHwa7xaTOqeVuI';
const SPREADSHEET_MASTER_GURU_ID = '1jW4dNNN1MxLBkRIHsSOcg_zZwzueDS19BwyZprCHa_c';

/**
 * ===== JALANKAN SEKALI SAJA DARI EDITOR APPS SCRIPT =====
 * Cara pakai (sama seperti setupConfig() di go_absen_siswa):
 * 1. Ganti 2 nilai placeholder di bawah dengan nilai ASLI.
 * 2. Di Apps Script Editor, pilih fungsi "setupConfigBK" di dropdown atas,
 *    lalu klik Run (▶). Cukup 1x saja.
 * 3. PENTING: setelah berhasil jalan, hapus lagi nilai ASLI yang sempat
 *    Anda ketik di sini (kembalikan ke placeholder), lalu commit ulang --
 *    supaya SESSION_SECRET_KEY tidak pernah tersimpan di riwayat Git/GitHub.
 *    Nilainya sudah aman tersimpan di Script Properties, tidak hilang
 *    walau baris kode ini dikosongkan lagi.
 */
function setupConfigBK() {
  const props = PropertiesService.getScriptProperties();

  const SESSION_SECRET_KEY_ASLI = 'TEMPEL_NILAI_PERSIS_DARI_SCRIPT_PROPERTIES_GO_ABSEN_SISWA';
  const URL_WEB_APP_GO_ABSEN_SISWA = 'TEMPEL_URL_WEB_APP_GO_ABSEN_SISWA';

  if (SESSION_SECRET_KEY_ASLI.indexOf('TEMPEL_') !== 0) {
    props.setProperty('SESSION_SECRET_KEY', SESSION_SECRET_KEY_ASLI);
    Logger.log('SESSION_SECRET_KEY berhasil di-set.');
  } else {
    Logger.log('SESSION_SECRET_KEY dilewati (masih placeholder) -- isi dulu nilai aslinya di atas.');
  }

  if (URL_WEB_APP_GO_ABSEN_SISWA.indexOf('TEMPEL_') !== 0) {
    props.setProperty('BACKEND_URL_GO_ABSEN_SISWA', URL_WEB_APP_GO_ABSEN_SISWA);
    Logger.log('BACKEND_URL_GO_ABSEN_SISWA berhasil di-set.');
  } else {
    Logger.log('BACKEND_URL_GO_ABSEN_SISWA dilewati (masih placeholder) -- isi dulu nilai aslinya di atas.');
  }
}

/** Cek status setup -- jalankan kapan saja untuk lihat apa yang sudah/belum di-set. */
function cekStatusSetupBK() {
  const props = PropertiesService.getScriptProperties();
  Logger.log('SESSION_SECRET_KEY: ' + (props.getProperty('SESSION_SECRET_KEY') ? '[SUDAH DI-SET]' : '[BELUM]'));
  Logger.log('BACKEND_URL_GO_ABSEN_SISWA: ' + (props.getProperty('BACKEND_URL_GO_ABSEN_SISWA') || '[BELUM]'));
  Logger.log('FOLDER_ROOT_BK_ID: ' + (props.getProperty('FOLDER_ROOT_BK_ID') || '[belum ada, akan auto-create saat fitur pertama dipakai]'));
}

// URL Web App go_absen_siswa (sama seperti CONFIG.BACKEND_URL di
// go_absen_siswa/js/config.js) -- dipakai PresensiService.gs untuk
// UrlFetchApp ke action 'getAbsenUntukBK' (BELUM ADA di go_absen_siswa,
// lihat catatan TODO di PresensiService.gs). Diisi lewat setupConfigBK()
// atau langsung di Script Properties, BUKAN konstanta kode (supaya gampang
// diganti tanpa deploy ulang, sama seperti pola getConfigValue() di
// go_absen_siswa).
function getBackendUrlGoAbsenSiswa() {
  return PropertiesService.getScriptProperties().getProperty('BACKEND_URL_GO_ABSEN_SISWA') || '';
}

// Script Property key untuk threshold notifikasi alpa/telat (angka
// kebijakan sekolah -- pertanyaan terbuka #2, belum diputuskan). Default
// dipakai kalau belum di-set lewat setThresholdAlpa().
const PROP_THRESHOLD_ALPA = 'THRESHOLD_ALPA';
const DEFAULT_THRESHOLD_ALPA = 3;

// Catatan: folder Drive & spreadsheet data BK 100% auto-provisioning --
// lihat ProvisioningService.gs (getOrCreateRootFolderBK()). Tidak ada
// langkah manual buat folder di sini.

// Properti script untuk menyimpan ID spreadsheet yang sudah diprovisi per tahun ajaran.
// Key: 'PELANGGARAN_SS_ID_2026_2027', dst.
const PREFIX_PROP_PELANGGARAN_SS = 'PELANGGARAN_SS_ID_';

const SHEET_PELANGGARAN = 'Pelanggaran';

// Properti script untuk provisioning spreadsheet Kasus per tahun ajaran.
const PREFIX_PROP_KASUS_SS = 'KASUS_SS_ID_';
const SHEET_KASUS = 'Kasus';

// Properti script untuk provisioning spreadsheet Prestasi per tahun ajaran.
const PREFIX_PROP_PRESTASI_SS = 'PRESTASI_SS_ID_';
const SHEET_PRESTASI = 'Prestasi';

// Properti script untuk provisioning spreadsheet Home Visit per tahun ajaran.
const PREFIX_PROP_HOMEVISIT_SS = 'HOMEVISIT_SS_ID_';
const SHEET_HOMEVISIT = 'HomeVisit';

// Properti script untuk provisioning spreadsheet Surat per tahun ajaran.
const PREFIX_PROP_SURAT_SS = 'SURAT_SS_ID_';
const SHEET_DATA_SURAT = 'Data Surat';
const SHEET_CONFIG_JENIS_SURAT = 'Config Jenis Surat';

const COL_SURAT = {
  ID: 0,
  TIMESTAMP: 1,
  JENIS_SURAT: 2,
  NOMOR_SURAT: 3,
  NIS: 4,
  NAMA: 5,
  KELAS: 6,
  KEPERLUAN: 7,
  FIELD_TAMBAHAN_JSON: 8,
  DIBUAT_OLEH: 9,
  LINK_DOKUMEN: 10,
  STATUS: 11
};

// Folder Drive tempat dokumen surat hasil generate disimpan (auto-create,
// lihat getOrCreateFolderSurat() di SuratService.gs).
const PROP_FOLDER_SURAT_ID = 'FOLDER_SURAT_ID';

const COL_HOMEVISIT = {
  ID: 0,
  TIMESTAMP: 1,
  NIS: 2,
  NAMA: 3,
  KELAS: 4,
  TANGGAL_KUNJUNGAN: 5,
  TUJUAN: 6,
  HASIL_KUNJUNGAN: 7,
  PETUGAS: 8,
  TINDAK_LANJUT: 9,
  STATUS: 10
};

const COL_PRESTASI = {
  ID: 0,
  TIMESTAMP: 1,
  NIS: 2,
  NAMA: 3,
  KELAS: 4,
  TANGGAL: 5,
  JENIS: 6,       // 'Akademik' | 'Non-Akademik'
  TINGKAT: 7,     // 'Sekolah' | 'Kabupaten' | 'Provinsi' | 'Nasional' | 'Internasional'
  NAMA_KEGIATAN: 8,
  CAPAIAN: 9,     // mis. "Juara 1", "Peserta"
  DILAPORKAN_OLEH: 10,
  LAMPIRAN: 11,
  STATUS: 12
};

// Kolom sheet Kasus (0-indexed).
const COL_KASUS = {
  ID: 0,
  TIMESTAMP: 1,
  NIS: 2,
  NAMA: 3,
  KELAS: 4,
  TANGGAL_MULAI: 5,
  KATEGORI: 6,
  RINGKASAN: 7,
  TINGKAT_KERAHASIAAN: 8, // 'Normal' | 'Sangat Rahasia'
  STATUS_KASUS: 9,        // 'Aktif' | 'Dipantau' | 'Selesai'
  TINDAK_LANJUT: 10,
  DILAPORKAN_OLEH: 11,
  STATUS: 12              // 'Aktif' | 'Diarsipkan' (soft delete)
};

// Kolom sheet Pelanggaran (0-indexed) — jaga urutan ini konsisten di semua fungsi.
// KATEGORI hanya boleh berisi salah satu dari 3 nilai tetap: Ringan/Sedang/Berat
// (bukan lagi nama kategori spesifik seperti "Membolos" + tingkat terpisah).
const KATEGORI_PELANGGARAN_VALID = ['Ringan', 'Sedang', 'Berat'];
const COL_PELANGGARAN = {
  ID: 0,
  TIMESTAMP: 1,
  NIS: 2,
  NAMA: 3,
  KELAS: 4,
  TANGGAL_KEJADIAN: 5,
  KATEGORI: 6, // 'Ringan' | 'Sedang' | 'Berat'
  DESKRIPSI: 7,
  TINDAK_LANJUT: 8,
  STATUS_TINDAK_LANJUT: 9,
  DILAPORKAN_OLEH: 10,
  LAMPIRAN: 11,
  STATUS: 12
};
