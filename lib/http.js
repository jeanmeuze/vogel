// Tiny helpers that work both on Vercel serverless functions and the local server.
const crypto = require('crypto');

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const NIGHTMARE_CHANCE = Number(process.env.NIGHTMARE_CHANCE || 1 / 3);

async function readJson(req) {
  try {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  } catch { return {}; }
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 10000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

const query = (req) => new URL(req.url, 'http://x').searchParams;

function cleanName(n) {
  return String(n || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}

// Admin auth: header x-pin must equal ADMIN_PIN. Without ADMIN_PIN the admin API is
// disabled, except locally (non-production) where it defaults to "1234".
function adminOk(req) {
  const pin = process.env.ADMIN_PIN || (process.env.VERCEL || process.env.NODE_ENV === 'production' ? '' : '1234');
  if (!pin) return false;
  const a = Buffer.from(String(req.headers['x-pin'] || ''));
  const b = Buffer.from(pin);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function publicUser(u) {
  return { id: u.id, name: u.name, nightmare: !!u.nightmare, best: u.best || 0, bestNightmare: u.bestNightmare || 0, runs: u.runs || 0 };
}

module.exports = { ID_RE, NIGHTMARE_CHANCE, readJson, send, query, cleanName, adminOk, publicUser };
