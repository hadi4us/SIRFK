/***************************************************************************
 * Auth and session
 ***************************************************************************/
function hashPassword_(plainText) {
  const bytes = Utilities.newBlob(String(plainText || '')).getBytes();
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return hash.map(function(b) { return (b & 0xFF).toString(16).padStart(2, '0'); }).join('');
}

function saltedPasswordHash_(username, password) {
  return hashPassword_(normalizeKey_(username) + '|' + String(password || ''));
}

function verifyPassword_(storedPassword, inputPassword, username) {
  const stored = safeString_(storedPassword);
  const input = String(inputPassword || '');
  if (!stored) return false;

  if (stored.indexOf('sha256$') === 0) {
    return stored === 'sha256$' + saltedPasswordHash_(username, input);
  }

  // Backward compatibility: old ubahPassword() stored plain SHA-256 without salt.
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    return stored.toLowerCase() === hashPassword_(input).toLowerCase();
  }

  // Backward compatibility: initial USER_ROLE used plain text password.
  return stored === input;
}

function getUserRowByUsername_(username) {
  const sheet = ensureSheetHeaders_(APP.SHEETS.USER_ROLE, SHEET_HEADERS.USER_ROLE);
  const data = sheet.getDataRange().getValues();
  const usernameClean = normalizeKey_(username);
  for (let i = 1; i < data.length; i++) {
    const rowUser = normalizeKey_(data[i][0]);
    if (rowUser && rowUser === usernameClean) {
      return { sheet: sheet, rowNumber: i + 1, row: data[i] };
    }
  }
  return null;
}

function getUserByUsername_(username) {
  const found = getUserRowByUsername_(username);
  if (!found) return null;
  const row = found.row;
  const status = safeString_(row[4] || 'Aktif');
  if (status && status.toLowerCase() !== 'aktif') return null;
  return {
    email: safeString_(row[0]),
    role: safeString_(row[1] || 'VIEWER').toUpperCase(),
    nama: safeString_(row[3] || row[0])
  };
}

function createSession_(user) {
  const token = Utilities.getUuid();
  const payload = {
    email: user.email,
    role: user.role,
    nama: user.nama,
    createdAt: new Date().toISOString()
  };
  CacheService.getScriptCache().put('rfk_session_' + token, JSON.stringify(payload), APP.SESSION_TTL_SECONDS);
  return token;
}

function getSession_(token) {
  const tokenClean = safeString_(token);
  if (!tokenClean) return null;
  const raw = CacheService.getScriptCache().get('rfk_session_' + tokenClean);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}

function requireSession_(token, allowedRoles) {
  const session = getSession_(token);
  if (!session) throw new Error('Sesi login tidak valid atau sudah kedaluwarsa. Silakan login ulang.');
  const role = safeString_(session.role).toUpperCase();
  const allowed = (allowedRoles || APP.VIEW_ROLES).map(function(r) { return String(r).toUpperCase(); });
  if (allowed.indexOf(role) === -1) {
    throw new Error('Akses ditolak. Role ' + role + ' tidak berwenang untuk aksi ini.');
  }
  return session;
}

function prosesLoginKustom(username, password) {
  try {
    setupAllSheets();
    const found = getUserRowByUsername_(username);
    if (!found) {
      return { success: false, message: 'Kombinasi Username/Password salah atau tidak terdaftar.' };
    }

    const row = found.row;
    const user = {
      email: safeString_(row[0]),
      role: safeString_(row[1] || 'VIEWER').toUpperCase(),
      nama: safeString_(row[3] || row[0])
    };
    const status = safeString_(row[4] || 'Aktif');
    if (status && status.toLowerCase() !== 'aktif') {
      return { success: false, message: 'Akun tidak aktif. Hubungi administrator.' };
    }

    if (!verifyPassword_(row[2], password, user.email)) {
      logActivity_(user.email, 'LOGIN_GAGAL', 'USER_ROLE', user.email, null, null, 'FAILED', 'Password salah');
      return { success: false, message: 'Kombinasi Username/Password salah atau tidak terdaftar.' };
    }

    const stored = safeString_(row[2]);
    if (stored.indexOf('sha256$') !== 0) {
      found.sheet.getRange(found.rowNumber, 3).setValue('sha256$' + saltedPasswordHash_(user.email, password));
    }

    const token = createSession_(user);
    logActivity_(user.email, 'LOGIN', 'USER_ROLE', user.email, null, { role: user.role }, 'OK', 'Login berhasil');

    const stats = getDashboardStats_uncached_();
    return {
      success: true,
      user: user,
      token: token,
      sessionExpiresInSeconds: APP.SESSION_TTL_SECONDS,
      months: APP.MONTHS,
      stats: { pagu: stats.totalPagu, serapan: stats.totalRealisasi }
    };
  } catch (err) {
    return { success: false, message: 'Kesalahan Sistem: ' + err.message };
  }
}


function getCurrentSessionInfo(sessionToken) {
  try {
    const session = requireSession_(sessionToken, APP.VIEW_ROLES);
    return {
      success: true,
      user: {
        email: session.email,
        role: session.role,
        nama: session.nama
      },
      sessionExpiresInSeconds: APP.SESSION_TTL_SECONDS,
      months: APP.MONTHS
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function ubahPassword(username, lama, baru) {
  try {
    setupAllSheets();
    if (!username || !lama || !baru) throw new Error('Username, password lama, dan password baru wajib diisi.');
    if (String(baru).length < 6) throw new Error('Password baru minimal 6 karakter.');

    const found = getUserRowByUsername_(username);
    if (!found) return { success: false, message: 'Username tidak ditemukan.' };

    if (!verifyPassword_(found.row[2], lama, found.row[0])) {
      logActivity_(found.row[0], 'UBAH_PASSWORD_GAGAL', 'USER_ROLE', found.row[0], null, null, 'FAILED', 'Password lama salah');
      return { success: false, message: 'Password lama salah.' };
    }

    found.sheet.getRange(found.rowNumber, 3).setValue('sha256$' + saltedPasswordHash_(found.row[0], baru));
    logActivity_(found.row[0], 'UBAH_PASSWORD', 'USER_ROLE', found.row[0], null, { changed: true }, 'OK', 'Password berhasil diubah');
    return { success: true, message: 'Password berhasil diubah. Silakan login memakai password baru.' };
  } catch (err) {
    return { success: false, message: 'Error: ' + err.message };
  }
}

