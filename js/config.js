/**
 * Konfigurasi Global Frontend — Aplikasi Manajemen BK
 * Nilai SESSION_KEY & SSO_COOKIE_DOMAIN disalin PERSIS dari
 * go_absen_siswa/js/config.js supaya cookie SSO yang sama bisa dibaca.
 */
export const CONFIG = {
  BACKEND_URL: 'https://script.google.com/macros/s/AKfycbyMGAl2rTMzOEVkosA-QKNrVvo69x3WZPrYgRBRcVF9JL-K1guOv-zJAWnisfCZ1t8n/exec',

  APP_NAME: 'Aplikasi Manajemen BK',

  // WAJIB SAMA PERSIS dengan go_absen_siswa/js/config.js
  SESSION_KEY: 'sso_session',
  SSO_COOKIE_DOMAIN: '.smkibupakusari.sch.id',
  SSO_COOKIE_MAX_AGE_SECONDS: 12 * 60 * 60, // 12 jam, sama dengan SESSION_DURATION_MS backend

  DEFAULT_TIMEOUT: 60000
};

export default CONFIG;
