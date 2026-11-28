// Admin API (header x-admin-password = the password set on the first visit to /admin)
//   GET    /api/admin/users              -> all users with all their runs
//   PATCH  /api/admin/users {id, nightmare: bool}   (toggle the "nightmare only" stamp)
//   DELETE /api/admin/users {id}                    (removes the user and all their runs)
const store = require('../../lib/store');
const { ID_RE, readJson, send, checkPassword } = require('../../lib/http');
const { KEY } = require('./auth');

module.exports = async (req, res) => {
  try {
    if (!checkPassword(req.headers['x-admin-password'], await store.getSetting(KEY))) return send(res, 401, { error: 'password' });
    if (req.method === 'GET') return send(res, 200, { users: await store.listUsersWithRuns() });
    const b = await readJson(req);
    if (!ID_RE.test(b.id || '')) return send(res, 400, { error: 'bad_id' });
    if (req.method === 'PATCH') {
      if (typeof b.nightmare !== 'boolean') return send(res, 400, { error: 'nightmare' });
      const u = await store.setNightmare(b.id, b.nightmare);
      return u ? send(res, 200, { user: u }) : send(res, 404, { error: 'unknown' });
    }
    if (req.method === 'DELETE') {
      await store.deleteUser(b.id);
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'method' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'store' });
  }
};
