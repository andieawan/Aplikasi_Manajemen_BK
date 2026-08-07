/**
 * Router.gs — entry point Web App.
 * Pola sama dengan go_absen_siswa: 1 endpoint doPost, routing berdasarkan
 * field 'action' di body JSON, dipanggil dari frontend lewat postJson().
 */

// Naikkan nilai ini SETIAP KALI push kode baru (tanggal + huruf urut cukup).
// Ditampilkan di footer Dashboard -- cara cepat mengecek apakah Web App yang
// aktif sekarang sudah menjalankan kode terbaru, tanpa perlu buka DevTools.
// Kalau versi yang tampil di Dashboard TIDAK berubah setelah Anda push +
// Deploy > New version, berarti deployment belum benar-benar ter-update.
const BACKEND_VERSION = '2026-08-05-i';

/**
 * Buka URL Web App ini langsung di tab browser (GET, bukan lewat app) untuk
 * cek cepat apakah deployment yang aktif sekarang sudah versi terbaru --
 * tidak perlu login, tidak perlu DevTools. Kalau versi yang muncul BUKAN
 * BACKEND_VERSION yang terbaru, itu bukti pasti deployment belum di-update.
 */
function doGet(e) {
  return jsonResponse({
    data: {
      pesan: 'Router.gs aktif dan bisa diakses.',
      backendVersion: BACKEND_VERSION,
      waktuServer: new Date().toString()
    }
  });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    // 'login' ditangani terpisah -- belum ada token di titik ini.
    if (action === 'login') {
      return jsonResponse(handleLoginBK(body.username, body.password));
    }

    // Frontend WAJIB mengirim username+token (dibaca dari cookie SSO
    // .smkibupakusari.sch.id oleh JS di sisi client) -- lihat Auth.gs.
    const user = getSessionUser(body.username, body.token);
    if (!user) return jsonResponse({ error: 'Sesi tidak valid, silakan login ulang.', sessionExpired: true });

    let result;
    switch (action) {
      case 'tambahPelanggaran':
        result = tambahPelanggaran(user, body.data);
        break;
      case 'getDaftarKelas':
        result = getDaftarKelas();
        break;
      case 'getSiswaAktifKelas':
        result = getSiswaAktifKelas(body.kelas);
        break;
      case 'updateStatusTindakLanjut':
        result = updateStatusTindakLanjut(user, body.idPelanggaran, body.tindakLanjut, body.status);
        break;
      case 'getPelanggaranSiswa':
        result = getPelanggaranSiswa(user, body.nis);
        break;
      case 'getPelanggaranKelas':
        result = getPelanggaranKelas(user, body.kelas);
        break;
      case 'getAllPelanggaran':
        result = getAllPelanggaran(user);
        break;
      case 'tambahKasus':
        result = tambahKasus(user, body.data);
        break;
      case 'updateKasus':
        result = updateKasus(user, body.idKasus, body.data);
        break;
      case 'getKasusSiswa':
        result = getKasusSiswa(user, body.nis);
        break;
      case 'getKasusKelas':
        result = getKasusKelas(user, body.kelas);
        break;
      case 'getAllKasus':
        result = getAllKasus(user);
        break;
      case 'getSiswaPerluPerhatian':
        result = getSiswaPerluPerhatian(user, body.kelas);
        break;
      case 'simpanAbsenManualBK':
        result = simpanAbsenManualBK(user, body.kelas, body.tanggal, body.dataKehadiran);
        break;
      case 'setThresholdAlpa':
        result = setThresholdAlpa(user, body.threshold);
        break;
      case 'tambahPrestasi':
        result = tambahPrestasi(user, body.data);
        break;
      case 'getPrestasiSiswa':
        result = getPrestasiSiswa(user, body.nis);
        break;
      case 'getPrestasiKelas':
        result = getPrestasiKelas(user, body.kelas);
        break;
      case 'getAllPrestasi':
        result = getAllPrestasi(user);
        break;
      case 'tambahHomeVisit':
        result = tambahHomeVisit(user, body.data);
        break;
      case 'updateHomeVisit':
        result = updateHomeVisit(user, body.id, body.data);
        break;
      case 'getHomeVisitSiswa':
        result = getHomeVisitSiswa(user, body.nis);
        break;
      case 'getHomeVisitKelas':
        result = getHomeVisitKelas(user, body.kelas);
        break;
      case 'getAllHomeVisit':
        result = getAllHomeVisit(user);
        break;
      case 'getDashboardRingkasan':
        result = getDashboardRingkasan(user);
        break;
      case 'getJenisSuratAktif':
        result = getJenisSuratAktif(user);
        break;
      case 'buatSurat':
        result = buatSurat(user, body.data);
        break;
      case 'uploadBerkasSurat':
        result = uploadBerkasSurat(user, body.idSurat, body.fileBase64, body.namaFile, body.mimeType);
        break;
      case 'updateStatusPenangananSurat':
        result = updateStatusPenangananSurat(user, body.idSurat, body.status);
        break;
      case 'getRiwayatSurat':
        result = getRiwayatSurat(user, body.nis);
        break;
      default:
        return jsonResponse({ error: 'Action tidak dikenali: ' + action });
    }
    return jsonResponse({ data: result });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
