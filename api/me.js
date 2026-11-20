// GET /api/me?id=... -> current user record (so admin changes reach the player).
const store = require('../lib/store');
const { ID_RE, send, query, publicUser } = require('../lib/http');

module.exports = async (req, res) => {
  const id = query(req).get('id') || '';
  if (!ID_RE.test(id)) return send(res, 400, { error: 'bad_id' });
  try {
    const u = await store.get(id);
    if (!u) return send(res, 404, { error: 'unknown' });
    u.lastSeen = Date.now();
    await store.put(u);
    return send(res, 200, { user: publicUser(u) });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'store' });
  }
};
