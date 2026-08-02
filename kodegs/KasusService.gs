/**
 * KasusService.gs
 * Role akses: BK (full, selalu lihat detail lengkap) > Wali Kelas (read-only,
 * kelasnya sendiri) > Kepsek (read-only, semua) > selain itu ditolak.
 *
 * ATURAN KERAHASIAAN: kalau tingkatKerahasiaan === 'Sangat Rahasia', Wali
 * Kelas & Kepsek HANYA melihat versi ringkas (ada kasus aktif atau tidak),
 * TANPA kategori/ringkasan/tindak lanjut. BK selalu melihat detail penuh.
 */

/** Tambah kasus baru. Hanya role 'bk'. */
function tambahKasus(user, data) {
  if (!hasRole(user, ['bk'])) {
    throw new Error('Akses ditolak: hanya BK yang bisa menambah kasus.');
  }
  if (!data.nis || !data.tanggalMulai || !data.kategori || !data.ringkasan) {
    throw new Error('Data tidak lengkap: nis, tanggalMulai, kategori, ringkasan wajib diisi.');
  }

  const tahunAjaran = getTahunAjaranAktif();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ssId = getOrProvisionKasusSpreadsheetId(tahunAjaran, true);
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName(SHEET_KASUS);

    const siswa = cariSiswaByNis(data.nis);
    if (!siswa) throw new Error('NIS tidak ditemukan di Master Siswa.');

    const tingkatKerahasiaan = data.tingkatKerahasiaan === 'Sangat Rahasia' ? 'Sangat Rahasia' : 'Normal';

    const id = 'KSS-' + new Date().getTime();
    sheet.appendRow([
      id,
      new Date(),
      siswa.nis,
      siswa.nama,
      siswa.kelas,
      data.tanggalMulai,
      data.kategori,
      data.ringkasan,
      tingkatKerahasiaan,
      'Aktif',
      data.tindakLanjut || '',
      user.username,
      'Aktif'
    ]);
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

/** Update kasus (ringkasan, status, tindak lanjut, tingkat kerahasiaan). Hanya BK. */
function updateKasus(user, idKasus, data) {
  if (!hasRole(user, ['bk'])) {
    throw new Error('Akses ditolak: hanya BK yang bisa mengubah kasus.');
  }
  const tahunAjaran = getTahunAjaranAktif();
  const ssId = getOrProvisionKasusSpreadsheetId(tahunAjaran, false);
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_KASUS);

  const rowIndex = cariBarisByIdKasus(sheet, idKasus);
  if (rowIndex === -1) throw new Error('ID Kasus tidak ditemukan.');

  if (data.ringkasan !== undefined) sheet.getRange(rowIndex, COL_KASUS.RINGKASAN + 1).setValue(data.ringkasan);
  if (data.statusKasus !== undefined) sheet.getRange(rowIndex, COL_KASUS.STATUS_KASUS + 1).setValue(data.statusKasus);
  if (data.tindakLanjut !== undefined) sheet.getRange(rowIndex, COL_KASUS.TINDAK_LANJUT + 1).setValue(data.tindakLanjut);
  if (data.tingkatKerahasiaan !== undefined) {
    const nilai = data.tingkatKerahasiaan === 'Sangat Rahasia' ? 'Sangat Rahasia' : 'Normal';
    sheet.getRange(rowIndex, COL_KASUS.TINGKAT_KERAHASIAAN + 1).setValue(nilai);
  }
  return { ok: true };
}

/** Ambil kasus 1 siswa. BK (full), Wali Kelas (kelasnya, versi sesuai kerahasiaan), Kepsek (versi sesuai kerahasiaan). */
function getKasusSiswa(user, nis) {
  const siswa = cariSiswaByNis(nis);
  if (!siswa) throw new Error('NIS tidak ditemukan.');

  const izinBK = hasRole(user, ['bk']);
  const izinKepsek = hasRole(user, ['kepsek']);
  const izinWali = isWaliKelasDari(user, siswa.kelas);
  if (!izinBK && !izinKepsek && !izinWali) {
    throw new Error('Akses ditolak.');
  }

  const rows = ambilBarisKasus(function (row) {
    return row[COL_KASUS.NIS] === nis && row[COL_KASUS.STATUS] === 'Aktif';
  });
  return izinBK ? rows : rows.map(sanitasiUntukViewerNonBK);
}

/** Ambil semua kasus 1 kelas. Wali Kelas (kelasnya), BK, Kepsek. */
function getKasusKelas(user, kelas) {
  const izinBK = hasRole(user, ['bk']);
  const izinKepsek = hasRole(user, ['kepsek']);
  const izinWali = isWaliKelasDari(user, kelas);
  if (!izinBK && !izinKepsek && !izinWali) {
    throw new Error('Akses ditolak.');
  }

  const rows = ambilBarisKasus(function (row) {
    return row[COL_KASUS.KELAS] === kelas && row[COL_KASUS.STATUS] === 'Aktif';
  });
  return izinBK ? rows : rows.map(sanitasiUntukViewerNonBK);
}

/** Ambil semua kasus (rekap/dashboard). BK (full) & Kepsek (versi sesuai kerahasiaan). */
function getAllKasus(user) {
  if (!hasRole(user, ['bk', 'kepsek'])) {
    throw new Error('Akses ditolak.');
  }
  const izinBK = hasRole(user, ['bk']);
  const rows = ambilBarisKasus(function (row) {
    return row[COL_KASUS.STATUS] === 'Aktif';
  });
  return izinBK ? rows : rows.map(sanitasiUntukViewerNonBK);
}

// ---- Helper internal ----

/**
 * Kalau tingkatKerahasiaan = 'Sangat Rahasia', sembunyikan kategori/
 * ringkasan/tindak lanjut dari Wali Kelas & Kepsek -- cuma sisakan
 * penanda "ada kasus aktif" (sesuai keputusan: siswa tetap percaya BK
 * sebagai ruang aman).
 */
function sanitasiUntukViewerNonBK(kasus) {
  if (kasus.tingkatKerahasiaan !== 'Sangat Rahasia') return kasus;
  return {
    id: kasus.id,
    nis: kasus.nis,
    nama: kasus.nama,
    kelas: kasus.kelas,
    tingkatKerahasiaan: 'Sangat Rahasia',
    adaKasusAktif: true,
    statusKasus: kasus.statusKasus
    // kategori, ringkasan, tindakLanjut, dilaporkanOleh SENGAJA tidak disertakan.
  };
}

function ambilBarisKasus(filterFn) {
  const tahunAjaran = getTahunAjaranAktif();
  const ssId = getOrProvisionKasusSpreadsheetId(tahunAjaran, false);
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_KASUS);
  const data = sheet.getDataRange().getValues();
  data.shift();

  return data.filter(filterFn).map(function (row) {
    return {
      id: row[COL_KASUS.ID],
      timestamp: row[COL_KASUS.TIMESTAMP],
      nis: row[COL_KASUS.NIS],
      nama: row[COL_KASUS.NAMA],
      kelas: row[COL_KASUS.KELAS],
      tanggalMulai: row[COL_KASUS.TANGGAL_MULAI],
      kategori: row[COL_KASUS.KATEGORI],
      ringkasan: row[COL_KASUS.RINGKASAN],
      tingkatKerahasiaan: row[COL_KASUS.TINGKAT_KERAHASIAAN],
      statusKasus: row[COL_KASUS.STATUS_KASUS],
      tindakLanjut: row[COL_KASUS.TINDAK_LANJUT],
      dilaporkanOleh: row[COL_KASUS.DILAPORKAN_OLEH]
    };
  });
}

function cariBarisByIdKasus(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL_KASUS.ID] === id) return i + 1;
  }
  return -1;
}
