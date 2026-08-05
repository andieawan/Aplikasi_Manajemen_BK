import { CONFIG } from './config.js';
import { getSsoCookie } from './ssocookie.js';

/**
 * Kirim action ke backend Apps Script BK. Pola sama seperti postJson() di
 * go_absen_siswa/js/api.js, tapi ditambah username+token dari cookie SSO
 * (backend tidak baca cookie langsung -- lihat catatan di kodegs/Auth.gs).
 * Kalau sesi tidak ada, panggil onSesiHilang() (biasanya render halaman
 * login) -- tidak lagi auto-redirect, karena BK sekarang punya login
 * sendiri, tidak wajib lewat go_absen_siswa dulu.
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
  // DEBUG SEMENTARA: buka DevTools > Console untuk lihat respons mentah tiap panggilan.
  console.log('[DEBUG postJson]', action, '-> status:', res.status, '| raw response:', rawText);

  let json;
  try {
    json = JSON.parse(rawText);
  } catch (parseErr) {
    throw new Error('Respons server bukan JSON valid (lihat Console untuk detail mentahnya): ' + rawText.substring(0, 200));
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
