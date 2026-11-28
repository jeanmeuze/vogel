// Postgres (Neon, via the Vercel Marketplace integration that sets DATABASE_URL).
// Tables are created automatically on first use.
//
//   users    one row per device/player (name, nightmare_only stamp)
//   runs     every attempt ever played
//   settings key/value (admin password hash)
const { neon } = require('@neondatabase/serverless');

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error('DATABASE_URL is not set. Link the Neon database (see README) or run `vercel env pull .env.local`.');
const sql = neon(url);

let ready;
function init() {
  ready = ready || (async () => {
    await sql`CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      name text NOT NULL,
      nightmare_only boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS runs (
      id bigserial PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      score integer NOT NULL,
      nightmare boolean NOT NULL,
      seconds integer NOT NULL DEFAULT 0,
      feathers integer NOT NULL DEFAULT 0,
      passed integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS runs_user_idx ON runs(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS runs_score_idx ON runs(score DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text NOT NULL)`;
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

const userCols = (u) => u && ({
  id: u.id, name: u.name, nightmare: u.nightmare_only,
  createdAt: u.created_at, lastSeen: u.last_seen,
});

module.exports = {
  async getUser(id, touch = false) {
    await init();
    const rows = touch
      ? await sql`UPDATE users SET last_seen = now() WHERE id = ${id} RETURNING *`
      : await sql`SELECT * FROM users WHERE id = ${id}`;
    return userCols(rows[0]) || null;
  },

  async createUser(id, name, nightmare) {
    await init();
    const rows = await sql`INSERT INTO users (id, name, nightmare_only) VALUES (${id}, ${name}, ${nightmare})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, last_seen = now() RETURNING *`;
    return userCols(rows[0]);
  },

  async addRun(userId, r) {
    await init();
    await sql`INSERT INTO runs (user_id, score, nightmare, seconds, feathers, passed)
      VALUES (${userId}, ${r.score}, ${r.nightmare}, ${r.seconds}, ${r.feathers}, ${r.passed})`;
    await sql`UPDATE users SET last_seen = now() WHERE id = ${userId}`;
  },

  async userBest(userId) {
    await init();
    const [b] = await sql`SELECT COALESCE(MAX(score), 0)::int AS best,
      COALESCE(MAX(score) FILTER (WHERE nightmare), 0)::int AS best_nm, COUNT(*)::int AS runs
      FROM runs WHERE user_id = ${userId}`;
    return { best: b.best, bestNightmare: b.best_nm, runs: b.runs };
  },

  // Highest score per player + top 10 runs ever, for all runs and for nightmare runs only.
  async leaderboard() {
    await init();
    const [best, top, nmBest, nmTop] = await Promise.all([
      sql`SELECT DISTINCT ON (r.user_id) r.user_id AS id, u.name, r.score, r.nightmare, r.created_at
          FROM runs r JOIN users u ON u.id = r.user_id ORDER BY r.user_id, r.score DESC, r.created_at`,
      sql`SELECT r.user_id AS id, u.name, r.score, r.nightmare, r.created_at
          FROM runs r JOIN users u ON u.id = r.user_id ORDER BY r.score DESC, r.created_at LIMIT 10`,
      sql`SELECT DISTINCT ON (r.user_id) r.user_id AS id, u.name, r.score, r.nightmare, r.created_at
          FROM runs r JOIN users u ON u.id = r.user_id WHERE r.nightmare ORDER BY r.user_id, r.score DESC, r.created_at`,
      sql`SELECT r.user_id AS id, u.name, r.score, r.nightmare, r.created_at
          FROM runs r JOIN users u ON u.id = r.user_id WHERE r.nightmare ORDER BY r.score DESC, r.created_at LIMIT 10`,
    ]);
    const sort = (a) => a.sort((x, y) => y.score - x.score || new Date(x.created_at) - new Date(y.created_at)).slice(0, 100);
    return { best: sort(best), top, nmBest: sort(nmBest), nmTop };
  },

  // ---- admin
  async listUsersWithRuns() {
    await init();
    const [users, runs] = await Promise.all([
      sql`SELECT * FROM users ORDER BY last_seen DESC`,
      sql`SELECT id, user_id, score, nightmare, seconds, feathers, passed, created_at FROM runs ORDER BY created_at DESC`,
    ]);
    const byUser = new Map(users.map((u) => [u.id, { ...userCols(u), runs: [] }]));
    for (const r of runs) {
      const u = byUser.get(r.user_id);
      if (u) u.runs.push({ id: r.id, score: r.score, nightmare: r.nightmare, seconds: r.seconds, feathers: r.feathers, passed: r.passed, at: r.created_at });
    }
    return [...byUser.values()];
  },
  async setNightmare(id, on) {
    await init();
    const rows = await sql`UPDATE users SET nightmare_only = ${on} WHERE id = ${id} RETURNING *`;
    return userCols(rows[0]) || null;
  },
  async deleteUser(id) {
    await init();
    await sql`DELETE FROM users WHERE id = ${id}`;
  },

  async getSetting(key) {
    await init();
    const rows = await sql`SELECT value FROM settings WHERE key = ${key}`;
    return rows[0] ? rows[0].value : null;
  },
  // Only inserts when the key does not exist yet; returns true when it was inserted.
  async setSettingOnce(key, value) {
    await init();
    const rows = await sql`INSERT INTO settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO NOTHING RETURNING key`;
    return rows.length > 0;
  },
};
