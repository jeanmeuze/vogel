// Tiny helpers that work both on Vercel serverless functions and the local server.
const crypto = require('crypto');

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const NIGHTMARE_CHANCE = Number(process.env.NIGHTMARE_CHANCE || 0.25); // 1 new player in 4
const COOKIE = 'oro_id';

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

// ---- device identity: the id lives in localStorage AND in a long-lived cookie, so a
// device is recognised even when one of the two gets cleared.
function cookieId(req) {
  const m = /(?:^|;\s*)oro_id=([A-Za-z0-9_-]{8,64})/.exec(req.headers.cookie || '');
  return m ? m[1] : '';
}
function setIdCookie(req, res, id) {
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
  res.setHeader('set-cookie', `${COOKIE}=${id}; Path=/; Max-Age=63072000; SameSite=Lax; HttpOnly${secure}`);
}

// ---- admin password (set on the first visit to /admin, stored as a scrypt hash)
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPassword(pw, stored) {
  if (!stored || !pw) return false;
  const [salt, hex] = stored.split(':');
  const a = crypto.scryptSync(String(pw), salt, 32);
  const b = Buffer.from(hex, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { ID_RE, NIGHTMARE_CHANCE, readJson, send, query, cleanName, cookieId, setIdCookie, hashPassword, checkPassword };
