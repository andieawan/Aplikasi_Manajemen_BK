import { initModalHandlers, showConfirm } from './modal.js';
import { getSsoCookie, deleteSsoCookie } from './ssocookie.js';
import { showNotification } from './utils.js';
import { setSessionExpiredHandler } from './api.js';
import { renderLoginPage } from './login.js';
import { renderPelanggaranPage } from './pelanggaran.js';
import { renderKasusPage } from './kasus.js';
import { renderPresensiPage } from './presensi.js';
import { renderPrestasiPage } from './prestasi.js';
import { renderHomeVisitPage } from './homevisit.js';
import { renderDashboardPage } from './dashboard.js';
import { renderSuratPage } from './surat.js';

const MENU = [
    { hash: 'dashboard', label: 'Dashboard', render: renderDashboardPage },
    { hash: 'pelanggaran', label: 'Pelanggaran', render: renderPelanggaranPage },
    { hash: 'kasus', label: 'Buku Kasus', render: renderKasusPage },
    { hash: 'presensi', label: 'Presensi', render: renderPresensiPage },
    { hash: 'prestasi', label: 'Prestasi', render: renderPrestasiPage },
    { hash: 'homevisit', label: 'Home Visit', render: renderHomeVisitPage },
    { hash: 'surat', label: 'Surat', render: renderSuratPage }
];

let sesiGlobal = null;

document.addEventListener('DOMContentLoaded', () => {
    initModalHandlers();

    // Temuan audit #1: daftarkan handler sesi kadaluarsa SEKALI di sini
    // (bukan api.js import main.js langsung -- hindari circular import).
    setSessionExpiredHandler(tanganiSesiHilang);

    sesiGlobal = getSsoCookie();
    if (!sesiGlobal || !sesiGlobal.username || !sesiGlobal.token) {
        renderLoginPage(function (sesiBaru) {
            sesiGlobal = sesiBaru;
            mulaiApp();
        });
        return;
    }

    mulaiApp();
});

/**
 * Dipanggil postJson() (lewat api.js) saat backend menandai sessionExpired.
 * Halaman fitur yang memanggil postJson() TETAP menampilkan pesan error-nya
 * sendiri (postJson masih throw setelah ini) -- jadi user lihat pesan dulu,
 * baru dialihkan ke login setelah jeda singkat, bukan silent redirect.
 */
function tanganiSesiHilang(pesan) {
    showNotification(pesan || 'Sesi Anda berakhir, silakan login ulang.', 'error');
    deleteSsoCookie();
    sesiGlobal = null;

    setTimeout(function () {
        renderLoginPage(function (sesiBaru) {
            sesiGlobal = sesiBaru;
            mulaiApp();
        });
    }, 1500);
}

function mulaiApp() {
    renderNav();
    window.addEventListener('hashchange', renderHalamanAktif);
    renderHalamanAktif();
}

function renderNav() {
    let nav = document.getElementById('mainNav');
    if (!nav) {
        nav = document.createElement('nav');
        nav.id = 'mainNav';
        nav.className = 'main-nav';
        document.querySelector('.container').prepend(nav);
    }
    nav.innerHTML = MENU.map(function (m) {
        return `<a href="#${m.hash}" class="nav-link">${m.label}</a>`;
    }).join('') + `<a href="#" id="btnLogout" class="nav-link" style="margin-left:auto;color:var(--danger-color);">Logout</a>`;

    document.getElementById('btnLogout').addEventListener('click', async function (e) {
        e.preventDefault();
        const yakin = await showConfirm('Yakin ingin logout?', 'Logout');
        if (!yakin) return;
        deleteSsoCookie();
        location.hash = '';
        location.reload();
    });
}

function renderHalamanAktif() {
    const hash = (location.hash || '#dashboard').substring(1);
    const menuAktif = MENU.find(function (m) { return m.hash === hash; }) || MENU[0];
    menuAktif.render(sesiGlobal);
}
