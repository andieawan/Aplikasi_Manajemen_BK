import { postJson } from './api.js';
import { showGlobalLoading, hideGlobalLoading, showNotification, escapeHtml, validateNis, punyaAksesBK } from './utils.js';

export async function renderSuratPage(sesi) {
    const app = document.getElementById('app');
    const isBK = punyaAksesBK(sesi);

    app.innerHTML = `
        <header class="page-header"><h1>Dashboard Surat</h1></header>
        ${isBK ? `
        <section class="card">
            <h2>Buat Surat</h2>
            <form id="formSurat">
                <div class="form-group"><label>Jenis Surat</label><select id="srJenis"><option value="">Memuat...</option></select></div>
                <div class="form-group"><label>NIS Siswa</label><input type="text" id="srNis" required></div>
                <div class="form-group"><label>Keperluan</label><input type="text" id="srKeperluan"></div>
                <button type="submit" class="btn-primary">Generate Surat</button>
            </form>
            <div id="hasilSurat"></div>
        </section>` : '<p>Fitur ini hanya untuk BK.</p>'}
        ${isBK ? `<section class="card"><h2>Riwayat Surat</h2><div id="riwayatSurat">Memuat...</div></section>` : ''}
    `;

    if (!isBK) return;

    try {
        const jenisList = await postJson('getJenisSuratAktif', {});
        document.getElementById('srJenis').innerHTML = jenisList.map(function (j) {
            return `<option value="${escapeHtml(j.jenisSurat)}">${escapeHtml(j.jenisSurat)}</option>`;
        }).join('');
    } catch (err) {
        showNotification('Gagal memuat jenis surat: ' + err.message, 'error');
    }

    document.getElementById('formSurat').addEventListener('submit', async function (e) {
        e.preventDefault();
        const nis = document.getElementById('srNis').value.trim();
        if (!validateNis(nis)) { showNotification('Format NIS tidak valid.', 'error'); return; }
        const data = {
            jenisSurat: document.getElementById('srJenis').value,
            nis: nis,
            keperluan: document.getElementById('srKeperluan').value.trim()
        };
        showGlobalLoading('Membuat surat...');
        try {
            const hasil = await postJson('buatSurat', { data: data });
            document.getElementById('hasilSurat').innerHTML =
                `<p>Surat No. ${escapeHtml(hasil.nomorSurat)} berhasil dibuat. <a href="${escapeHtml(hasil.linkDokumen)}" target="_blank">Buka Dokumen</a></p>`;
            e.target.reset();
            muatRiwayat();
        } catch (err) {
            showNotification('Gagal membuat surat: ' + err.message, 'error');
        } finally {
            hideGlobalLoading();
        }
    });

    muatRiwayat();
}

async function muatRiwayat() {
    const container = document.getElementById('riwayatSurat');
    try {
        const list = await postJson('getRiwayatSurat', {});
        if (!list.length) { container.innerHTML = '<p>Belum ada surat dibuat.</p>'; return; }
        container.innerHTML = `
            <table class="tabel-data">
                <thead><tr><th>No. Surat</th><th>Jenis</th><th>Nama</th><th>Kelas</th><th>Dokumen</th></tr></thead>
                <tbody>${list.map(function (s) {
                    return `<tr><td>${escapeHtml(s.nomorSurat)}</td><td>${escapeHtml(s.jenisSurat)}</td><td>${escapeHtml(s.nama)}</td>
                        <td>${escapeHtml(s.kelas)}</td><td><a href="${escapeHtml(s.linkDokumen)}" target="_blank">Buka</a></td></tr>`;
                }).join('')}</tbody>
            </table>`;
    } catch (err) {
        container.innerHTML = '<p class="text-danger">Gagal memuat: ' + escapeHtml(err.message) + '</p>';
    }
}
