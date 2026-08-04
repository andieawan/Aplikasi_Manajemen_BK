import { loginBK } from './api.js';
import { setSsoCookie } from './ssocookie.js';
import { showNotification, showGlobalLoading, hideGlobalLoading } from './utils.js';

export function renderLoginPage(onSuccess) {
    const app = document.getElementById('app');
    const nav = document.getElementById('mainNav');
    if (nav) nav.innerHTML = ''; // sembunyikan menu selama belum login

    app.innerHTML = `
        <section class="card" style="max-width:400px;margin:2rem auto;">
            <h1>Login Aplikasi Manajemen BK</h1>
            <p><em>Sudah login lewat aplikasi absensi? Cukup buka aplikasi ini lagi, sesi Anda otomatis kebaca.
            Kalau belum, login manual di bawah ini.</em></p>
            <form id="formLoginBK">
                <div class="form-group"><label>Username</label><input type="text" id="loginUsername" required></div>
                <div class="form-group"><label>Password</label><input type="password" id="loginPassword" required></div>
                <button type="submit" class="btn-primary">Login</button>
            </form>
        </section>
    `;

    document.getElementById('formLoginBK').addEventListener('submit', async function (e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        showGlobalLoading('Memeriksa akun...');
        try {
            const res = await loginBK(username, password);
            if (!res.success) {
                showNotification(res.message || 'Login gagal.', 'error');
                return;
            }
            // Tulis ke cookie SSO domain .smkibupakusari.sch.id -- supaya
            // sesi ini juga otomatis terbaca di go_absen_siswa (SSO 2 arah).
            setSsoCookie(res.data);
            onSuccess(res.data);
        } catch (err) {
            showNotification('Gagal terhubung ke server: ' + err.message, 'error');
        } finally {
            hideGlobalLoading();
        }
    });
}
