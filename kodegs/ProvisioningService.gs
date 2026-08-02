/**
 * ProvisioningService.gs — auto-provisioning generik untuk semua fitur BK.
 * Tidak ada langkah manual (folder/spreadsheet) sama sekali -- semua dibuat
 * otomatis saat pertama kali dibutuhkan, ID-nya disimpan permanen di
 * Script Properties (tidak dibuat ulang di panggilan berikutnya).
 *
 * Struktur Drive yang dihasilkan:
 *   Data Aplikasi Manajemen BK/          <- root, dibuat otomatis 1x
 *     Data BK - Pelanggaran 2026_2027    <- 1 spreadsheet per fitur per tahun ajaran
 *     Data BK - Kasus 2026_2027
 *     ... dst (fitur lain menyusul)
 */

const NAMA_FOLDER_ROOT_BK = 'Data Aplikasi Manajemen BK';
const PROP_FOLDER_ROOT_BK = 'FOLDER_ROOT_BK_ID';

/** Ambil folder root BK, buat otomatis kalau belum ada. */
function getOrCreateRootFolderBK() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(PROP_FOLDER_ROOT_BK);
  if (existingId) {
    try {
      return DriveApp.getFolderById(existingId);
    } catch (e) {
      // Folder terhapus manual dari Drive -- buat ulang di bawah, jangan gagal total.
    }
  }
  const folder = DriveApp.createFolder(NAMA_FOLDER_ROOT_BK);
  props.setProperty(PROP_FOLDER_ROOT_BK, folder.getId());
  return folder;
}

/**
 * Generik: ambil/provisi 1 spreadsheet (per fitur, per tahun ajaran), auto
 * pindah ke folder root BK, hapus "Sheet1" default, lalu jalankan setupFn(ss)
 * untuk membuat sheet-sheet yang dibutuhkan fitur tsb.
 *
 * Parameter sudahDikunci: true kalau pemanggil sudah pegang LockService lock
 * sendiri (cegah deadlock kalau dipanggil dari dalam fungsi lain yang juga
 * butuh lock).
 */
function getOrProvisionSpreadsheetId(propKey, namaSpreadsheet, sudahDikunci, setupFn) {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(propKey);
  if (existingId) return existingId;

  let lock = null;
  if (!sudahDikunci) {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
  }

  try {
    // Cek ulang setelah dapat lock -- mungkin thread lain sudah membuatnya.
    const idSetelahLock = props.getProperty(propKey);
    if (idSetelahLock) return idSetelahLock;

    const ss = SpreadsheetApp.create(namaSpreadsheet);
    const folderRoot = getOrCreateRootFolderBK();
    const file = DriveApp.getFileById(ss.getId());
    folderRoot.addFile(file);
    DriveApp.getRootFolder().removeFile(file);

    setupFn(ss);

    const sheetDefault = ss.getSheetByName('Sheet1');
    if (sheetDefault) ss.deleteSheet(sheetDefault);

    props.setProperty(propKey, ss.getId());
    return ss.getId();
  } finally {
    if (lock) lock.releaseLock();
  }
}

// ---- Wrapper khusus fitur Pelanggaran (Tahap 1) ----

function getOrProvisionPelanggaranSpreadsheetId(tahunAjaran, sudahDikunci) {
  return getOrProvisionSpreadsheetId(
    PREFIX_PROP_PELANGGARAN_SS + tahunAjaran,
    'Data BK - Pelanggaran ' + tahunAjaran,
    sudahDikunci,
    function (ss) {
      setupSheetPelanggaran(ss);
      setupSheetConfigKategori(ss);
    }
  );
}

function setupSheetPelanggaran(ss) {
  const sheet = ss.insertSheet(SHEET_PELANGGARAN);
  sheet.appendRow([
    'ID Pelanggaran', 'Timestamp', 'NIS', 'Nama Siswa', 'Kelas',
    'Tanggal Kejadian', 'Kategori', 'Tingkat', 'Deskripsi', 'Tindak Lanjut',
    'Status Tindak Lanjut', 'Dilaporkan Oleh', 'Lampiran', 'Status'
  ]);
  sheet.setFrozenRows(1);
}

function setupSheetConfigKategori(ss) {
  const sheet = ss.insertSheet(SHEET_CONFIG_KATEGORI);
  sheet.appendRow(['Nama Kategori', 'Tingkat', 'Aktif']);
  sheet.setFrozenRows(1);
  sheet.appendRow(['Terlambat masuk sekolah', 'Ringan', true]);
  sheet.appendRow(['Tidak mengerjakan tugas', 'Ringan', true]);
  sheet.appendRow(['Membolos', 'Sedang', true]);
  sheet.appendRow(['Berkelahi', 'Berat', true]);
}

// ---- Wrapper khusus fitur Buku Kasus (Tahap 2) ----

function getOrProvisionKasusSpreadsheetId(tahunAjaran, sudahDikunci) {
  return getOrProvisionSpreadsheetId(
    PREFIX_PROP_KASUS_SS + tahunAjaran,
    'Data BK - Kasus ' + tahunAjaran,
    sudahDikunci,
    function (ss) { setupSheetKasus(ss); }
  );
}

function setupSheetKasus(ss) {
  const sheet = ss.insertSheet(SHEET_KASUS);
  sheet.appendRow([
    'ID Kasus', 'Timestamp', 'NIS', 'Nama Siswa', 'Kelas',
    'Tanggal Mulai', 'Kategori', 'Ringkasan', 'Tingkat Kerahasiaan',
    'Status Kasus', 'Tindak Lanjut', 'Dilaporkan Oleh', 'Status'
  ]);
  sheet.setFrozenRows(1);
}

// ---- Wrapper khusus fitur Prestasi Siswa (Tahap 4) ----

function getOrProvisionPrestasiSpreadsheetId(tahunAjaran, sudahDikunci) {
  return getOrProvisionSpreadsheetId(
    PREFIX_PROP_PRESTASI_SS + tahunAjaran,
    'Data BK - Prestasi ' + tahunAjaran,
    sudahDikunci,
    function (ss) { setupSheetPrestasi(ss); }
  );
}

function setupSheetPrestasi(ss) {
  const sheet = ss.insertSheet(SHEET_PRESTASI);
  sheet.appendRow([
    'ID Prestasi', 'Timestamp', 'NIS', 'Nama Siswa', 'Kelas', 'Tanggal',
    'Jenis', 'Tingkat', 'Nama Kegiatan', 'Capaian', 'Dilaporkan Oleh', 'Lampiran', 'Status'
  ]);
  sheet.setFrozenRows(1);
}

// ---- Wrapper khusus fitur Home Visit (Tahap 6) ----

function getOrProvisionHomeVisitSpreadsheetId(tahunAjaran, sudahDikunci) {
  return getOrProvisionSpreadsheetId(
    PREFIX_PROP_HOMEVISIT_SS + tahunAjaran,
    'Data BK - Home Visit ' + tahunAjaran,
    sudahDikunci,
    function (ss) { setupSheetHomeVisit(ss); }
  );
}

function setupSheetHomeVisit(ss) {
  const sheet = ss.insertSheet(SHEET_HOMEVISIT);
  sheet.appendRow([
    'ID', 'Timestamp', 'NIS', 'Nama Siswa', 'Kelas', 'Tanggal Kunjungan',
    'Tujuan', 'Hasil Kunjungan', 'Petugas', 'Tindak Lanjut', 'Status'
  ]);
  sheet.setFrozenRows(1);
}

// ---- Wrapper khusus fitur Dashboard Surat (Tahap 7) ----

function getOrProvisionSuratSpreadsheetId(tahunAjaran, sudahDikunci) {
  return getOrProvisionSpreadsheetId(
    PREFIX_PROP_SURAT_SS + tahunAjaran,
    'Data BK - Surat ' + tahunAjaran,
    sudahDikunci,
    function (ss) {
      setupSheetDataSurat(ss);
      setupSheetConfigJenisSurat(ss);
    }
  );
}

function setupSheetDataSurat(ss) {
  const sheet = ss.insertSheet(SHEET_DATA_SURAT);
  sheet.appendRow([
    'ID', 'Timestamp', 'Jenis Surat', 'Nomor Surat', 'NIS', 'Nama Siswa', 'Kelas',
    'Keperluan', 'Field Tambahan (JSON)', 'Dibuat Oleh', 'Link Dokumen', 'Status'
  ]);
  sheet.setFrozenRows(1);
}

function setupSheetConfigJenisSurat(ss) {
  const sheet = ss.insertSheet(SHEET_CONFIG_JENIS_SURAT);
  sheet.appendRow(['Jenis Surat', 'Template ID', 'Label Keperluan', 'Field Tambahan (JSON)', 'Aktif']);
  sheet.setFrozenRows(1);
  // Baris contoh -- Template ID WAJIB diisi manual (buat Google Docs template dulu,
  // pakai placeholder {{NAMA}}, {{NIS}}, {{KELAS}}, {{KEPERLUAN}}, {{TANGGAL}} dst).
  sheet.appendRow(['Surat Panggilan Orangtua', 'ISI_DENGAN_TEMPLATE_ID', 'Keperluan / Alasan Panggilan', '[]', true]);
  sheet.appendRow(['Surat Teguran Tertulis', 'ISI_DENGAN_TEMPLATE_ID', 'Jenis Pelanggaran', '[]', true]);
  sheet.appendRow(['Surat Peringatan', 'ISI_DENGAN_TEMPLATE_ID', 'Jenis Pelanggaran', '[]', true]);
}
