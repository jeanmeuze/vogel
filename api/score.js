// POST /api/score {id, score, mode, cause, seconds, feathers, passed} -> stores the run.
// mode: 'normal' | 'hard' | 'nightmare' (older clients only send nightmare: bool).
const store = require('../lib/store');
const { ID_RE, readJson, send } = require('../lib/http');

const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const b = await readJson(req);
  if (!ID_RE.test(b.id || '')) return send(res, 400, { error: 'bad_id' });
  try {
    const u = await store.getUser(b.id);
    if (!u) return send(res, 404, { error: 'unknown' });
    await store.addRun(u.id, {
      score: int(b.score, 100000),
      mode: ['normal', 'hard', 'nightmare'].includes(b.mode) ? b.mode : b.nightmare ? 'nightmare' : 'normal',
      cause: /^[a-z]{2,20}$/.test(b.cause || '') ? b.cause : null,
      seconds: int(b.seconds, 36000), feathers: int(b.feathers, 100000), passed: int(b.passed, 100000),
    });
    return send(res, 200, { user: { id: u.id, name: u.name, nightmare: u.nightmare, ...(await store.userBest(u.id)) } });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'store' });
  }
};
