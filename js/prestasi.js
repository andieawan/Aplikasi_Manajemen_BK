import { postJson } from './api.js';
import { showGlobalLoading, hideGlobalLoading, showNotification, escapeHtml, formatDateIndo, validateNis, punyaAksesBK } from './utils.js';

export async function renderPrestasiPage(sesi) {
    const app = document.getElementById('app');
    const isBK = punyaAksesBK(sesi);
    const isKepsek = (sesi.roleList || []).includes('kepsek');
    const isWali = !!sesi.kelasWali;
    const kelasWali = sesi.kelasWali || '';

    app.innerHTML = `
        <header class="page-header"><h1>Prestasi Siswa</h1></header>
        ${(isBK || isWali) ? `
        <section class="card">
            <h2>Tambah Prestasi</h2>
            <form id="formPrestasi">
                <div class="form-group"><label>NIS Siswa</label><input type="text" id="prNis" required></div>
                <div class="form-group"><label>Tanggal</label><input type="date" id="prTanggal" required></div>
                <div class="form-group"><label>Jenis</label>
                    <select id="prJenis"><option>Akademik</option><option>Non-Akademik</option></select>
                </div>
                <div class="form-group"><label>Tingkat</label>
                    <select id="prTingkat">
                        <option>Sekolah</option><option>Kabupaten</option><option>Provinsi</option>
                        <option>Nasional</option><option>Internasional</option>
                    </select>
                </div>
                <div class="form-group"><label>Nama Kegiatan/Lomba</label><input type="text" id="prKegiatan" required></div>
                <div class="form-group"><label>Capaian</label><input type="text" id="prCapaian" required placeholder="Contoh: Juara 1"></div>
                <button type="submit" class="btn-primary">Simpan</button>
            </form>
        </section>` : ''}
        <section class="card">
            <h2>${isBK || isKepsek ? 'Rekap Semua Prestasi' : 'Prestasi Kelas ' + escapeHtml(kelasWali)}</h2>
            <div id="daftarPrestasi">Memuat data...</div>
        </section>
    `;

    if (isBK || isWali) {
        document.getElementById('formPrestasi').addEventListener('submit', async function (e) {
            e.preventDefault();
            const nis = document.getElementById('prNis').value.trim();
            if (!validateNis(nis)) { showNotification('Format NIS tidak valid.', 'error'); return; }
            const data = {
                nis: nis,
                tanggal: document.getElementById('prTanggal').value,
                jenis: document.getElementById('prJenis').value,
                tingkat: document.getElementById('prTingkat').value,
                namaKegiatan: document.getElementById('prKegiatan').value.trim(),
                capaian: document.getElementById('prCapaian').value.trim()
            };
            showGlobalLoading('Menyimpan...');
            try {
                await postJson('tambahPrestasi', { data: data });
                showNotification('Prestasi berhasil disimpan.', 'success');
                e.target.reset();
                muatDaftarPrestasi(isBK || isKepsek, kelasWali);
            } catch (err) {
                showNotification('Gagal: ' + err.message, 'error');
            } finally {
                hideGlobalLoading();
            }
        });
    }
    muatDaftarPrestasi(isBK || isKepsek, kelasWali);
}

async function muatDaftarPrestasi(lihatSemua, kelasWali) {
    const container = document.getElementById('daftarPrestasi');
    showGlobalLoading('Memuat data...');
    try {
        const list = lihatSemua ? await postJson('getAllPrestasi', {}) : await postJson('getPrestasiKelas', { kelas: kelasWali });
        if (!list.length) { container.innerHTML = '<p>Belum ada catatan prestasi.</p>'; return; }
        container.innerHTML = `
            <table class="tabel-data">
                <thead><tr><th>Tanggal</th><th>Nama</th><th>Kelas</th><th>Jenis</th><th>Tingkat</th><th>Kegiatan</th><th>Capaian</th></tr></thead>
                <tbody>${list.map(function (p) {
                    return `<tr><td>${formatDateIndo(p.tanggal)}</td><td>${escapeHtml(p.nama)}</td><td>${escapeHtml(p.kelas)}</td>
                        <td>${escapeHtml(p.jenis)}</td><td>${escapeHtml(p.tingkat)}</td><td>${escapeHtml(p.namaKegiatan)}</td><td>${escapeHtml(p.capaian)}</td></tr>`;
                }).join('')}</tbody>
            </table>`;
    } catch (err) {
        container.innerHTML = '<p class="text-danger">Gagal memuat: ' + escapeHtml(err.message) + '</p>';
    } finally {
        hideGlobalLoading();
    }
}
