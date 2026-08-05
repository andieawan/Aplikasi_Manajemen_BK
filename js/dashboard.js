import { postJson } from './api.js';
import { showGlobalLoading, hideGlobalLoading, escapeHtml, punyaAksesBK } from './utils.js';

export async function renderDashboardPage(sesi) {
    const app = document.getElementById('app');
    const isBKKepsek = punyaAksesBK(sesi) || (sesi.roleList || []).includes('kepsek');

    app.innerHTML = `<header class="page-header"><h1>Dashboard & Rekap</h1></header><div id="dashboardContainer">Memuat ringkasan...</div>`;

    if (!isBKKepsek) {
        document.getElementById('dashboardContainer').innerHTML = '<p>Dashboard ringkasan hanya untuk BK & Kepsek.</p>';
        return;
    }

    showGlobalLoading('Memuat ringkasan...');
    try {
        const d = await postJson('getDashboardRingkasan', {});
        document.getElementById('dashboardContainer').innerHTML = `
            <div class="dashboard-grid">
                <div class="card stat-card"><h3>${d.totalPelanggaran}</h3><p>Total Pelanggaran Aktif</p></div>
                <div class="card stat-card"><h3>${d.totalKasusAktif}</h3><p>Kasus Aktif</p></div>
                <div class="card stat-card"><h3>${d.totalPrestasi}</h3><p>Total Prestasi</p></div>
            </div>
            <section class="card">
                <h2>Pelanggaran per Tingkat</h2>
                <ul>
                    <li>Ringan: ${d.pelanggaranPerTingkat.Ringan}</li>
                    <li>Sedang: ${d.pelanggaranPerTingkat.Sedang}</li>
                    <li>Berat: ${d.pelanggaranPerTingkat.Berat}</li>
                </ul>
            </section>
            <p><em>Data siswa perlu perhatian (keterlambatan/alpa) belum tampil di sini -- lihat menu Pelanggaran per kelas, fitur ini menunggu action getAbsenUntukBK selesai dibuat di go_absen_siswa.</em></p>
            <p style="font-size:0.75rem;color:var(--gray-400);">Versi backend aktif: ${escapeHtml(d.backendVersion || '(tidak diketahui)')}</p>
        `;
    } catch (err) {
        document.getElementById('dashboardContainer').innerHTML = '<p class="text-danger">Gagal memuat: ' + escapeHtml(err.message) + '</p>';
    } finally {
        hideGlobalLoading();
    }
}
