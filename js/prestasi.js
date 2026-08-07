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
            <h2>Input Absensi Manual</h2>
            <p><em>Data yang disimpan di sini masuk langsung ke sistem absensi go_absen_siswa (bukan
            disimpan terpisah), ditandai "BK (Manual)" supaya bisa dibedakan dari input wali kelas.</em></p>
            <div class="form-group">
                <label>Kelas</label>
                <select id="absenKelas"><option value="">Memuat kelas...</option></select>
            </div>
            <div class="form-group">
                <label>Tanggal</label>
                <input type="date" id="absenTanggal">
            </div>
            <button id="btnMuatSiswaAbsen" class="btn-secondary">Muat Daftar Siswa</button>
            <div id="daftarAbsenManual"></div>
        </section>` : ''}

        ${isBK ? `
        <section class="card">
            <h2>Threshold Notifikasi</h2>
            <form id="formThreshold">
                <div class="form-group">
                    <label>Alpa minimal untuk masuk daftar "perlu perhatian"</label>
                    <input type="number" id="thresholdInput" min="1" value="3">
                </div>
                <button type="submit" class="btn-primary">Simpan Threshold</button>
            </form>
        </section>` : ''}

        <section class="card">
            <h2>Siswa Perlu Perhatian ${isBK || isKepsek ? '' : '(Kelas ' + escapeHtml(kelasWali) + ')'}</h2>
            ${(isBK || isKepsek) ? `
                <div class="form-group"><label>Kelas</label><select id="kelasCek"><option value="">Memuat kelas...</option></select></div>
                <button id="btnCekKelas" class="btn-secondary">Cek</button>
            ` : ''}
            <div id="daftarPresensi"></div>
        </section>
    `;

    if (isBK) {
        document.getElementById('absenTanggal').value = new Date().toISOString().substring(0, 10);
        muatDaftarKelasKe('absenKelas');
        document.getElementById('btnMuatSiswaAbsen').addEventListener('click', function () {
            const kelas = document.getElementById('absenKelas').value;
            if (!kelas) { showNotification('Pilih kelas dulu.', 'error'); return; }
            muatFormAbsenManual(kelas);
        });

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
        muatDaftarKelasKe('kelasCek');
        document.getElementById('btnCekKelas').addEventListener('click', function () {
            const kelas = document.getElementById('kelasCek').value;
            if (kelas) muatSiswaPerluPerhatian(kelas);
        });
    } else if (kelasWali) {
        muatSiswaPerluPerhatian(kelasWali);
    }
}

async function muatDaftarKelasKe(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    try {
        const daftarKelas = await postJson('getDaftarKelas', {});
        select.innerHTML = '<option value="">-- Pilih Kelas --</option>' +
            daftarKelas.map(function (k) { return `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`; }).join('');
    } catch (err) {
        select.innerHTML = '<option value="">Gagal memuat kelas</option>';
    }
}

async function muatFormAbsenManual(kelas) {
    const container = document.getElementById('daftarAbsenManual');
    container.innerHTML = 'Memuat siswa...';
    try {
        const daftarSiswa = await postJson('getSiswaAktifKelas', { kelas: kelas });
        if (!daftarSiswa.length) { container.innerHTML = '<p>Tidak ada siswa aktif di kelas ini.</p>'; return; }

        container.innerHTML = `
            <table class="tabel-data">
                <thead><tr><th>Nama</th><th>Status</th></tr></thead>
                <tbody>
                    ${daftarSiswa.map(function (s) {
                        return `
                            <tr>
                                <td data-label="Nama">${escapeHtml(s.nama)}</td>
                                <td data-label="Status">
                                    <select data-nis-absen="${escapeHtml(s.nis)}">
                                        <option value="H" selected>Hadir</option>
                                        <option value="I">Izin</option>
                                        <option value="S">Sakit</option>
                                        <option value="A">Alpa</option>
                                    </select>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            <button id="btnSimpanAbsenManual" class="btn-primary">Simpan Absensi</button>
        `;

        document.getElementById('btnSimpanAbsenManual').addEventListener('click', function () {
            simpanAbsenManual(kelas);
        });
    } catch (err) {
        container.innerHTML = '<p class="text-danger">Gagal memuat siswa: ' + escapeHtml(err.message) + '</p>';
    }
}

async function simpanAbsenManual(kelas) {
    const tanggal = document.getElementById('absenTanggal').value;
    if (!tanggal) { showNotification('Pilih tanggal dulu.', 'error'); return; }

    const dataKehadiran = Array.from(document.querySelectorAll('[data-nis-absen]')).map(function (sel) {
        return { nis: sel.dataset.nisAbsen, status: sel.value };
    });
    if (!dataKehadiran.length) { showNotification('Tidak ada data siswa untuk disimpan.', 'error'); return; }

    showGlobalLoading('Menyimpan absensi...');
    try {
        await postJson('simpanAbsenManualBK', { kelas: kelas, tanggal: tanggal, dataKehadiran: dataKehadiran });
        showNotification('Absensi kelas ' + kelas + ' berhasil disimpan.', 'success');
    } catch (err) {
        showNotification('Gagal menyimpan: ' + err.message, 'error');
    } finally {
        hideGlobalLoading();
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
