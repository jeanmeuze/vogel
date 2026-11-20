// Admin API (header x-pin = ADMIN_PIN)
//   GET    /api/admin/users              -> all users
//   PATCH  /api/admin/users {id, nightmare: bool}
//   DELETE /api/admin/users {id}
const store = require('../../lib/store');
const { ID_RE, readJson, send, adminOk } = require('../../lib/http');

module.exports = async (req, res) => {
  if (!adminOk(req)) return send(res, 401, { error: 'pin' });
  try {
    if (req.method === 'GET') {
      const users = (await store.list()).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
      return send(res, 200, { store: store.kind, users });
    }
    const b = await readJson(req);
    if (!ID_RE.test(b.id || '')) return send(res, 400, { error: 'bad_id' });
    if (req.method === 'PATCH') {
      const u = await store.get(b.id);
      if (!u) return send(res, 404, { error: 'unknown' });
      if (typeof b.nightmare === 'boolean') u.nightmare = b.nightmare;
      await store.put(u);
      return send(res, 200, { user: u });
    }
    if (req.method === 'DELETE') {
      await store.del(b.id);
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'method' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'store' });
  }
};
