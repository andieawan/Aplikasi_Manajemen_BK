/**
 * PrestasiService.gs
 * Akses tambah: BK & Wali Kelas (ASUMSI -- beda dari Pelanggaran/Kasus yang
 * cuma BK, karena sifatnya positif/pelaporan capaian, wajar kalau wali
 * kelas ikut mencatat. Sesuaikan hasRole() di bawah kalau ternyata
 * seharusnya BK-only juga).
 * Akses lihat: BK, Wali Kelas (kelasnya), Kepsek -- semua read, semua kelas
 * untuk BK/Kepsek.
 */

function tambahPrestasi(user, data) {
  const izinBK = hasRole(user, ['bk']);
  if (!data.nis || !data.tanggal || !data.jenis || !data.tingkat || !data.namaKegiatan || !data.capaian) {
    throw new Error('Data tidak lengkap: nis, tanggal, jenis, tingkat, namaKegiatan, capaian wajib diisi.');
  }

  const tahunAjaran = getTahunAjaranAktif();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const siswa = cariSiswaByNis(data.nis);
    if (!siswa) throw new Error('NIS tidak ditemukan di Master Siswa.');

    if (!izinBK && !isWaliKelasDari(user, siswa.kelas)) {
      throw new Error('Akses ditolak: hanya BK atau Wali Kelas siswa tsb yang bisa menambah prestasi.');
    }

    const ssId = getOrProvisionPrestasiSpreadsheetId(tahunAjaran, true);
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName(SHEET_PRESTASI);

    const id = 'PRS-' + new Date().getTime();
    sheet.appendRow([
      id, new Date(), siswa.nis, siswa.nama, siswa.kelas, data.tanggal,
      data.jenis, data.tingkat, data.namaKegiatan, data.capaian,
      user.username, data.lampiran || '', 'Aktif'
    ]);
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

function getPrestasiSiswa(user, nis) {
  const siswa = cariSiswaByNis(nis);
  if (!siswa) throw new Error('NIS tidak ditemukan.');
  if (!hasRole(user, ['bk', 'kepsek']) && !isWaliKelasDari(user, siswa.kelas)) {
    throw new Error('Akses ditolak.');
  }
  return ambilBarisPrestasi(function (row) {
    return row[COL_PRESTASI.NIS] === nis && row[COL_PRESTASI.STATUS] === 'Aktif';
  });
}

function getPrestasiKelas(user, kelas) {
  if (!hasRole(user, ['bk', 'kepsek']) && !isWaliKelasDari(user, kelas)) {
    throw new Error('Akses ditolak.');
  }
  return ambilBarisPrestasi(function (row) {
    return row[COL_PRESTASI.KELAS] === kelas && row[COL_PRESTASI.STATUS] === 'Aktif';
  });
}

function getAllPrestasi(user) {
  if (!hasRole(user, ['bk', 'kepsek'])) throw new Error('Akses ditolak.');
  return ambilBarisPrestasi(function (row) { return row[COL_PRESTASI.STATUS] === 'Aktif'; });
}

function ambilBarisPrestasi(filterFn) {
  const tahunAjaran = getTahunAjaranAktif();
  const ssId = getOrProvisionPrestasiSpreadsheetId(tahunAjaran, false);
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_PRESTASI);
  const data = sheet.getDataRange().getValues();
  data.shift();

  return data.filter(filterFn).map(function (row) {
    return {
      id: row[COL_PRESTASI.ID],
      nis: row[COL_PRESTASI.NIS],
      nama: row[COL_PRESTASI.NAMA],
      kelas: row[COL_PRESTASI.KELAS],
      tanggal: row[COL_PRESTASI.TANGGAL],
      jenis: row[COL_PRESTASI.JENIS],
      tingkat: row[COL_PRESTASI.TINGKAT],
      namaKegiatan: row[COL_PRESTASI.NAMA_KEGIATAN],
      capaian: row[COL_PRESTASI.CAPAIAN],
      dilaporkanOleh: row[COL_PRESTASI.DILAPORKAN_OLEH],
      lampiran: row[COL_PRESTASI.LAMPIRAN]
    };
  });
}
