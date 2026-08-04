import { initModalHandlers } from './modal.js';
import { getSsoCookie } from './ssocookie.js';
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

    sesiGlobal = getSsoCookie();
    if (!sesiGlobal || !sesiGlobal.username || !sesiGlobal.token) {
        // Bukan cuma alert lagi -- BK sekarang punya login manual sendiri,
        // tidak wajib lewat go_absen_siswa dulu (lihat login.js).
        renderLoginPage(function (sesiBaru) {
            sesiGlobal = sesiBaru;
            mulaiApp();
        });
        return;
    }

    mulaiApp();
});

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
    }).join('');
}

function renderHalamanAktif() {
    const hash = (location.hash || '#dashboard').substring(1);
    const menuAktif = MENU.find(function (m) { return m.hash === hash; }) || MENU[0];
    menuAktif.render(sesiGlobal);
}
