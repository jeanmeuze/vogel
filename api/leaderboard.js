// GET /api/leaderboard -> public score boards.
//   best / top     : all runs (normal + nightmare): highest score per player, top 10 runs ever
//   nmBest / nmTop : the same, nightmare runs only
const store = require('../lib/store');
const { send, query, cookieId } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    const b = await store.leaderboard();
    const me = query(req).get('id') || cookieId(req);
    // player ids stay private (they act as the device's key); only flag the viewer's own rows
    const row = (r) => ({ you: r.id === me, name: r.name, score: r.score, nightmare: r.nightmare, at: r.created_at });
    return send(res, 200, { best: b.best.map(row), top: b.top.map(row), nmBest: b.nmBest.map(row), nmTop: b.nmTop.map(row) });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'store' });
  }
};
