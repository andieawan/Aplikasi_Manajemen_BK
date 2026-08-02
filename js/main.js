import { initModalHandlers, showAlert } from './modal.js';
import { getSsoCookie } from './ssocookie.js';
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

document.addEventListener('DOMContentLoaded', async () => {
    initModalHandlers();

    sesiGlobal = getSsoCookie();
    if (!sesiGlobal || !sesiGlobal.username || !sesiGlobal.token) {
        await showAlert('Sesi tidak ditemukan. Silakan login lewat aplikasi absensi terlebih dahulu.', 'Sesi Tidak Valid', 'warning');
        return;
    }

    renderNav();
    window.addEventListener('hashchange', renderHalamanAktif);
    renderHalamanAktif();
});

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
    }).join('');
}

function renderHalamanAktif() {
    const hash = (location.hash || '#dashboard').substring(1);
    const menuAktif = MENU.find(function (m) { return m.hash === hash; }) || MENU[0];
    menuAktif.render(sesiGlobal);
}
