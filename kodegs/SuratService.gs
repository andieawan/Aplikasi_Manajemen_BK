/**
 * SuratService.gs — mengikuti pola "Config Jenis Surat" (data-driven, bukan
 * hardcode) yang pernah dibuat sebelumnya: tambah jenis surat baru = isi
 * baris di sheet, tanpa sentuh kode. Hanya BK yang bisa generate surat.
 */

function getOrCreateFolderSurat() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(PROP_FOLDER_SURAT_ID);
  if (existingId) {
    try { return DriveApp.getFolderById(existingId); } catch (e) { /* dibuat ulang di bawah */ }
  }
  const folder = getOrCreateRootFolderBK().createFolder('Dokumen Surat');
  props.setProperty(PROP_FOLDER_SURAT_ID, folder.getId());
  return folder;
}

function getJenisSuratAktif(user) {
  if (!hasRole(user, ['bk'])) throw new Error('Akses ditolak.');
  const tahunAjaran = getTahunAjaranAktif();
  const ssId = getOrProvisionSuratSpreadsheetId(tahunAjaran, false);
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_CONFIG_JENIS_SURAT);
  const data = sheet.getDataRange().getValues();
  data.shift();
  return data.filter(function (r) { return r[4] === true; }).map(function (r) {
    return { jenisSurat: r[0], labelKeperluan: r[2], fieldTambahan: JSON.parse(r[3] || '[]') };
  });
}

/**
 * Generate 1 surat dari template. data = { jenisSurat, nis, keperluan, fieldTambahan: {} }
 * Placeholder di template Google Docs: {{NAMA}}, {{NIS}}, {{KELAS}}, {{KEPERLUAN}},
 * {{TANGGAL}}, {{NOMOR_SURAT}}, plus placeholder custom dari fieldTambahan
 * (mis. {{HARI_TANGGAL}}, {{JAM}} -- lihat docPlaceholder di Config Jenis Surat).
 */
function buatSurat(user, data) {
  if (!hasRole(user, ['bk'])) throw new Error('Akses ditolak: hanya BK yang bisa membuat surat.');
  if (!data.jenisSurat || !data.nis) throw new Error('jenisSurat dan nis wajib diisi.');

  const tahunAjaran = getTahunAjaranAktif();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const siswa = cariSiswaByNis(data.nis);
    if (!siswa) throw new Error('NIS tidak ditemukan di Master Siswa.');

    const ssId = getOrProvisionSuratSpreadsheetId(tahunAjaran, true);
    const ss = SpreadsheetApp.openById(ssId);
    const configSheet = ss.getSheetByName(SHEET_CONFIG_JENIS_SURAT);
    const configData = configSheet.getDataRange().getValues();
    let templateId = null;
    for (let i = 1; i < configData.length; i++) {
      if (configData[i][0] === data.jenisSurat && configData[i][4] === true) { templateId = configData[i][1]; break; }
    }
    if (!templateId || templateId.indexOf('ISI_DENGAN') === 0) {
      throw new Error('Template ID untuk jenis surat "' + data.jenisSurat + '" belum diisi di sheet Config Jenis Surat.');
    }

    const nomorSurat = ambilNomorSuratBerikutnya(ss, tahunAjaran);
    const tanggalSekarang = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMMM yyyy');

    const folder = getOrCreateFolderSurat();
    const salinan = DriveApp.getFileById(templateId).makeCopy(
      data.jenisSurat + ' - ' + siswa.nama + ' - ' + nomorSurat, folder
    );
    const doc = DocumentApp.openById(salinan.getId());
    const body = doc.getBody();
    body.replaceText('{{NAMA}}', siswa.nama);
    body.replaceText('{{NIS}}', siswa.nis);
    body.replaceText('{{KELAS}}', siswa.kelas);
    body.replaceText('{{KEPERLUAN}}', data.keperluan || '');
    body.replaceText('{{TANGGAL}}', tanggalSekarang);
    body.replaceText('{{NOMOR_SURAT}}', nomorSurat);
    Object.keys(data.fieldTambahan || {}).forEach(function (key) {
      body.replaceText('{{' + key.toUpperCase() + '}}', String(data.fieldTambahan[key]));
    });
    doc.saveAndClose();

    const sheet = ss.getSheetByName(SHEET_DATA_SURAT);
    const id = 'SRT-' + new Date().getTime();
    sheet.appendRow([
      id, new Date(), data.jenisSurat, nomorSurat, siswa.nis, siswa.nama, siswa.kelas,
      data.keperluan || '', JSON.stringify(data.fieldTambahan || {}), user.username,
      salinan.getUrl(), '', 'Proses', 'Aktif'
    ]);
    return { id: id, nomorSurat: nomorSurat, linkDokumen: salinan.getUrl() };
  } finally {
    lock.releaseLock();
  }
}

/** Ubah status penanganan (Proses/Selesai) 1 surat. Hanya BK. */
function updateStatusPenangananSurat(user, idSurat, statusBaru) {
  if (!hasRole(user, ['bk'])) throw new Error('Akses ditolak: hanya BK yang bisa mengubah status penanganan.');
  if (['Proses', 'Selesai'].indexOf(statusBaru) === -1) {
    throw new Error('Status tidak valid. Harus "Proses" atau "Selesai".');
  }

  const tahunAjaran = getTahunAjaranAktif();
  const ssId = getOrProvisionSuratSpreadsheetId(tahunAjaran, false);
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_DATA_SURAT);
  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL_SURAT.ID] === idSurat) { rowIndex = i + 1; break; }
  }
  if (rowIndex === -1) throw new Error('Data surat tidak ditemukan.');

  sheet.getRange(rowIndex, COL_SURAT.STATUS_PENANGANAN + 1).setValue(statusBaru);
  return { ok: true };
}

function getOrCreateFolderBerkasTtd() {
  const props = PropertiesService.getScriptProperties();
  const key = 'FOLDER_BERKAS_TTD_SURAT_ID';
  const existingId = props.getProperty(key);
  if (existingId) {
    try { return DriveApp.getFolderById(existingId); } catch (e) { /* dibuat ulang di bawah */ }
  }
  const folder = getOrCreateFolderSurat().createFolder('Berkas Tanda Tangan (Scan)');
  props.setProperty(key, folder.getId());
  return folder;
}

/**
 * Upload scan surat yang SUDAH dicetak, ditandatangani, lalu di-scan --
 * jadi backup digital, ditautkan ke record surat aslinya. Hanya BK.
 *
 * fileBase64: konten file dalam base64 (TANPA prefix "data:...;base64,"
 * -- itu harus sudah dipotong di sisi frontend sebelum dikirim).
 */
function uploadBerkasSurat(user, idSurat, fileBase64, namaFile, mimeType) {
  if (!hasRole(user, ['bk'])) throw new Error('Akses ditolak: hanya BK yang bisa upload berkas.');
  if (!idSurat || !fileBase64 || !namaFile) {
    throw new Error('Data tidak lengkap: idSurat, fileBase64, namaFile wajib diisi.');
  }

  const tahunAjaran = getTahunAjaranAktif();
  const ssId = getOrProvisionSuratSpreadsheetId(tahunAjaran, false);
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_DATA_SURAT);
  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL_SURAT.ID] === idSurat) { rowIndex = i + 1; break; }
  }
  if (rowIndex === -1) throw new Error('Data surat tidak ditemukan.');

  let bytes;
  try {
    bytes = Utilities.base64Decode(fileBase64);
  } catch (e) {
    throw new Error('File tidak valid (gagal decode base64).');
  }

  const blob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', namaFile);
  const folder = getOrCreateFolderBerkasTtd();
  const file = folder.createFile(blob);

  sheet.getRange(rowIndex, COL_SURAT.LINK_BERKAS_SCAN + 1).setValue(file.getUrl());
  return { ok: true, linkBerkasScan: file.getUrl() };
}

function ambilNomorSuratBerikutnya(ss, tahunAjaran) {
  const props = PropertiesService.getScriptProperties();
  const propKey = 'SURAT_COUNTER_' + tahunAjaran;
  const nomorSekarang = Number(props.getProperty(propKey) || '0') + 1;
  props.setProperty(propKey, String(nomorSekarang));
  return nomorSekarang + '/BK/' + tahunAjaran;
}

function getRiwayatSurat(user, nis) {
  if (!hasRole(user, ['bk', 'kepsek'])) throw new Error('Akses ditolak.');
  const tahunAjaran = getTahunAjaranAktif();
  const ssId = getOrProvisionSuratSpreadsheetId(tahunAjaran, false);
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_DATA_SURAT);
  const data = sheet.getDataRange().getValues();
  data.shift();

  return data
    .filter(function (row) { return (!nis || row[COL_SURAT.NIS] === nis) && row[COL_SURAT.STATUS] === 'Aktif'; })
    .map(function (row) {
      return {
        id: row[COL_SURAT.ID],
        jenisSurat: row[COL_SURAT.JENIS_SURAT],
        nomorSurat: row[COL_SURAT.NOMOR_SURAT],
        nis: row[COL_SURAT.NIS],
        nama: row[COL_SURAT.NAMA],
        kelas: row[COL_SURAT.KELAS],
        keperluan: row[COL_SURAT.KEPERLUAN],
        dibuatOleh: row[COL_SURAT.DIBUAT_OLEH],
        linkDokumen: row[COL_SURAT.LINK_DOKUMEN],
        linkBerkasScan: row[COL_SURAT.LINK_BERKAS_SCAN] || '',
        statusPenanganan: row[COL_SURAT.STATUS_PENANGANAN] || 'Proses'
      };
    });
}
