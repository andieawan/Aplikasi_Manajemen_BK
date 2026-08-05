import { CONFIG } from './config.js';
import { getSsoCookie } from './ssocookie.js';

// Temuan audit #2: log respons mentah HANYA saat flag ini true. Jangan
// commit dengan nilai true -- ini bisa membocorkan data sensitif (mis.
// detail Kasus BK) ke siapa pun yang membuka DevTools di perangkat yang
// sedang login. Nyalakan sementara saat troubleshooting, matikan lagi
// sebelum push.
const DEBUG_API = false;

// Temuan audit #1: handler global saat sesi kadaluarsa/invalid -- di-set
// oleh main.js lewat setSessionExpiredHandler() saat inisialisasi. Pakai
// callback (bukan import main.js langsung dari sini) supaya tidak terjadi
// circular import (main.js -> pelanggaran.js/dst -> api.js -> main.js).
let onSessionExpired = null;

export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

/**
 * Kirim action ke backend Apps Script BK. Pola sama seperti postJson() di
 * go_absen_siswa/js/api.js, tapi ditambah username+token dari cookie SSO
 * (backend tidak baca cookie langsung -- lihat catatan di kodegs/Auth.gs).
 */
export async function postJson(action, data) {
  const sesi = getSsoCookie();
  if (!sesi) {
    throw new Error('Sesi tidak ditemukan, silakan login.');
  }

  const res = await fetch(CONFIG.BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari CORS preflight ke Apps Script
    body: JSON.stringify(Object.assign({ action, username: sesi.username, token: sesi.token }, data))
  });
  const rawText = await res.text();
  if (DEBUG_API) {
    console.log('[DEBUG postJson]', action, '-> status:', res.status, '| raw response:', rawText);
  }

  let json;
  try {
    json = JSON.parse(rawText);
  } catch (parseErr) {
    throw new Error('Respons server bukan JSON valid: ' + rawText.substring(0, 200));
  }

  // Sesi invalid/kadaluarsa -- picu handler global (bersihkan cookie +
  // render ulang halaman login), TAPI tetap lempar error di bawah supaya
  // halaman fitur yang memanggil ini masih sempat menampilkan pesan
  // singkat dulu, bukan silent redirect (lihat catatan di main.js).
  if (json.sessionExpired && onSessionExpired) {
    onSessionExpired(json.error || 'Sesi Anda berakhir, silakan login ulang.');
  }
  if (json.error) throw new Error(json.error);
  return json.data;
}

/**
 * Login manual langsung ke app BK -- skema respons beda dari action lain
 * (action 'login' ditangani terpisah di Router.gs, belum ada token saat ini
 * dipanggil, jadi TIDAK lewat postJson() di atas).
 */
export async function loginBK(username, password) {
  const res = await fetch(CONFIG.BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'login', username: username, password: password })
  });
  return res.json(); // { success, data?, message? }
}
