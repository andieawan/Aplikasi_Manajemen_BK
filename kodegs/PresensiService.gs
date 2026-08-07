/**
 * PresensiService.gs
 *
 * BERGANTUNG PADA go_absen_siswa: action 'getAbsenUntukBK' -- kode & cara
 * pasangnya ada di go_absen_siswa_repo/BKIntegrasi.gs (file baru) +
 * TAMBAHAN_ROUTER.txt (potongan untuk Router.gs mereka). SUDAH DIBUAT,
 * tinggal user paste ke project go_absen_siswa.
 *
 * KHUSUS ALPA -- "Telat" belum tercatat sebagai status terpisah di
 * go_absen_siswa (cuma ada Hadir/Izin/Sakit/Alpa), dan sesuai keputusan,
 * keterlambatan dicek manual/terpisah oleh BK, tidak lewat integrasi ini.
 *
 * Kontrak (skema respons go_absen_siswa: {success, message, data} --
 * BUKAN {data, error} seperti punya BK sendiri):
 *   Request:  { action: 'getAbsenUntukBK', username, token, kelas }
 *   Response: { success: true, data: [ { nis, nama, jumlahHadir,
 *               jumlahIzin, jumlahSakit, jumlahAlpa } ] }
 */

/** Ambil/atur threshold alpa (kebijakan sekolah). Hanya BK/superadmin. */
function getThresholdAlpa() {
  const props = PropertiesService.getScriptProperties();
  const nilai = props.getProperty(PROP_THRESHOLD_ALPA);
  return nilai ? Number(nilai) : DEFAULT_THRESHOLD_ALPA;
}

function setThresholdAlpa(user, angkaBaru) {
  if (!hasRole(user, ['bk'])) throw new Error('Akses ditolak: hanya BK yang bisa mengubah threshold.');
  if (!Number.isFinite(angkaBaru) || angkaBaru < 1) throw new Error('Threshold harus angka positif.');
  PropertiesService.getScriptProperties().setProperty(PROP_THRESHOLD_ALPA, String(angkaBaru));
  return { ok: true, threshold: angkaBaru };
}

/**
 * Ambil siswa "perlu perhatian" (alpa >= threshold) di 1 kelas, lewat
 * UrlFetchApp ke go_absen_siswa. BK, Wali Kelas (kelasnya), Kepsek.
 */
function getSiswaPerluPerhatian(user, kelas) {
  const izinBK = hasRole(user, ['bk']);
  const izinKepsek = hasRole(user, ['kepsek']);
  const izinWali = isWaliKelasDari(user, kelas);
  if (!izinBK && !izinKepsek && !izinWali) throw new Error('Akses ditolak.');

  const urlGoAbsenSiswa = getBackendUrlGoAbsenSiswa();
  if (!urlGoAbsenSiswa) {
    throw new Error('BACKEND_URL_GO_ABSEN_SISWA belum diisi -- jalankan setupConfigBK() dulu (lihat Config.gs).');
  }

  const threshold = getThresholdAlpa();
  const res = UrlFetchApp.fetch(urlGoAbsenSiswa, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      action: 'getAbsenUntukBK',
      username: user.username,
      token: user._tokenAsli, // lihat catatan di getSessionUser() (Auth.gs) soal field ini
      kelas: kelas
    }),
    muteHttpExceptions: true
  });

  const json = JSON.parse(res.getContentText());
  if (!json.success) throw new Error('go_absen_siswa: ' + (json.message || 'Gagal mengambil data.'));

  return (json.data || []).filter(function (s) {
    return s.jumlahAlpa >= threshold;
  });
}

/**
 * Simpan absensi manual 1 kelas untuk 1 tanggal, lewat UrlFetchApp ke
 * go_absen_siswa (action 'simpanAbsenUntukBK' -- lihat catatan kontrak
 * di go_absen_siswa_repo/BKIntegrasi.gs). Data masuk ke sistem absensi
 * go_absen_siswa langsung (bukan disimpan terpisah di BK), supaya tetap
 * 1 sumber kebenaran. Hanya BK.
 *
 * dataKehadiran: [{ nis, status }], status salah satu dari 'H'/'I'/'S'/'A'.
 */
function simpanAbsenManualBK(user, kelas, tanggal, dataKehadiran) {
  if (!hasRole(user, ['bk'])) throw new Error('Akses ditolak: hanya BK yang bisa input absensi manual.');
  if (!kelas || !tanggal || !Array.isArray(dataKehadiran) || !dataKehadiran.length) {
    throw new Error('Data tidak lengkap: kelas, tanggal, dataKehadiran wajib diisi.');
  }

  const urlGoAbsenSiswa = getBackendUrlGoAbsenSiswa();
  if (!urlGoAbsenSiswa) {
    throw new Error('BACKEND_URL_GO_ABSEN_SISWA belum diisi (jalankan setupConfigBK()).');
  }

  const res = UrlFetchApp.fetch(urlGoAbsenSiswa, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      action: 'simpanAbsenUntukBK',
      username: user.username,
      token: user._tokenAsli,
      kelas: kelas,
      tanggal: tanggal,
      dataKehadiran: dataKehadiran
    }),
    muteHttpExceptions: true
  });

  const json = JSON.parse(res.getContentText());
  if (!json.success) throw new Error('go_absen_siswa: ' + (json.message || 'Gagal menyimpan absensi.'));
  return { ok: true };
}
