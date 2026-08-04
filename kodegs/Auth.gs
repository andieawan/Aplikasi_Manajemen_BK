/**
 * Auth.gs — disamakan dengan kode ASLI go_absen_siswa
 * (github.com/andieawan/go_absen_siswa: kodegs/Auth.gs, kodegs/Roles.gs,
 * kodegs/Config.gs, js/ssocookie.js, js/config.js).
 *
 * Model SSO yang benar (dikonfirmasi dari kode asli):
 * - Cookie `sso_session` (nama = CONFIG.SESSION_KEY di frontend, BUKAN
 *   secret) disimpan browser dengan Domain=.smkibupakusari.sch.id oleh
 *   js/ssocookie.js, isinya JSON {username, token, ...} hasil login.
 * - Backend Apps Script TIDAK membaca cookie itu langsung. Frontend BK
 *   yang baca cookie (pola sama seperti getSsoCookie() di go_absen_siswa),
 *   lalu kirim username+token itu eksplisit di body request ke Web App BK.
 * - Token = "username|expiry|hmacSignature", diverifikasi verifikasiToken()
 *   pakai SESSION_SECRET_KEY yang disimpan di Script Properties (BUKAN
 *   konstanta di kode) — auto-generate kalau kosong.
 *
 * !! WAJIB DILAKUKAN SEBELUM DEPLOY !!
 * Set Script Property `SESSION_SECRET_KEY` di project BK ini dengan NILAI
 * PERSIS SAMA seperti yang ada di Script Properties project go_absen_siswa
 * (Project Settings > Script Properties di kedua project, salin manual).
 * Kalau dibiarkan kosong, getSessionSecret() di bawah akan melempar error
 * dengan sengaja (BUKAN auto-generate) -- supaya tidak diam-diam pakai
 * secret yang beda dan semua token dari go_absen_siswa gagal tervalidasi
 * tanpa pesan jelas.
 */

// Sama persis dengan SESSION_DURATION_MS di kodegs/Config.gs go_absen_siswa (12 jam).
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

function getSessionSecret() {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('SESSION_SECRET_KEY');
  if (!secret) {
    throw new Error(
      'SESSION_SECRET_KEY belum di-set di Script Properties project BK. ' +
      'Salin nilai persis dari Script Properties go_absen_siswa -- JANGAN biarkan ter-generate otomatis di sini.'
    );
  }
  return secret;
}

function hmacHex(payload) {
  const bytes = Utilities.computeHmacSha256Signature(payload, getSessionSecret());
  return bytes.map(function (b) { return ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0'); }).join('');
}

function buatToken(username) {
  const expiry = Date.now() + SESSION_DURATION_MS;
  const payload = username + '|' + expiry;
  return payload + '|' + hmacHex(payload);
}

function verifikasiToken(token, usernameDiharapkan) {
  if (!token || typeof token !== 'string') {
    return { valid: false, message: 'Sesi tidak valid, silakan login ulang.' };
  }
  const parts = token.split('|');
  if (parts.length !== 3) {
    return { valid: false, message: 'Sesi tidak valid, silakan login ulang.' };
  }
  const username = parts[0], expiryStr = parts[1], signature = parts[2];
  const expiry = Number(expiryStr);
  if (!expiry || Date.now() > expiry) {
    return { valid: false, message: 'Sesi sudah habis, silakan login ulang.' };
  }
  if (username !== usernameDiharapkan) {
    return { valid: false, message: 'Sesi tidak cocok dengan akun ini, silakan login ulang.' };
  }
  if (hmacHex(username + '|' + expiryStr) !== signature) {
    return { valid: false, message: 'Sesi tidak valid, silakan login ulang.' };
  }
  return { valid: true, username: username };
}

// Disalin persis dari kodegs/Roles.gs go_absen_siswa: kolom J (index 9,
// 0-indexed) di Akun_Guru, comma-separated, huruf kecil, default ['guru']
// kalau kosong.
const KOLOM_ROLE_0INDEXED = 9;

function parseRoleList(rawValue) {
  const roles = String(rawValue || '')
    .split(',')
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(function (s) { return s !== ''; });
  return roles.length > 0 ? roles : ['guru'];
}

/** Buka spreadsheet Master Guru (SPREADSHEET_MASTER_GURU_ID dari Config.gs). */
function getMasterGuruSs() {
  return SpreadsheetApp.openById(SPREADSHEET_MASTER_GURU_ID);
}

function getAkunGuru(username) {
  const ss = getMasterGuruSs();
  const sheet = ss.getSheetByName('Akun_Guru');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      return {
        username: data[i][0],
        nama: data[i][2],
        kelasWali: data[i][5] ? String(data[i][5]).trim() : '',
        roleList: parseRoleList(data[i][KOLOM_ROLE_0INDEXED])
      };
    }
  }
  return null;
}

/**
 * Dipanggil dari Router.gs dengan username+token yang dikirim frontend
 * (dibaca dari cookie sso_session oleh frontend BK).
 * return null kalau tidak valid, atau { username, nama, roleList, kelasWali }.
 */
function getSessionUser(username, token) {
  if (!username || !token) return null;
  const cek = verifikasiToken(token, username);
  if (!cek.valid) return null;
  const akun = getAkunGuru(username);
  if (!akun) return null;
  // Token asli disertakan (BUKAN untuk BK app sendiri -- BK app sudah
  // memvalidasinya di atas -- tapi untuk diteruskan ke go_absen_siswa saat
  // PresensiService.gs perlu memanggil action getAbsenUntukBK di sana,
  // supaya go_absen_siswa bisa verifikasi ulang dengan skema yang sama).
  akun._tokenAsli = token;
  return akun;
}

/**
 * Cek apakah user sesi sekarang punya salah satu role yang diizinkan.
 * 'superadmin' SELALU lolos di sini, apa pun allowedRoles-nya -- akses
 * penuh ke semua fitur, sama seperti 'bk'. Sengaja diletakkan di 1 titik
 * pusat ini (bukan ditambahkan manual ke tiap pemanggilan hasRole() di
 * *Service.gs) supaya konsisten otomatis untuk fitur baru ke depannya.
 */
function hasRole(user, allowedRoles) {
  if (!user || !user.roleList) return false;
  if (user.roleList.indexOf('superadmin') !== -1) return true;
  return user.roleList.some(function (r) { return allowedRoles.indexOf(r) !== -1; });
}

/** Cek apakah user adalah wali kelas dari kelas tertentu. */
function isWaliKelasDari(user, kelas) {
  return !!user && !!user.kelasWali && user.kelasWali === kelas;
}

// =====================================================================
// LOGIN MANUAL (selain lewat SSO cookie dari go_absen_siswa)
// Hashing (hashPassword/generateSalt) DISALIN PERSIS dari
// go_absen_siswa/kodegs/Auth.gs -- WAJIB identik, karena keduanya
// membaca/menulis kolom salt(G)+hash(H) yang sama di sheet Akun_Guru
// yang sama. Kalau algoritmanya beda, password yang diganti lewat 1
// aplikasi akan gagal divalidasi di aplikasi satunya.
// =====================================================================

const MAX_PERCOBAAN_LOGIN = 5;
const DURASI_KUNCI_DETIK = 15 * 60;

function hashPassword(password, salt) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt);
  return rawHash.map(function (b) { return ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0'); }).join('');
}

function generateSalt() {
  return Utilities.getUuid().replace(/-/g, '');
}

/**
 * Login manual langsung ke app BK (tidak lewat go_absen_siswa dulu).
 * return { success, data: {username, token, nama, kelasWali, roleList}, message }
 * Frontend WAJIB menulis hasilnya ke cookie SSO (setSsoCookie()) supaya
 * tetap saling terhubung dengan go_absen_siswa (SSO 2 arah).
 */
function handleLoginBK(username, password) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'loginFailBK_' + username;
  const percobaan = Number(cache.get(cacheKey) || 0);
  if (percobaan >= MAX_PERCOBAAN_LOGIN) {
    return { success: false, message: 'Terlalu banyak percobaan login gagal. Coba lagi dalam 15 menit.' };
  }

  const ss = getMasterGuruSs();
  const sheet = ss.getSheetByName('Akun_Guru');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] !== username) continue;

    const storedHash = data[i][7];
    let passwordValid = false;
    let perluUpgradeHash = false;

    if (storedHash) {
      let salt = data[i][6];
      if (!salt) {
        salt = generateSalt();
        sheet.getRange(i + 1, 7).setValue(salt);
      }
      passwordValid = (hashPassword(password, salt) === storedHash);
    } else {
      passwordValid = (data[i][1] === password);
      if (passwordValid) perluUpgradeHash = true;
    }

    if (!passwordValid) break;

    const roleList = parseRoleList(data[i][KOLOM_ROLE_0INDEXED]);
    if (roleList.indexOf('nonaktif') !== -1) {
      return { success: false, message: 'Akun ini telah dinonaktifkan. Hubungi admin sekolah.' };
    }

    cache.remove(cacheKey);

    if (perluUpgradeHash) {
      try {
        const saltBaru = data[i][6] || generateSalt();
        const hashBaru = hashPassword(password, saltBaru);
        sheet.getRange(i + 1, 7).setValue(saltBaru);
        sheet.getRange(i + 1, 8).setValue(hashBaru);
        sheet.getRange(i + 1, 2).clearContent();
      } catch (upgradeError) {
        Logger.log('Auto-upgrade hash GAGAL untuk user ' + username + ': ' + upgradeError.toString());
      }
    }

    return {
      success: true,
      data: {
        username: username,
        token: buatToken(username),
        nama: data[i][2],
        kelasWali: data[i][5] ? String(data[i][5]).trim() : '',
        roleList: roleList
      }
    };
  }

  cache.put(cacheKey, String(percobaan + 1), DURASI_KUNCI_DETIK);
  return { success: false, message: 'Username atau password salah.' };
}
