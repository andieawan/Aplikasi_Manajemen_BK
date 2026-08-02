/**
 * Utils.gs — helper yang dipakai BERSAMA oleh semua fitur (Pelanggaran,
 * Kasus, Presensi, Prestasi, Home Visit, dst). Didefinisikan SEKALI di sini
 * saja -- JANGAN duplikasi fungsi yang sama di *Service.gs lain, karena
 * semua file .gs berbagi satu global scope di Apps Script.
 */

/**
 * Tentukan tahun ajaran dari tanggal, format "2026-2027" — logika disalin
 * persis dari getTahunAjaranFromTanggal() di go_absen_siswa/kodegs/Config.gs:
 * Juli-Desember tahun X = tahun ajaran mulai X; Januari-Juni tahun X = tahun
 * ajaran mulai (X-1). Otomatis, tidak perlu diset manual tiap tahun.
 */
function getTahunAjaranFromTanggal(tanggalStr) {
  const d = new Date(tanggalStr);
  const valid = !isNaN(d.getTime());
  const now = new Date();
  const bulan = valid ? d.getMonth() + 1 : now.getMonth() + 1;
  const tahun = valid ? d.getFullYear() : now.getFullYear();
  const tahunMulai = (bulan >= 7) ? tahun : (tahun - 1);
  return tahunMulai + '-' + (tahunMulai + 1);
}

/** Tahun ajaran aktif SAAT INI (dipakai untuk provisioning spreadsheet). */
function getTahunAjaranAktif() {
  return getTahunAjaranFromTanggal(new Date());
}

/**
 * Cari siswa by NIS lintas semua sheet kelas di Master Siswa.
 * TODO: linear-scan sederhana -- ganti dengan fungsi pencarian siswa yang
 * sudah ada di go_absen_siswa kalau tersedia (hindari duplikasi logika),
 * atau optimasi (index/cache) kalau jumlah siswa besar & sering dipanggil.
 */
function cariSiswaByNis(nis) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_MASTER_SISWA_ID);
  const sheets = ss.getSheets();
  for (let s = 0; s < sheets.length; s++) {
    const data = sheets[s].getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(nis)) { // kolom B(1) = NIS
        const status = data[i][4]; // kolom E(4) = Status
        const aktif = !status || status === 'Aktif';
        if (!aktif) return null;
        return { nis: data[i][1], nama: data[i][2], kelas: sheets[s].getName() };
      }
    }
  }
  return null;
}
