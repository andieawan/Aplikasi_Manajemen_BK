/**
 * Konfigurasi Global Frontend — Aplikasi Manajemen BK
 * Nilai SESSION_KEY & SSO_COOKIE_DOMAIN disalin PERSIS dari
 * go_absen_siswa/js/config.js supaya cookie SSO yang sama bisa dibaca.
 */
export const CONFIG = {
  BACKEND_URL: 'https://script.google.com/macros/s/AKfycbyhWM9ZelaYX3m5m5VBR7wkshH8LikwVpb0yEUcCcqNnVgJi2SC6BIIQzMKrudsj7N5/exec',

  APP_NAME: 'Aplikasi Manajemen BK',

  // WAJIB SAMA PERSIS dengan go_absen_siswa/js/config.js
  SESSION_KEY: 'sso_session',
  SSO_COOKIE_DOMAIN: '.smkibupakusari.sch.id',
  SSO_COOKIE_MAX_AGE_SECONDS: 12 * 60 * 60, // 12 jam, sama dengan SESSION_DURATION_MS backend

  DEFAULT_TIMEOUT: 60000
};

export default CONFIG;
