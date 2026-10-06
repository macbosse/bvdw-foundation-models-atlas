// Frontend-only Dev-Server ohne Secrets: liefert die statischen Dateien aus und leitet
// /api/* an eine laufende Instanz weiter (Default: Produktion). Praktisch für reine
// UI-Arbeiten, wenn kein lokaler vercel dev mit Supabase-Credentials gewünscht ist.
// Verwendung: node scripts/dev-static.js            → http://localhost:3000
//             API_BASE=https://… PORT=4000 node scripts/dev-static.js
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);
const API_BASE = (process.env.API_BASE || 'https://bosses-foundation-models.vercel.app').replace(/\/$/, '');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/')) {
    try {
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
      const upstream = await fetch(API_BASE + url.pathname + url.search, { method: req.method, headers: { 'content-type': req.headers['content-type'] || 'application/json' }, body });
      res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' });
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (e) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy-Fehler: ' + e.message }));
    }
    return;
  }
  let file = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (file === '/' || file === '') file = '/index.html';
  const path = join(ROOT, file);
  try {
    const s = await stat(path);
    const target = s.isDirectory() ? join(path, 'index.html') : path;
    const data = await readFile(target);
    res.writeHead(200, { 'content-type': MIME[extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`Frontend: http://localhost:${PORT}  (API → ${API_BASE})`));
