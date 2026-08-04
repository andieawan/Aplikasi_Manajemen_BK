import { postJson } from './api.js';
import { showGlobalLoading, hideGlobalLoading, showNotification, escapeHtml, formatDateIndo, validateNis, punyaAksesBK } from './utils.js';
import { showConfirm } from './modal.js';

export async function renderKasusPage(sesi) {
    const app = document.getElementById('app');
    const isBK = punyaAksesBK(sesi);
    const isKepsek = (sesi.roleList || []).includes('kepsek');
    const kelasWali = sesi.kelasWali || '';

    app.innerHTML = `
        <header class="page-header">
            <h1>Buku Kasus</h1>
            <p>${escapeHtml(sesi.nama)} &mdash; ${escapeHtml((sesi.roleList || []).join(', '))}</p>
        </header>

        ${isBK ? `
        <section class="card">
            <h2>Tambah Kasus</h2>
            <form id="formTambahKasus">
                <div class="form-group">
                    <label>NIS Siswa</label>
                    <input type="text" id="kasusNis" required placeholder="Masukkan NIS">
                </div>
                <div class="form-group">
                    <label>Tanggal Mulai</label>
                    <input type="date" id="kasusTanggal" required>
                </div>
                <div class="form-group">
                    <label>Kategori</label>
                    <input type="text" id="kasusKategori" required placeholder="Contoh: Keluarga, Akademik, Sosial-Emosional">
                </div>
                <div class="form-group">
                    <label>Ringkasan / Kronologi</label>
                    <textarea id="kasusRingkasan" required rows="4"></textarea>
                </div>
                <div class="form-group">
                    <label>Tingkat Kerahasiaan</label>
                    <select id="kasusKerahasiaan">
                        <option value="Normal">Normal (Wali Kelas & Kepsek lihat detail)</option>
                        <option value="Sangat Rahasia">Sangat Rahasia (Wali Kelas & Kepsek cuma lihat "ada kasus aktif")</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Tindak Lanjut (opsional)</label>
                    <input type="text" id="kasusTindakLanjut" placeholder="Bisa diisi menyusul">
                </div>
                <button type="submit" class="btn-primary">Simpan</button>
            </form>
        </section>` : ''}

        <section class="card">
            <h2>${isBK || isKepsek ? 'Rekap Semua Kasus' : 'Kasus Kelas ' + escapeHtml(kelasWali)}</h2>
            <div id="daftarKasusContainer">Memuat data...</div>
        </section>
    `;

    if (isBK) setupFormTambahKasus();
    muatDaftarKasus(isBK, isBK || isKepsek, kelasWali);
}

function setupFormTambahKasus() {
    const form = document.getElementById('formTambahKasus');
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const nis = document.getElementById('kasusNis').value.trim();
        if (!validateNis(nis)) {
            showNotification('Format NIS tidak valid.', 'error');
            return;
        }
        const data = {
            nis: nis,
            tanggalMulai: document.getElementById('kasusTanggal').value,
            kategori: document.getElementById('kasusKategori').value.trim(),
            ringkasan: document.getElementById('kasusRingkasan').value.trim(),
            tingkatKerahasiaan: document.getElementById('kasusKerahasiaan').value,
            tindakLanjut: document.getElementById('kasusTindakLanjut').value.trim()
        };
        if (!data.kategori || !data.ringkasan) {
            showNotification('Kategori dan ringkasan wajib diisi.', 'error');
            return;
        }

        showGlobalLoading('Menyimpan kasus...');
        try {
            await postJson('tambahKasus', { data: data });
            showNotification('Kasus berhasil disimpan.', 'success');
            form.reset();
            muatDaftarKasus(true, true, '');
        } catch (err) {
            showNotification('Gagal menyimpan: ' + err.message, 'error');
        } finally {
            hideGlobalLoading();
        }
    });
}

async function muatDaftarKasus(isBK, lihatSemua, kelasWali) {
    const container = document.getElementById('daftarKasusContainer');
    showGlobalLoading('Memuat data kasus...');
    try {
        const list = lihatSemua
            ? await postJson('getAllKasus', {})
            : await postJson('getKasusKelas', { kelas: kelasWali });

        if (!list.length) {
            container.innerHTML = '<p>Belum ada catatan kasus.</p>';
            return;
        }

        container.innerHTML = `
            <table class="tabel-data">
                <thead>
                    <tr>
                        <th>Nama</th><th>Kelas</th><th>Kategori</th><th>Ringkasan</th>
                        <th>Status</th><th>Kerahasiaan</th>${isBK ? '<th></th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${list.map(function (k) { return renderBarisKasus(k, isBK); }).join('')}
                </tbody>
            </table>
        `;

        if (isBK) {
            container.querySelectorAll('[data-update-id]').forEach(function (btn) {
                btn.addEventListener('click', function () { bukaUpdateKasus(btn.dataset.updateId, lihatSemua, kelasWali); });
            });
        }
    } catch (err) {
        container.innerHTML = '<p class="text-danger">Gagal memuat data: ' + escapeHtml(err.message) + '</p>';
    } finally {
        hideGlobalLoading();
    }
}

function renderBarisKasus(k, isBK) {
    // Versi sanitasi (non-BK, kasus Sangat Rahasia) tidak punya field kategori/ringkasan.
    const kategori = k.kategori !== undefined ? escapeHtml(k.kategori) : '<em>(rahasia)</em>';
    const ringkasan = k.ringkasan !== undefined ? escapeHtml(k.ringkasan) : '<em>Ada kasus aktif, detail dijaga kerahasiaannya oleh BK</em>';
    return `
        <tr>
            <td>${escapeHtml(k.nama)}</td>
            <td>${escapeHtml(k.kelas)}</td>
            <td>${kategori}</td>
            <td>${ringkasan}</td>
            <td>${escapeHtml(k.statusKasus)}</td>
            <td><span class="badge ${k.tingkatKerahasiaan === 'Sangat Rahasia' ? 'badge-danger' : 'badge-secondary'}">${escapeHtml(k.tingkatKerahasiaan)}</span></td>
            ${isBK ? `<td><button class="btn-secondary btn-sm" data-update-id="${escapeHtml(k.id)}">Update</button></td>` : ''}
        </tr>
    `;
}

async function bukaUpdateKasus(id, lihatSemua, kelasWali) {
    const statusBaru = prompt('Status kasus baru (Aktif/Dipantau/Selesai):');
    if (!statusBaru) return;
    const tindakLanjutBaru = prompt('Tindak lanjut terbaru (kosongkan kalau tidak berubah):') || undefined;

    showGlobalLoading('Menyimpan perubahan...');
    try {
        await postJson('updateKasus', { idKasus: id, data: { statusKasus: statusBaru, tindakLanjut: tindakLanjutBaru } });
        showNotification('Kasus berhasil diperbarui.', 'success');
        muatDaftarKasus(true, lihatSemua, kelasWali);
    } catch (err) {
        showNotification('Gagal memperbarui: ' + err.message, 'error');
    } finally {
        hideGlobalLoading();
    }
}
