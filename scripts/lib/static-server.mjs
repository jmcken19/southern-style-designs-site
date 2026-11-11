// A tiny local web server for dist/ (screenshots, playwright-cli click-throughs). Local use only.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
};

// Resolve a URL path to a file inside dir, or null (outside dir / missing). "/about" and "/about/" → about/index.html.
export async function resolveFile(dir, urlPath) {
  const root = resolve(dir);
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return null; }
  let file = resolve(join(root, p));
  if (file !== root && !file.startsWith(root + sep)) return null;
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    await stat(file);
    return file;
  } catch { return null; }
}

export function serveDir(dir, port = 0, host = '127.0.0.1') {
  const server = createServer(async (req, res) => {
    const file = await resolveFile(dir, new URL(req.url, 'http://x').pathname);
    let body = null;
    if (file) { try { body = await readFile(file); } catch { body = null; } }
    if (!body) {
      const nf = await resolveFile(dir, '/404.html');
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(nf ? await readFile(nf) : 'not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  });
  return new Promise((ok) => server.listen(port, host, () => ok(server)));
}
