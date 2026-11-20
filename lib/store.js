// User storage adapter. Interface: get(id), put(user), list(), del(id).
//
// - If Upstash Redis REST env vars are set (Vercel Marketplace "Upstash for Redis" sets
//   KV_REST_API_URL / KV_REST_API_TOKEN), users are stored in one Redis hash.
// - Otherwise an in-memory Map is used. Fine for local dev; on Vercel every serverless
//   instance has its own memory, so data is NOT reliable there. Swap in a real DB here
//   later (Postgres, Supabase, ...) by implementing the same four methods.

const KEY = 'oropendola:users';

function memoryStore() {
  const map = (globalThis.__oroUsers = globalThis.__oroUsers || new Map());
  return {
    kind: 'memory',
    async get(id) { return map.get(id) || null; },
    async put(u) { map.set(u.id, u); },
    async list() { return [...map.values()]; },
    async del(id) { map.delete(id); },
  };
}

function upstashStore(url, token) {
  async function cmd(...args) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
  }
  return {
    kind: 'upstash-redis',
    async get(id) { const v = await cmd('HGET', KEY, id); return v ? JSON.parse(v) : null; },
    async put(u) { await cmd('HSET', KEY, u.id, JSON.stringify(u)); },
    async list() {
      const arr = (await cmd('HGETALL', KEY)) || [];
      const out = [];
      for (let i = 1; i < arr.length; i += 2) out.push(JSON.parse(arr[i]));
      return out;
    },
    async del(id) { await cmd('HDEL', KEY, id); },
  };
}

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

module.exports = url && token ? upstashStore(url, token) : memoryStore();
