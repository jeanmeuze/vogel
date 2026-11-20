// POST /api/score {id, score, nightmare} -> stores run count and best scores per mode.
const store = require('../lib/store');
const { ID_RE, readJson, send, publicUser } = require('../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const b = await readJson(req);
  if (!ID_RE.test(b.id || '')) return send(res, 400, { error: 'bad_id' });
  const score = Math.max(0, Math.min(100000, Math.floor(Number(b.score) || 0)));
  try {
    const u = await store.get(b.id);
    if (!u) return send(res, 404, { error: 'unknown' });
    u.runs = (u.runs || 0) + 1;
    u.lastSeen = Date.now();
    if (b.nightmare) u.bestNightmare = Math.max(u.bestNightmare || 0, score);
    else u.best = Math.max(u.best || 0, score);
    await store.put(u);
    return send(res, 200, { user: publicUser(u) });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'store' });
  }
};
