import { postJson } from './api.js';
import { showGlobalLoading, hideGlobalLoading, showNotification, escapeHtml } from './utils.js';

export async function renderPresensiPage(sesi) {
    const app = document.getElementById('app');
    const isBK = (sesi.roleList || []).includes('bk');
    const isKepsek = (sesi.roleList || []).includes('kepsek');
    const kelasWali = sesi.kelasWali || '';

    app.innerHTML = `
        <header class="page-header"><h1>Presensi & Keterlambatan</h1></header>
        <p><em>Fitur ini butuh action <code>getAbsenUntukBK</code> di go_absen_siswa yang belum dibuat --
        lihat catatan di kodegs/PresensiService.gs. Form di bawah tetap disiapkan supaya begitu action
        itu selesai, fitur langsung berfungsi tanpa perubahan kode frontend.</em></p>
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
                <thead><tr><th>Nama</th><th>Alpa</th><th>Telat</th><th>Izin</th><th>Sakit</th></tr></thead>
                <tbody>${list.map(function (s) {
                    return `<tr><td>${escapeHtml(s.nama)}</td><td>${s.jumlahAlpa}</td><td>${s.jumlahTelat}</td><td>${s.jumlahIzin}</td><td>${s.jumlahSakit}</td></tr>`;
                }).join('')}</tbody>
            </table>`;
    } catch (err) {
        container.innerHTML = '<p class="text-danger">' + escapeHtml(err.message) + '</p>';
    }
}
