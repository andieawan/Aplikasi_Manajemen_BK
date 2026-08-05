import { postJson } from './api.js';
import { showGlobalLoading, hideGlobalLoading, showNotification, escapeHtml, formatDateIndo, validateNis, punyaAksesBK } from './utils.js';
import { showConfirm } from './modal.js';

const KATEGORI_BADGE = { Ringan: 'badge-info', Sedang: 'badge-warning', Berat: 'badge-danger' };

export async function renderPelanggaranPage(sesi) {
    const app = document.getElementById('app');
    const isBK = punyaAksesBK(sesi);
    const isKepsek = (sesi.roleList || []).includes('kepsek');
    const kelasWali = sesi.kelasWali || '';

    app.innerHTML = `
        <header class="page-header">
            <h1>Manajemen Pelanggaran</h1>
            <p>${escapeHtml(sesi.nama)} &mdash; ${escapeHtml((sesi.roleList || []).join(', '))}</p>
        </header>

        ${isBK ? `
        <section class="card" id="formTambahSection">
            <h2>Tambah Pelanggaran</h2>
            <form id="formTambahPelanggaran">
                <div class="form-group">
                    <label>NIS Siswa</label>
                    <input type="text" id="inputNis" required placeholder="Masukkan NIS">
                </div>
                <div class="form-group">
                    <label>Tanggal Kejadian</label>
                    <input type="date" id="inputTanggal" required>
                </div>
                <div class="form-group">
                    <label>Kategori</label>
                    <select id="inputKategori" required>
                        <option value="">-- Pilih Kategori --</option>
                        <option value="Ringan">Ringan</option>
                        <option value="Sedang">Sedang</option>
                        <option value="Berat">Berat</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Deskripsi / Kronologi</label>
                    <textarea id="inputDeskripsi" required rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label>Tindak Lanjut (opsional, bisa diisi menyusul)</label>
                    <input type="text" id="inputTindakLanjut" placeholder="Contoh: Teguran lisan">
                </div>
                <button type="submit" class="btn-primary" id="btnSubmitPelanggaran">Simpan</button>
            </form>
        </section>` : ''}

        <section class="card">
            <h2>${isBK || isKepsek ? 'Rekap Semua Pelanggaran' : 'Pelanggaran Kelas ' + escapeHtml(kelasWali)}</h2>
            <div id="daftarPelanggaranContainer">Memuat data...</div>
        </section>
    `;

    if (isBK) {
        setupFormTambah();
    }
    muatDaftar(isBK || isKepsek, kelasWali);
}

function setupFormTambah() {
    const form = document.getElementById('formTambahPelanggaran');
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const nis = document.getElementById('inputNis').value.trim();
        if (!validateNis(nis)) {
            showNotification('Format NIS tidak valid.', 'error');
            return;
        }
        const data = {
            nis: nis,
            tanggalKejadian: document.getElementById('inputTanggal').value,
            kategori: document.getElementById('inputKategori').value,
            deskripsi: document.getElementById('inputDeskripsi').value.trim(),
            tindakLanjut: document.getElementById('inputTindakLanjut').value.trim()
        };
        if (!data.kategori || !data.deskripsi) {
            showNotification('Kategori dan deskripsi wajib diisi.', 'error');
            return;
        }

        showGlobalLoading('Menyimpan pelanggaran...');
        try {
            await postJson('tambahPelanggaran', { data: data });
            showNotification('Pelanggaran berhasil disimpan.', 'success');
            form.reset();
            muatDaftar(true, '');
        } catch (err) {
            showNotification('Gagal menyimpan: ' + err.message, 'error');
        } finally {
            hideGlobalLoading();
        }
    });
}

async function muatDaftar(lihatSemua, kelasWali) {
    const container = document.getElementById('daftarPelanggaranContainer');
    showGlobalLoading('Memuat data pelanggaran...');
    try {
        const list = lihatSemua
            ? await postJson('getAllPelanggaran', {})
            : await postJson('getPelanggaranKelas', { kelas: kelasWali });

        if (!list.length) {
            container.innerHTML = '<p>Belum ada catatan pelanggaran.</p>';
            return;
        }

        container.innerHTML = `
            <table class="tabel-data">
                <thead>
                    <tr>
                        <th>Tanggal</th><th>Nama</th><th>Kelas</th><th>Kategori</th>
                        <th>Deskripsi</th><th>Tindak Lanjut</th><th>Status</th>${lihatSemua ? '<th></th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${list.map(function (p) { return renderBarisPelanggaran(p, lihatSemua); }).join('')}
                </tbody>
            </table>
        `;

        if (lihatSemua) {
            container.querySelectorAll('[data-update-id]').forEach(function (btn) {
                btn.addEventListener('click', function () { bukaFormUpdate(btn.dataset.updateId, lihatSemua, kelasWali); });
            });
        }
    } catch (err) {
        container.innerHTML = '<p class="text-danger">Gagal memuat data: ' + escapeHtml(err.message) + '</p>';
    } finally {
        hideGlobalLoading();
    }
}

function renderBarisPelanggaran(p, bisaUpdate) {
    const badgeClass = KATEGORI_BADGE[p.kategori] || 'badge-secondary';
    return `
        <tr>
            <td>${formatDateIndo(p.tanggalKejadian)}</td>
            <td>${escapeHtml(p.nama)}</td>
            <td>${escapeHtml(p.kelas)}</td>
            <td><span class="badge ${badgeClass}">${escapeHtml(p.kategori)}</span></td>
            <td>${escapeHtml(p.deskripsi)}</td>
            <td>${escapeHtml(p.tindakLanjut || '-')}</td>
            <td>${escapeHtml(p.statusTindakLanjut)}</td>
            ${bisaUpdate ? `<td><button class="btn-secondary btn-sm" data-update-id="${escapeHtml(p.id)}">Update</button></td>` : ''}
        </tr>
    `;
}

async function bukaFormUpdate(id, lihatSemua, kelasWali) {
    const tindakLanjutBaru = prompt('Tindak lanjut baru:');
    if (tindakLanjutBaru === null) return;
    const statusBaru = (await showConfirm('Tandai status sebagai "Selesai"? (Batal = tetap "Proses")', 'Status Tindak Lanjut'))
        ? 'Selesai' : 'Proses';

    showGlobalLoading('Menyimpan perubahan...');
    try {
        await postJson('updateStatusTindakLanjut', { idPelanggaran: id, tindakLanjut: tindakLanjutBaru, status: statusBaru });
        showNotification('Berhasil diperbarui.', 'success');
        muatDaftar(lihatSemua, kelasWali);
    } catch (err) {
        showNotification('Gagal memperbarui: ' + err.message, 'error');
    } finally {
        hideGlobalLoading();
    }
}
