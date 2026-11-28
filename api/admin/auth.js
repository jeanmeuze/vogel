// Admin password.
//   GET  /api/admin/auth                 -> { setup: true } when no password exists yet
//   POST /api/admin/auth {password}      -> first time: sets it; after that: checks it
const store = require('../../lib/store');
const { readJson, send, hashPassword, checkPassword } = require('../../lib/http');

const KEY = 'admin_password';

module.exports = async (req, res) => {
  try {
    const stored = await store.getSetting(KEY);
    if (req.method === 'GET') return send(res, 200, { setup: !stored });
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    const { password } = await readJson(req);
    const pw = String(password || '');
    if (!stored) {
      if (pw.length < 6) return send(res, 400, { error: 'too_short' });
      const created = await store.setSettingOnce(KEY, hashPassword(pw));
      if (!created) return send(res, 409, { error: 'already_set' });
      return send(res, 200, { ok: true, created: true });
    }
    if (!checkPassword(pw, stored)) return send(res, 401, { error: 'password' });
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'store' });
  }
};

module.exports.KEY = KEY;
