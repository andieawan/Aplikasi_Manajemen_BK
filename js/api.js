import { CONFIG } from './config.js';
import { getSsoCookie } from './ssocookie.js';

/**
 * Kirim action ke backend Apps Script BK. Pola sama seperti postJson() di
 * go_absen_siswa/js/api.js, tapi ditambah username+token dari cookie SSO
 * (backend tidak baca cookie langsung -- lihat catatan di kodegs/Auth.gs).
 */
export async function postJson(action, data) {
  const sesi = getSsoCookie(); // { username, token, ... } atau null
  if (!sesi) {
    window.location.href = 'login.html'; // arahkan ke halaman login go_absen_siswa
    return null;
  }

  const res = await fetch(CONFIG.BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari CORS preflight ke Apps Script
    body: JSON.stringify(Object.assign({ action, username: sesi.username, token: sesi.token }, data))
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data;
}
