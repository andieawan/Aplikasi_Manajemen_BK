/** HomeVisitService.gs — akses sama seperti Pelanggaran: BK full, Wali Kelas & Kepsek read-only. */

function tambahHomeVisit(user, data) {
  if (!hasRole(user, ['bk'])) throw new Error('Akses ditolak: hanya BK yang bisa menambah Home Visit.');
  if (!data.nis || !data.tanggalKunjungan || !data.tujuan) {
    throw new Error('Data tidak lengkap: nis, tanggalKunjungan, tujuan wajib diisi.');
  }

  const tahunAjaran = getTahunAjaranAktif();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const siswa = cariSiswaByNis(data.nis);
    if (!siswa) throw new Error('NIS tidak ditemukan di Master Siswa.');

    const ssId = getOrProvisionHomeVisitSpreadsheetId(tahunAjaran, true);
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName(SHEET_HOMEVISIT);

    const id = 'HV-' + new Date().getTime();
    sheet.appendRow([
      id, new Date(), siswa.nis, siswa.nama, siswa.kelas, data.tanggalKunjungan,
      data.tujuan, data.hasilKunjungan || '', user.username, data.tindakLanjut || '', 'Aktif'
    ]);
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

function updateHomeVisit(user, id, data) {
  if (!hasRole(user, ['bk'])) throw new Error('Akses ditolak.');
  const tahunAjaran = getTahunAjaranAktif();
  const ssId = getOrProvisionHomeVisitSpreadsheetId(tahunAjaran, false);
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_HOMEVISIT);
  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL_HOMEVISIT.ID] === id) { rowIndex = i + 1; break; }
  }
  if (rowIndex === -1) throw new Error('ID Home Visit tidak ditemukan.');

  if (data.hasilKunjungan !== undefined) sheet.getRange(rowIndex, COL_HOMEVISIT.HASIL_KUNJUNGAN + 1).setValue(data.hasilKunjungan);
  if (data.tindakLanjut !== undefined) sheet.getRange(rowIndex, COL_HOMEVISIT.TINDAK_LANJUT + 1).setValue(data.tindakLanjut);
  return { ok: true };
}

function getHomeVisitSiswa(user, nis) {
  const siswa = cariSiswaByNis(nis);
  if (!siswa) throw new Error('NIS tidak ditemukan.');
  if (!hasRole(user, ['bk', 'kepsek']) && !isWaliKelasDari(user, siswa.kelas)) throw new Error('Akses ditolak.');
  return ambilBarisHomeVisit(function (row) {
    return row[COL_HOMEVISIT.NIS] === nis && row[COL_HOMEVISIT.STATUS] === 'Aktif';
  });
}

function getHomeVisitKelas(user, kelas) {
  if (!hasRole(user, ['bk', 'kepsek']) && !isWaliKelasDari(user, kelas)) throw new Error('Akses ditolak.');
  return ambilBarisHomeVisit(function (row) {
    return row[COL_HOMEVISIT.KELAS] === kelas && row[COL_HOMEVISIT.STATUS] === 'Aktif';
  });
}

function getAllHomeVisit(user) {
  if (!hasRole(user, ['bk', 'kepsek'])) throw new Error('Akses ditolak.');
  return ambilBarisHomeVisit(function (row) { return row[COL_HOMEVISIT.STATUS] === 'Aktif'; });
}

function ambilBarisHomeVisit(filterFn) {
  const tahunAjaran = getTahunAjaranAktif();
  const ssId = getOrProvisionHomeVisitSpreadsheetId(tahunAjaran, false);
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_HOMEVISIT);
  const data = sheet.getDataRange().getValues();
  data.shift();

  return data.filter(filterFn).map(function (row) {
    return {
      id: row[COL_HOMEVISIT.ID],
      nis: row[COL_HOMEVISIT.NIS],
      nama: row[COL_HOMEVISIT.NAMA],
      kelas: row[COL_HOMEVISIT.KELAS],
      tanggalKunjungan: row[COL_HOMEVISIT.TANGGAL_KUNJUNGAN],
      tujuan: row[COL_HOMEVISIT.TUJUAN],
      hasilKunjungan: row[COL_HOMEVISIT.HASIL_KUNJUNGAN],
      petugas: row[COL_HOMEVISIT.PETUGAS],
      tindakLanjut: row[COL_HOMEVISIT.TINDAK_LANJUT]
    };
  });
}
