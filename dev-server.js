'use strict';
// Local dev / Docker server. On Vercel this file is NOT used: Vercel serves /public
// statically and runs /api/**/*.js as serverless functions. This server mimics that.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const API_DIR = path.join(__dirname, 'api');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webmanifest': 'application/manifest+json' };

function serveStatic(res, pathname) {
  if (pathname.endsWith('/')) pathname += 'index.html';
  let file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html'; // cleanUrls
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Niet gevonden'); }
    const ext = path.extname(file);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (pathname === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (pathname.startsWith('/api/')) {
    const file = path.normalize(path.join(API_DIR, pathname.slice(5) + '.js'));
    if (!file.startsWith(API_DIR) || !fs.existsSync(file)) { res.writeHead(404); return res.end('{"error":"not_found"}'); }
    try { return await require(file)(req, res); }
    catch (e) { console.error(e); res.writeHead(500); return res.end('{"error":"server"}'); }
  }
  serveStatic(res, decodeURIComponent(pathname));
}).listen(PORT, () => console.log(`Wie ben ik? on http://localhost:${PORT}  (admin: /admin)`));
