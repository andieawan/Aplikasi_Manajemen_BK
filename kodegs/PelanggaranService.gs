/**
 * PelanggaranService.gs
 * Role akses: BK (full) > Wali Kelas (read-only, kelasnya sendiri) >
 * Kepsek (read-only, semua) > selain itu ditolak.
 */

/** Tambah catatan pelanggaran baru. Hanya role 'bk'. */
function tambahPelanggaran(user, data) {
  if (!hasRole(user, ['bk'])) {
    throw new Error('Akses ditolak: hanya BK yang bisa menambah pelanggaran.');
  }
  if (!data.nis || !data.tanggalKejadian || !data.kategori || !data.deskripsi) {
    throw new Error('Data tidak lengkap: nis, tanggalKejadian, kategori, deskripsi wajib diisi.');
  }

  const tahunAjaran = getTahunAjaranAktif();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ssId = getOrProvisionPelanggaranSpreadsheetId(tahunAjaran, true);
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName(SHEET_PELANGGARAN);

    const siswa = cariSiswaByNis(data.nis);
    if (!siswa) throw new Error('NIS tidak ditemukan di Master Siswa.');

    const kategoriInfo = cariKategoriByNama(ss, data.kategori);
    if (!kategoriInfo) throw new Error('Kategori pelanggaran tidak ditemukan/tidak aktif: ' + data.kategori);

    const id = 'PLG-' + new Date().getTime();
    sheet.appendRow([
      id,
      new Date(),
      siswa.nis,
      siswa.nama,
      siswa.kelas,
      data.tanggalKejadian,
      data.kategori,
      kategoriInfo.tingkat,
      data.deskripsi,
      data.tindakLanjut || '',
      data.tindakLanjut ? 'Selesai' : 'Proses',
      user.username,
      data.lampiran || '',
      'Aktif'
    ]);
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

/** Update tindak lanjut & status. Hanya role 'bk'. */
function updateStatusTindakLanjut(user, idPelanggaran, tindakLanjutBaru, statusBaru) {
  if (!hasRole(user, ['bk'])) {
    throw new Error('Akses ditolak: hanya BK yang bisa mengubah tindak lanjut.');
  }
  const tahunAjaran = getTahunAjaranAktif();
  const ssId = getOrProvisionPelanggaranSpreadsheetId(tahunAjaran, false);
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_PELANGGARAN);

  const rowIndex = cariBarisById(sheet, idPelanggaran);
  if (rowIndex === -1) throw new Error('ID Pelanggaran tidak ditemukan.');

  sheet.getRange(rowIndex, COL_PELANGGARAN.TINDAK_LANJUT + 1).setValue(tindakLanjutBaru);
  sheet.getRange(rowIndex, COL_PELANGGARAN.STATUS_TINDAK_LANJUT + 1).setValue(statusBaru);
  return { ok: true };
}

/** Ambil riwayat pelanggaran 1 siswa. BK, Wali Kelas (kelasnya), Kepsek. */
function getPelanggaranSiswa(user, nis) {
  const siswa = cariSiswaByNis(nis);
  if (!siswa) throw new Error('NIS tidak ditemukan.');

  const izinBK = hasRole(user, ['bk']);
  const izinKepsek = hasRole(user, ['kepsek']);
  const izinWali = isWaliKelasDari(user, siswa.kelas);
  if (!izinBK && !izinKepsek && !izinWali) {
    throw new Error('Akses ditolak.');
  }

  return ambilBarisPelanggaran(function (row) {
    return row[COL_PELANGGARAN.NIS] === nis && row[COL_PELANGGARAN.STATUS] === 'Aktif';
  });
}

/** Ambil semua pelanggaran 1 kelas. Wali Kelas (kelasnya sendiri), BK, Kepsek. */
function getPelanggaranKelas(user, kelas) {
  const izinBK = hasRole(user, ['bk']);
  const izinKepsek = hasRole(user, ['kepsek']);
  const izinWali = isWaliKelasDari(user, kelas);
  if (!izinBK && !izinKepsek && !izinWali) {
    throw new Error('Akses ditolak.');
  }

  return ambilBarisPelanggaran(function (row) {
    return row[COL_PELANGGARAN.KELAS] === kelas && row[COL_PELANGGARAN.STATUS] === 'Aktif';
  });
}

/** Ambil semua pelanggaran (rekap/dashboard). Hanya BK & Kepsek. */
function getAllPelanggaran(user) {
  if (!hasRole(user, ['bk', 'kepsek'])) {
    throw new Error('Akses ditolak.');
  }
  return ambilBarisPelanggaran(function (row) {
    return row[COL_PELANGGARAN.STATUS] === 'Aktif';
  });
}

/** Ambil daftar kategori pelanggaran yang aktif (untuk dropdown form). */
function getKategoriAktif(user) {
  if (!hasRole(user, ['bk', 'kepsek'])) {
    throw new Error('Akses ditolak.');
  }
  const tahunAjaran = getTahunAjaranAktif();
  const ssId = getOrProvisionPelanggaranSpreadsheetId(tahunAjaran, false);
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_CONFIG_KATEGORI);
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data
    .filter(function (row) { return row[2] === true; }) // kolom Aktif
    .map(function (row) { return { nama: row[0], tingkat: row[1] }; });
}

// ---- Helper internal ----

function cariKategoriByNama(ss, nama) {
  const sheet = ss.getSheetByName(SHEET_CONFIG_KATEGORI);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === nama && data[i][2] === true) {
      return { nama: data[i][0], tingkat: data[i][1] };
    }
  }
  return null;
}

function ambilBarisPelanggaran(filterFn) {
  const tahunAjaran = getTahunAjaranAktif();
  const ssId = getOrProvisionPelanggaranSpreadsheetId(tahunAjaran, false);
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_PELANGGARAN);
  const data = sheet.getDataRange().getValues();
  data.shift(); // buang header

  return data.filter(filterFn).map(function (row) {
    return {
      id: row[COL_PELANGGARAN.ID],
      timestamp: row[COL_PELANGGARAN.TIMESTAMP],
      nis: row[COL_PELANGGARAN.NIS],
      nama: row[COL_PELANGGARAN.NAMA],
      kelas: row[COL_PELANGGARAN.KELAS],
      tanggalKejadian: row[COL_PELANGGARAN.TANGGAL_KEJADIAN],
      kategori: row[COL_PELANGGARAN.KATEGORI],
      tingkat: row[COL_PELANGGARAN.TINGKAT],
      deskripsi: row[COL_PELANGGARAN.DESKRIPSI],
      tindakLanjut: row[COL_PELANGGARAN.TINDAK_LANJUT],
      statusTindakLanjut: row[COL_PELANGGARAN.STATUS_TINDAK_LANJUT],
      dilaporkanOleh: row[COL_PELANGGARAN.DILAPORKAN_OLEH],
      lampiran: row[COL_PELANGGARAN.LAMPIRAN]
    };
  });
}

function cariBarisById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL_PELANGGARAN.ID] === id) return i + 1; // 1-indexed untuk Range
  }
  return -1;
}
