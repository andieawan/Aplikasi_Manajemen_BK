import { postJson } from './api.js';
import { showGlobalLoading, hideGlobalLoading, showNotification, escapeHtml, formatDateIndo, punyaAksesBK } from './utils.js';
import { renderSiswaPickerHTML, setupSiswaPicker, getNisTerpilih } from './siswaPicker.js';

export async function renderHomeVisitPage(sesi) {
    const app = document.getElementById('app');
    const isBK = punyaAksesBK(sesi);
    const isKepsek = (sesi.roleList || []).includes('kepsek');
    const kelasWali = sesi.kelasWali || '';

    app.innerHTML = `
        <header class="page-header"><h1>Home Visit</h1></header>
        ${isBK ? `
        <section class="card">
            <h2>Catat Home Visit</h2>
            <form id="formHomeVisit">
                ${renderSiswaPickerHTML('hv', 'Kelas', 'Nama Siswa')}
                <div class="form-group"><label>Tanggal Kunjungan</label><input type="date" id="hvTanggal" required></div>
                <div class="form-group"><label>Tujuan</label><input type="text" id="hvTujuan" required></div>
                <div class="form-group"><label>Hasil Kunjungan</label><textarea id="hvHasil" rows="3"></textarea></div>
                <button type="submit" class="btn-primary">Simpan</button>
            </form>
        </section>` : ''}
        <section class="card">
            <h2>${isBK || isKepsek ? 'Rekap Semua Home Visit' : 'Home Visit Kelas ' + escapeHtml(kelasWali)}</h2>
            <div id="daftarHomeVisit">Memuat data...</div>
        </section>
    `;

    if (isBK) {
        setupSiswaPicker('hv', null);

        document.getElementById('formHomeVisit').addEventListener('submit', async function (e) {
            e.preventDefault();
            const nis = getNisTerpilih('hv');
            if (!nis) { showNotification('Pilih kelas dan nama siswa.', 'error'); return; }
            const data = {
                nis: nis,
                tanggalKunjungan: document.getElementById('hvTanggal').value,
                tujuan: document.getElementById('hvTujuan').value.trim(),
                hasilKunjungan: document.getElementById('hvHasil').value.trim()
            };
            showGlobalLoading('Menyimpan...');
            try {
                await postJson('tambahHomeVisit', { data: data });
                showNotification('Home Visit berhasil dicatat.', 'success');
                e.target.reset();
                muatDaftarHomeVisit(true, kelasWali);
            } catch (err) {
                showNotification('Gagal: ' + err.message, 'error');
            } finally {
                hideGlobalLoading();
            }
        });
    }
    muatDaftarHomeVisit(isBK || isKepsek, kelasWali);
}

async function muatDaftarHomeVisit(lihatSemua, kelasWali) {
    const container = document.getElementById('daftarHomeVisit');
    showGlobalLoading('Memuat data...');
    try {
        const list = lihatSemua ? await postJson('getAllHomeVisit', {}) : await postJson('getHomeVisitKelas', { kelas: kelasWali });
        if (!list.length) { container.innerHTML = '<p>Belum ada catatan Home Visit.</p>'; return; }
        container.innerHTML = `
            <table class="tabel-data">
                <thead><tr><th>Tanggal</th><th>Nama</th><th>Kelas</th><th>Tujuan</th><th>Hasil</th><th>Tindak Lanjut</th></tr></thead>
                <tbody>${list.map(function (h) {
                    return `<tr><td>${formatDateIndo(h.tanggalKunjungan)}</td><td>${escapeHtml(h.nama)}</td><td>${escapeHtml(h.kelas)}</td>
                        <td>${escapeHtml(h.tujuan)}</td><td>${escapeHtml(h.hasilKunjungan || '-')}</td><td>${escapeHtml(h.tindakLanjut || '-')}</td></tr>`;
                }).join('')}</tbody>
            </table>`;
    } catch (err) {
        container.innerHTML = '<p class="text-danger">Gagal memuat: ' + escapeHtml(err.message) + '</p>';
    } finally {
        hideGlobalLoading();
    }
}
