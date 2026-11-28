// POST /api/register {id, name}
// A new player rolls the dice once: NIGHTMARE_CHANCE (default 1 in 4) gets the
// "nightmare only" stamp. The player is not told; their game is simply always nightmare.
const store = require('../lib/store');
const { ID_RE, NIGHTMARE_CHANCE, readJson, send, cleanName, setIdCookie } = require('../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const b = await readJson(req);
  if (!ID_RE.test(b.id || '')) return send(res, 400, { error: 'bad_id' });
  const name = cleanName(b.name);
  if (!name) return send(res, 400, { error: 'name' });
  try {
    const existing = await store.getUser(b.id);
    const u = await store.createUser(b.id, name, existing ? existing.nightmare : Math.random() < NIGHTMARE_CHANCE);
    setIdCookie(req, res, u.id);
    return send(res, 200, { user: { id: u.id, name: u.name, nightmare: u.nightmare, ...(await store.userBest(u.id)) } });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'store' });
  }
};
