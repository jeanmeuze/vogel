// GET /api/me?id=...  -> the player's record (so admin changes reach the phone).
// Without an id (localStorage was cleared) the device cookie is used to recognise the player.
const store = require('../lib/store');
const { ID_RE, send, query, cookieId, setIdCookie } = require('../lib/http');

module.exports = async (req, res) => {
  const id = query(req).get('id') || cookieId(req);
  if (!ID_RE.test(id)) return send(res, 404, { error: 'unknown' });
  try {
    const u = await store.getUser(id, true);
    if (!u) return send(res, 404, { error: 'unknown' });
    setIdCookie(req, res, u.id);
    return send(res, 200, { user: { id: u.id, name: u.name, nightmare: u.nightmare, ...(await store.userBest(u.id)) } });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'store' });
  }
};
