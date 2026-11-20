// POST /api/register {id, name, restore?: {nightmare}}
// First registration rolls the dice: NIGHTMARE_CHANCE (default 1/3) => forced nightmare forever.
// `restore` lets a client re-create a record the server lost (memory store), keeping its fate.
const store = require('../lib/store');
const { ID_RE, NIGHTMARE_CHANCE, readJson, send, cleanName, publicUser } = require('../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const b = await readJson(req);
  if (!ID_RE.test(b.id || '')) return send(res, 400, { error: 'bad_id' });
  const name = cleanName(b.name);
  if (!name) return send(res, 400, { error: 'name' });
  try {
    let u = await store.get(b.id);
    const now = Date.now();
    if (!u) {
      const restored = b.restore && typeof b.restore.nightmare === 'boolean';
      u = { id: b.id, name, nightmare: restored ? b.restore.nightmare : Math.random() < NIGHTMARE_CHANCE,
        createdAt: now, lastSeen: now, runs: 0, best: 0, bestNightmare: 0, restored: !!restored };
    } else {
      u.name = name;
      u.lastSeen = now;
    }
    await store.put(u);
    return send(res, 200, { user: publicUser(u) });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'store' });
  }
};
