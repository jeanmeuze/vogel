// GET /api/leaderboard -> public score boards.
//   best / top     : all runs (every mode): highest score per player, top 10 runs ever
//   hardBest / hardTop : the same, hard runs only
//   nmBest / nmTop : the same, nightmare runs only
//   causes         : top 10 causes of death with the number of deaths (all runs)
const store = require('../lib/store');
const { send, query, cookieId } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    const b = await store.leaderboard();
    const me = query(req).get('id') || cookieId(req);
    // player ids stay private (they act as the device's key); only flag the viewer's own rows
    const row = (r) => ({ you: r.id === me, name: r.name, score: r.score, mode: r.mode, at: r.created_at });
    return send(res, 200, { best: b.best.map(row), top: b.top.map(row), hardBest: b.hardBest.map(row), hardTop: b.hardTop.map(row), nmBest: b.nmBest.map(row), nmTop: b.nmTop.map(row), causes: b.causes });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'store' });
  }
};
