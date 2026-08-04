/**
 * Router.gs — entry point Web App.
 * Pola sama dengan go_absen_siswa: 1 endpoint doPost, routing berdasarkan
 * field 'action' di body JSON, dipanggil dari frontend lewat postJson().
 */
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
    if (!user) return jsonResponse({ error: 'Sesi tidak valid, silakan login ulang.' });

    let result;
    switch (action) {
      case 'tambahPelanggaran':
        result = tambahPelanggaran(user, body.data);
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
      case 'getKategoriAktif':
        result = getKategoriAktif(user);
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
