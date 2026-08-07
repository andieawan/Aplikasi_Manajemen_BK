import { postJson } from './api.js';
import { showGlobalLoading, hideGlobalLoading, showNotification, escapeHtml, punyaAksesBK } from './utils.js';
import { showConfirm } from './modal.js';
import { renderSiswaPickerHTML, setupSiswaPicker, getNisTerpilih } from './siswaPicker.js';

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
                ${renderSiswaPickerHTML('sr', 'Kelas', 'Nama Siswa')}
                <div class="form-group"><label>Keperluan</label><input type="text" id="srKeperluan"></div>
                <button type="submit" class="btn-primary">Generate Surat</button>
            </form>
            <div id="hasilSurat"></div>
        </section>` : '<p>Fitur ini hanya untuk BK.</p>'}
        ${isBK ? `<section class="card"><h2>Riwayat Surat</h2><div id="riwayatSurat">Memuat...</div></section>` : ''}
    `;

    if (!isBK) return;

    setupSiswaPicker('sr', null);

    // Pasang listener dulu (sebelum await apapun) -- kalau ini ditunda
    // sampai setelah await getJenisSuratAktif, ada risiko user sudah
    // pindah halaman duluan dan #formSurat sudah tidak ada lagi di DOM,
    // menyebabkan addEventListener dipanggil ke null.
    const formEl = document.getElementById('formSurat');
    if (formEl) {
        formEl.addEventListener('submit', async function (e) {
            e.preventDefault();
            const nis = getNisTerpilih('sr');
            if (!nis) { showNotification('Pilih kelas dan nama siswa.', 'error'); return; }
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
    }

    try {
        const jenisList = await postJson('getJenisSuratAktif', {});
        const selectEl = document.getElementById('srJenis');
        if (selectEl) {
            selectEl.innerHTML = jenisList.map(function (j) {
                return `<option value="${escapeHtml(j.jenisSurat)}">${escapeHtml(j.jenisSurat)}</option>`;
            }).join('');
        }
    } catch (err) {
        showNotification('Gagal memuat jenis surat: ' + err.message, 'error');
    }

    muatRiwayat();
}

const MAX_UKURAN_BERKAS_MB = 8;

async function muatRiwayat() {
    const container = document.getElementById('riwayatSurat');
    if (!container) return; // halaman sudah ditinggalkan sebelum data ini selesai dimuat
    try {
        const list = await postJson('getRiwayatSurat', {});
        if (!list.length) { container.innerHTML = '<p>Belum ada surat dibuat.</p>'; return; }
        container.innerHTML = `
            <table class="tabel-data">
                <thead><tr><th>No. Surat</th><th>Jenis</th><th>Nama</th><th>Kelas</th><th>Dokumen</th><th>Berkas Tanda Tangan (Scan)</th><th>Status Penanganan</th><th></th></tr></thead>
                <tbody>${list.map(function (s) { return renderBarisSurat(s); }).join('')}</tbody>
            </table>`;

        container.querySelectorAll('[data-upload-id]').forEach(function (input) {
            input.addEventListener('change', function () { unggahBerkasScan(input.dataset.uploadId, input.files[0]); });
        });
        container.querySelectorAll('[data-status-id]').forEach(function (btn) {
            btn.addEventListener('click', function () { ubahStatusPenanganan(btn.dataset.statusId); });
        });
    } catch (err) {
        container.innerHTML = '<p class="text-danger">Gagal memuat: ' + escapeHtml(err.message) + '</p>';
    }
}

function renderBarisSurat(s) {
    const kolomBerkas = s.linkBerkasScan
        ? `<a href="${escapeHtml(s.linkBerkasScan)}" target="_blank">Lihat scan</a>`
        : `<div style="display:flex;gap:0.25rem;flex-wrap:wrap;">
               <label class="btn-secondary btn-sm" style="cursor:pointer;">
                   Upload
                   <input type="file" accept="application/pdf,image/*" data-upload-id="${escapeHtml(s.id)}" style="display:none;">
               </label>
               <label class="btn-secondary btn-sm" style="cursor:pointer;">
                   Ambil Foto
                   <input type="file" accept="image/*" capture="environment" data-upload-id="${escapeHtml(s.id)}" style="display:none;">
               </label>
           </div>`;
    const badgeStatus = s.statusPenanganan === 'Selesai' ? 'badge-secondary' : 'badge-warning';
    return `
        <tr>
            <td data-label="No. Surat">${escapeHtml(s.nomorSurat)}</td>
            <td data-label="Jenis">${escapeHtml(s.jenisSurat)}</td>
            <td data-label="Nama">${escapeHtml(s.nama)}</td>
            <td data-label="Kelas">${escapeHtml(s.kelas)}</td>
            <td data-label="Dokumen"><a href="${escapeHtml(s.linkDokumen)}" target="_blank">Buka</a></td>
            <td data-label="Berkas TTD" id="berkasCell-${escapeHtml(s.id)}">${kolomBerkas}</td>
            <td data-label="Status" id="statusCell-${escapeHtml(s.id)}"><span class="badge ${badgeStatus}">${escapeHtml(s.statusPenanganan)}</span></td>
            <td><button class="btn-secondary btn-sm" data-status-id="${escapeHtml(s.id)}">Update Status</button></td>
        </tr>
    `;
}

async function ubahStatusPenanganan(idSurat) {
    const statusBaru = (await showConfirm('Tandai status sebagai "Selesai"? (Batal = tetap "Proses")', 'Status Penanganan Surat'))
        ? 'Selesai' : 'Proses';

    showGlobalLoading('Menyimpan perubahan...');
    try {
        await postJson('updateStatusPenangananSurat', { idSurat: idSurat, status: statusBaru });
        showNotification('Status berhasil diperbarui.', 'success');
        const sel = document.getElementById('statusCell-' + idSurat);
        if (sel) {
            const badgeClass = statusBaru === 'Selesai' ? 'badge-secondary' : 'badge-warning';
            sel.innerHTML = `<span class="badge ${badgeClass}">${escapeHtml(statusBaru)}</span>`;
        }
    } catch (err) {
        showNotification('Gagal memperbarui: ' + err.message, 'error');
    } finally {
        hideGlobalLoading();
    }
}

/** Baca file jadi base64 (tanpa prefix data:...;base64,) lalu kirim ke backend. */
function unggahBerkasScan(idSurat, file) {
    if (!file) return;
    if (file.size > MAX_UKURAN_BERKAS_MB * 1024 * 1024) {
        showNotification('Ukuran file maksimal ' + MAX_UKURAN_BERKAS_MB + ' MB.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function () {
        const base64Penuh = reader.result; // "data:<mime>;base64,<data>"
        const base64Murni = base64Penuh.substring(base64Penuh.indexOf(',') + 1);

        showGlobalLoading('Mengunggah berkas...');
        try {
            const hasil = await postJson('uploadBerkasSurat', {
                idSurat: idSurat,
                fileBase64: base64Murni,
                namaFile: file.name,
                mimeType: file.type
            });
            showNotification('Berkas berhasil diunggah.', 'success');
            const sel = document.getElementById('berkasCell-' + idSurat);
            if (sel) sel.innerHTML = `<a href="${escapeHtml(hasil.linkBerkasScan)}" target="_blank">Lihat scan</a>`;
        } catch (err) {
            showNotification('Gagal mengunggah: ' + err.message, 'error');
        } finally {
            hideGlobalLoading();
        }
    };
    reader.onerror = function () {
        showNotification('Gagal membaca file.', 'error');
    };
    reader.readAsDataURL(file);
}
