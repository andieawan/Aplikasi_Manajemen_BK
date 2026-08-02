/**
 * PresensiService.gs
 *
 * !! BERGANTUNG PADA go_absen_siswa !!
 * Fitur ini butuh 1 action baru read-only di go_absen_siswa/kodegs/Router.gs
 * bernama 'getAbsenUntukBK' yang BELUM DIBUAT (lihat Briefing-Aplikasi-BK.md
 * bagian 2). Kontrak yang DIASUMSIKAN di sini (perlu dikonfirmasi/disesuaikan
 * saat action itu benar-benar dibuat di go_absen_siswa):
 *
 *   Request ke BACKEND_URL_GO_ABSEN_SISWA:
 *     { action: 'getAbsenUntukBK', username, token, kelas, tahunAjaran }
 *   Response diharapkan:
 *     { data: [ { nis, nama, jumlahAlpa, jumlahTelat, jumlahIzin, jumlahSakit } ] }
 *
 * Otorisasi: go_absen_siswa perlu mengecek role 'bk' di token pemanggil
 * (lihat catatan "otorisasi khusus" di briefing) -- BK app di sini cukup
 * meneruskan username+token milik user yang sedang login (sama seperti
 * yang dipakai app BK sendiri untuk verifikasi via SSO cookie).
 */

/** Ambil/atur threshold alpa (kebijakan sekolah, masih pertanyaan terbuka). Hanya BK. */
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
 * Ambil siswa "perlu perhatian" (alpa/telat >= threshold) di 1 kelas, lewat
 * UrlFetchApp ke go_absen_siswa. BK, Wali Kelas (kelasnya), Kepsek.
 */
function getSiswaPerluPerhatian(user, kelas) {
  const izinBK = hasRole(user, ['bk']);
  const izinKepsek = hasRole(user, ['kepsek']);
  const izinWali = isWaliKelasDari(user, kelas);
  if (!izinBK && !izinKepsek && !izinWali) throw new Error('Akses ditolak.');

  const urlGoAbsenSiswa = getBackendUrlGoAbsenSiswa();
  if (!urlGoAbsenSiswa) {
    throw new Error(
      'BACKEND_URL_GO_ABSEN_SISWA belum diisi (jalankan setupConfigBK()), dan action getAbsenUntukBK belum dibuat di go_absen_siswa. ' +
      'Fitur Presensi & Keterlambatan belum bisa berfungsi sampai kedua hal itu selesai (lihat catatan di atas file ini).'
    );
  }

  const threshold = getThresholdAlpa();
  const res = UrlFetchApp.fetch(urlGoAbsenSiswa, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      action: 'getAbsenUntukBK',
      username: user.username,
      token: user._tokenAsli, // lihat catatan di getSessionUser() soal field ini
      kelas: kelas,
      tahunAjaran: getTahunAjaranAktif()
    }),
    muteHttpExceptions: true
  });

  const json = JSON.parse(res.getContentText());
  if (json.error) throw new Error('go_absen_siswa: ' + json.error);

  return (json.data || []).filter(function (s) {
    return s.jumlahAlpa >= threshold || s.jumlahTelat >= threshold;
  });
}
