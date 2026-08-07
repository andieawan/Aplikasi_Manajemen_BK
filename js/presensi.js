import { postJson } from './api.js';
import { showGlobalLoading, hideGlobalLoading, showNotification, escapeHtml, punyaAksesBK } from './utils.js';

export async function renderPresensiPage(sesi) {
    const app = document.getElementById('app');
    const isBK = punyaAksesBK(sesi);
    const isKepsek = (sesi.roleList || []).includes('kepsek');
    const kelasWali = sesi.kelasWali || '';

    app.innerHTML = `
        <header class="page-header"><h1>Presensi & Keterlambatan</h1></header>
        <p><em>Menampilkan siswa dengan jumlah Alpa &ge; threshold, diambil dari data absensi go_absen_siswa.
        "Telat" tidak ditampilkan di sini -- dicek manual terpisah oleh BK, karena go_absen_siswa belum
        mencatatnya sebagai status tersendiri.</em></p>
        ${isBK ? `
        <section class="card">
            <h2>Threshold Notifikasi</h2>
            <form id="formThreshold">
                <div class="form-group">
                    <label>Alpa/Telat minimal untuk masuk daftar "perlu perhatian"</label>
                    <input type="number" id="thresholdInput" min="1" value="3">
                </div>
                <button type="submit" class="btn-primary">Simpan Threshold</button>
            </form>
        </section>` : ''}
        <section class="card">
            <h2>Siswa Perlu Perhatian ${isBK || isKepsek ? '' : '(Kelas ' + escapeHtml(kelasWali) + ')'}</h2>
            ${(isBK || isKepsek) ? `
                <div class="form-group"><label>Kelas</label><input type="text" id="kelasCek" placeholder="Masukkan nama kelas"></div>
                <button id="btnCekKelas" class="btn-secondary">Cek</button>
            ` : ''}
            <div id="daftarPresensi"></div>
        </section>
    `;

    if (isBK) {
        document.getElementById('formThreshold').addEventListener('submit', async function (e) {
            e.preventDefault();
            const threshold = Number(document.getElementById('thresholdInput').value);
            showGlobalLoading('Menyimpan...');
            try {
                await postJson('setThresholdAlpa', { threshold: threshold });
                showNotification('Threshold berhasil disimpan.', 'success');
            } catch (err) {
                showNotification('Gagal: ' + err.message, 'error');
            } finally {
                hideGlobalLoading();
            }
        });
    }

    if (isBK || isKepsek) {
        document.getElementById('btnCekKelas').addEventListener('click', function () {
            const kelas = document.getElementById('kelasCek').value.trim();
            if (kelas) muatSiswaPerluPerhatian(kelas);
        });
    } else if (kelasWali) {
        muatSiswaPerluPerhatian(kelasWali);
    }
}

async function muatSiswaPerluPerhatian(kelas) {
    const container = document.getElementById('daftarPresensi');
    container.innerHTML = 'Memuat...';
    try {
        const list = await postJson('getSiswaPerluPerhatian', { kelas: kelas });
        if (!list.length) { container.innerHTML = '<p>Tidak ada siswa yang melewati threshold di kelas ini.</p>'; return; }
        container.innerHTML = `
            <table class="tabel-data">
                <thead><tr><th>Nama</th><th>Alpa</th><th>Izin</th><th>Sakit</th><th>Hadir</th></tr></thead>
                <tbody>${list.map(function (s) {
                    return `<tr><td data-label="Nama">${escapeHtml(s.nama)}</td><td data-label="Alpa">${s.jumlahAlpa}</td><td data-label="Izin">${s.jumlahIzin}</td><td data-label="Sakit">${s.jumlahSakit}</td><td data-label="Hadir">${s.jumlahHadir}</td></tr>`;
                }).join('')}</tbody>
            </table>`;
    } catch (err) {
        container.innerHTML = '<p class="text-danger">' + escapeHtml(err.message) + '</p>';
    }
}
