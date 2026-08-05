import { postJson } from './api.js';
import { escapeHtml } from './utils.js';

/**
 * Render HTML 2 dropdown: Kelas -> Nama. Value dropdown Nama = NIS siswa
 * (pencocokan tetap pakai NIS, cuma UI-nya tidak lagi minta ketik NIS
 * manual). idPrefix dipakai supaya id elemen unik per form, mis. 'plg'
 * menghasilkan #plgKelas dan #plgNama.
 */
export function renderSiswaPickerHTML(idPrefix, labelKelas, labelNama) {
    return `
        <div class="form-group">
            <label>${escapeHtml(labelKelas || 'Kelas')}</label>
            <select id="${idPrefix}Kelas" required><option value="">Memuat kelas...</option></select>
        </div>
        <div class="form-group">
            <label>${escapeHtml(labelNama || 'Nama Siswa')}</label>
            <select id="${idPrefix}Nama" required disabled><option value="">-- Pilih kelas dulu --</option></select>
        </div>
    `;
}

/**
 * Pasang interaksi dropdown Kelas -> Nama. Panggil SETELAH renderSiswaPickerHTML()
 * ter-pasang ke DOM (mis. lewat app.innerHTML).
 *
 * kelasTerkunci: kalau diisi (mis. kelasWali milik Wali Kelas), dropdown
 * Kelas dikunci ke 1 pilihan itu saja -- dipakai di form yang boleh diakses
 * Wali Kelas (mis. Prestasi), supaya mereka tidak bisa pilih kelas lain.
 */
export async function setupSiswaPicker(idPrefix, kelasTerkunci) {
    const selectKelas = document.getElementById(idPrefix + 'Kelas');
    const selectNama = document.getElementById(idPrefix + 'Nama');
    if (!selectKelas || !selectNama) return; // halaman sudah ditinggalkan

    async function muatSiswa(kelas) {
        if (!kelas) {
            selectNama.innerHTML = '<option value="">-- Pilih kelas dulu --</option>';
            selectNama.disabled = true;
            return;
        }
        selectNama.disabled = true;
        selectNama.innerHTML = '<option value="">Memuat siswa...</option>';
        try {
            const daftarSiswa = await postJson('getSiswaAktifKelas', { kelas: kelas });
            if (!selectNama.isConnected) return; // halaman berpindah selagi menunggu
            if (!daftarSiswa.length) {
                selectNama.innerHTML = '<option value="">(Tidak ada siswa aktif)</option>';
                return;
            }
            selectNama.innerHTML = '<option value="">-- Pilih Nama --</option>' +
                daftarSiswa.map(function (s) {
                    return `<option value="${escapeHtml(s.nis)}">${escapeHtml(s.nama)}</option>`;
                }).join('');
            selectNama.disabled = false;
        } catch (err) {
            selectNama.innerHTML = '<option value="">Gagal memuat siswa</option>';
        }
    }

    try {
        const daftarKelas = kelasTerkunci ? [kelasTerkunci] : await postJson('getDaftarKelas', {});
        if (!selectKelas.isConnected) return;
        selectKelas.innerHTML = (kelasTerkunci ? '' : '<option value="">-- Pilih Kelas --</option>') +
            daftarKelas.map(function (k) { return `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`; }).join('');
        if (kelasTerkunci) {
            selectKelas.disabled = true;
            await muatSiswa(kelasTerkunci);
        }
    } catch (err) {
        selectKelas.innerHTML = '<option value="">Gagal memuat kelas</option>';
        return;
    }

    selectKelas.addEventListener('change', function () { muatSiswa(selectKelas.value); });
}

/** Ambil NIS yang sedang terpilih di picker (dipakai saat submit form). */
export function getNisTerpilih(idPrefix) {
    const el = document.getElementById(idPrefix + 'Nama');
    return el ? el.value : '';
}
