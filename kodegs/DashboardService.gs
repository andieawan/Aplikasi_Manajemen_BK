/**
 * DashboardService.gs — ringkasan agregat lintas fitur. Hanya BK & Kepsek.
 * Kasus tetap disanitasi (getAllKasus sudah menangani ini sendiri).
 */
function getDashboardRingkasan(user) {
  if (!hasRole(user, ['bk', 'kepsek'])) throw new Error('Akses ditolak.');

  const pelanggaran = getAllPelanggaran(user);
  const kasus = getAllKasus(user);
  const prestasi = getAllPrestasi(user);

  const pelanggaranPerTingkat = { Ringan: 0, Sedang: 0, Berat: 0 };
  pelanggaran.forEach(function (p) {
    if (pelanggaranPerTingkat[p.tingkat] !== undefined) pelanggaranPerTingkat[p.tingkat]++;
  });

  return {
    totalPelanggaran: pelanggaran.length,
    pelanggaranPerTingkat: pelanggaranPerTingkat,
    totalKasusAktif: kasus.filter(function (k) { return k.statusKasus === 'Aktif' || k.adaKasusAktif; }).length,
    totalPrestasi: prestasi.length,
    // Presensi sengaja tidak diagregasi di sini -- bergantung pada
    // getSiswaPerluPerhatian() per kelas (butuh action go_absen_siswa yang
    // belum ada, lihat PresensiService.gs). Panggil terpisah per kelas dari
    // frontend kalau perlu.
  };
}
