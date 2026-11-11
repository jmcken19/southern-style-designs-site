// Runs the real owner editor Worker in Miniflare (Cloudflare's local runtime) with:
//  - a real RSA-signed Cloudflare Access token check (we act as the Access issuer),
//  - an in-memory fake of the GitHub API (or the real API when GITHUB_MODE=real),
//  - a fake public site whose /version.json follows the fake repo's head commit,
//  - a fake email service that records messages.
import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync, createSign, createHash, randomBytes } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TEAM = 'site-test.cloudflareaccess.com';
export const AUD = 'test-aud-123';
export const OWNER = 'owner@example.com';
export const MAINT = 'helper@example.com';
export const SITE = 'https://site.example.test';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };

const b64u = (b) => Buffer.from(b).toString('base64url');
export function accessToken(email, { aud = AUD, exp = Math.floor(Date.now() / 1000) + 3600, key = privateKey, kid = 'k1' } = {}) {
  const h = b64u(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const p = b64u(JSON.stringify({ email, aud: [aud], exp, iat: Math.floor(Date.now() / 1000), iss: `https://${TEAM}` }));
  const s = createSign('RSA-SHA256').update(`${h}.${p}`).sign(key);
  return `${h}.${p}.${b64u(s)}`;
}
export const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;

/* ---------------- fake GitHub ---------------- */
export class FakeGitHub {
  constructor() {
    this.blobs = new Map(); this.trees = new Map(); this.commits = new Map();
    this.files = new Map(); // path -> blob sha (current head)
    this.runs = new Map(); // commit sha -> conclusion
    this.failNextRun = false; this.raceOnce = false;
    const init = this.commitTree(new Map(), null, 'init');
    this.head = init;
  }
  sha(x) { return createHash('sha1').update(x).digest('hex'); }
  putBlob(bytes) { const s = this.sha(Buffer.concat([Buffer.from('blob'), bytes, randomBytes(0)])); this.blobs.set(s, bytes); return s; }
  commitTree(files, parent, message) {
    const treeSha = this.sha(JSON.stringify([...files.entries()].sort()));
    this.trees.set(treeSha, new Map(files));
    const c = this.sha(treeSha + (parent || '') + message + Math.random());
    this.commits.set(c, { tree: treeSha, parent, message });
    return c;
  }
  seed(path, content) {
    const files = new Map(this.trees.get(this.commits.get(this.head).tree));
    files.set(path, this.putBlob(Buffer.from(content)));
    this.head = this.commitTree(files, this.head, 'seed ' + path);
  }
  headFiles() { return this.trees.get(this.commits.get(this.head).tree); }
  read(path) { const s = this.headFiles().get(path); return s ? this.blobs.get(s) : null; }
  async handle(req) {
    const url = new URL(req.url);
    const p = url.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, '');
    const body = req.method === 'GET' ? null : await req.json().catch(() => null);
    const j = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
    if (!/^Bearer .+/.test(req.headers.get('authorization') || '')) return j({ message: 'auth' }, 401);
    let m;
    if ((m = p.match(/^\/contents\/(.+)$/))) {
      const path = decodeURI(m[1]); const files = this.headFiles();
      if (files.has(path)) return j({ sha: files.get(path), content: this.blobs.get(files.get(path)).toString('base64'), type: 'file', path, name: path.split('/').pop() });
      const kids = [...files.keys()].filter((f) => f.startsWith(path + '/') && !f.slice(path.length + 1).includes('/'));
      return kids.length ? j(kids.map((f) => ({ path: f, name: f.split('/').pop(), type: 'file', sha: files.get(f) }))) : j({ message: 'Not Found' }, 404);
    }
    if (p === '/git/ref/heads/main') return j({ object: { sha: this.head } });
    if ((m = p.match(/^\/git\/commits\/(\w+)$/)) && req.method === 'GET') return j({ sha: m[1], tree: { sha: this.commits.get(m[1]).tree } });
    if (p === '/git/blobs') return j({ sha: this.putBlob(Buffer.from(body.content, 'base64')) }, 201);
    if (p === '/git/trees') {
      const files = new Map(this.trees.get(body.base_tree));
      for (const e of body.tree) { if (e.sha === null) files.delete(e.path); else files.set(e.path, e.sha); }
      const treeSha = this.sha(JSON.stringify([...files.entries()].sort()));
      this.trees.set(treeSha, files);
      return j({ sha: treeSha }, 201);
    }
    if (p === '/git/commits') { const c = this.sha(body.tree + body.parents[0] + body.message + Math.random()); this.commits.set(c, { tree: body.tree, parent: body.parents[0], message: body.message }); return j({ sha: c }, 201); }
    if (p === '/git/refs/heads/main' && req.method === 'PATCH') {
      if (this.raceOnce) { this.raceOnce = false; this.seed('README-race.md', 'someone else pushed'); }
      const c = this.commits.get(body.sha);
      if (c.parent !== this.head) return j({ message: 'Update is not a fast forward' }, 422);
      const prevTree = this.headFiles();
      this.head = body.sha;
      this.runs.set(body.sha, this.failNextRun ? 'failure' : 'success'); this.failNextRun = false;
      if (this.onCommit) await this.onCommit(body.sha, prevTree, this.headFiles(), c.message);
      return j({ object: { sha: body.sha } });
    }
    if (p === '/actions/runs') {
      const sha = url.searchParams.get('head_sha');
      return j({ workflow_runs: this.runs.has(sha) ? [{ id: 1, status: 'completed', conclusion: this.runs.get(sha) }] : [] });
    }
    if (p.match(/^\/actions\/runs\/\d+\/rerun-failed-jobs$/)) { for (const k of this.runs.keys()) this.runs.set(k, 'success'); return j({}, 201); }
    if ((m = p.match(/^\/compare\/(\w+)\.\.\.(\w+)$/))) {
      let c = m[2]; while (c) { if (c === m[1]) return j({ status: m[1] === m[2] ? 'identical' : 'ahead' }); c = this.commits.get(c)?.parent; }
      return j({ status: 'diverged' });
    }
    return j({ message: 'unhandled ' + p }, 500);
  }
}

async function bundle() {
  const r = await build({ entryPoints: [join(root, 'owner/src/index.mjs')], bundle: true, format: 'esm', write: false, platform: 'neutral', loader: { '.json': 'json' } });
  return r.outputFiles[0].text;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain' };

export async function startEditor({ resend = true, port, mirror = null, siteUrl = SITE, persist = null } = {}) {
  const gh = new FakeGitHub();
  if (mirror) await mirror.attach(gh);
  const emails = [];
  const site = { deployed: null, deployDelayCalls: 1, calls: 0, deploy: true };
  const script = await bundle();
  const ui = join(root, 'owner/ui');
  const mf = new Miniflare({
    ...(port ? { port, host: '127.0.0.1' } : {}),
    modules: true, script, compatibilityDate: '2026-07-01',
    d1Databases: ['DB'], kvNamespaces: ['PHOTOS'],
    ...(persist ? { d1Persist: persist + '/d1', kvPersist: persist + '/kv' } : {}),
    bindings: {
      GITHUB_REPO: 'test/site', GITHUB_BRANCH: 'main', GITHUB_TOKEN: 'fake-token',
      PUBLIC_SITE_URL: siteUrl, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD,
      OWNER_EMAILS: OWNER, MAINTAINER_EMAILS: MAINT, NOTIFY_TO: MAINT,
      SUPPORT_NAME: 'Your Helper', SUPPORT_EMAIL: MAINT, SUPPORT_PHONE: '555-0100',
      ...(resend ? { RESEND_API_KEY: 're_test' } : {}),
    },
    serviceBindings: {
      ASSETS: async (req) => {
        let path = new URL(req.url).pathname; if (path === '/') path = '/index.html';
        try { const body = await readFile(join(ui, path.replace(/\.\.+/g, ''))); return new Response(body, { headers: { 'content-type': MIME[extname(path)] || 'application/octet-stream' } }); } catch { return new Response('not found', { status: 404 }); }
      },
    },
    outboundService: async (req) => {
      const u = new URL(req.url);
      if (u.host === TEAM && u.pathname === '/cdn-cgi/access/certs') return Response.json({ keys: [jwk] });
      if (mirror && u.host === 'api.github.com' && u.pathname.endsWith('/actions/runs')) return mirror.runs(u.searchParams.get('head_sha'));
      if (mirror && u.host === 'api.github.com' && u.pathname.includes('/compare/')) return mirror.compare(u.pathname);
      if (mirror && req.url.startsWith(siteUrl) && u.pathname.endsWith('/version.json')) return mirror.version();
      if (u.host === 'api.github.com') return gh.handle(req);
      if (u.origin === new URL(siteUrl).origin && u.pathname === '/version.json') {
        // The fake site "deploys" the head commit after a couple of status checks, unless the run failed.
        site.calls++;
        if (site.deploy && gh.runs.get(gh.head) === 'success' && site.calls % (site.deployDelayCalls + 1) === 0) site.deployed = gh.head;
        return site.deployed ? Response.json({ build: site.deployed }) : new Response('nope', { status: 404 });
      }
      if (u.host === 'api.resend.com') { const b = await req.json(); emails.push(b); return Response.json({ id: 'em_' + emails.length }); }
      return new Response('blocked in test: ' + req.url, { status: 599 });
    },
  });
  const migDir = join(root, 'owner/migrations');
  const migration = (await Promise.all((await readdir(migDir)).filter((f) => f.endsWith('.sql')).sort().map((f) => readFile(join(migDir, f), 'utf8')))).join(';\n');
  const db = await mf.getD1Database('DB');
  if (!persist || !existsSync(persist + '/.migrated')) for (const stmt of migration.replace(/--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean)) await db.prepare(stmt).run();
  if (persist) { mkdirSync(persist, { recursive: true }); writeFileSync(persist + '/.migrated', '1'); }
  if (!mirror) {
    // The fake repo starts as a copy of THIS client's content (so the tests adapt to every client).
    const config = JSON.parse(await readFile(join(root, 'client.config.json'), 'utf8'));
    if (existsSync(join(root, 'content/reviews.json'))) gh.seed('content/reviews.json', await readFile(join(root, 'content/reviews.json'), 'utf8'));
    if (existsSync(join(root, 'content/text.json'))) gh.seed('content/text.json', await readFile(join(root, 'content/text.json'), 'utf8'));
    const site = JSON.parse(await readFile(join(root, 'content/site.json'), 'utf8'));
    const seedFile = async (rel) => { if (existsSync(join(root, 'public', rel))) gh.seed(`public${rel}`, await readFile(join(root, 'public', rel))); };
    if (config.features?.slideshow !== false) {
      const own = (site.heroSlides || []).filter((s) => [800, 1400, 2000].every((w) => existsSync(join(root, 'public', `${s.src}-${w}.jpg`))));
      if (own.length) site.heroSlides = own;
      else if (existsSync(join(root, 'public/assets/img/hero-1-800.jpg'))) site.heroSlides = [{ id: 's-hero1', src: '/assets/img/hero-1', alt: 'Placeholder photo', focus: '50% 50%' }];
      site.heroSlideSeconds ??= 7; site.heroFade ??= false; site.heroAutoplay ??= true;
      for (const s of site.heroSlides || []) for (const w of [800, 1400, 2000]) await seedFile(`${s.src}-${w}.jpg`);
    }
    gh.seed('content/site.json', JSON.stringify(site, null, 2));
    for (const spot of Object.values(config.photoSpots || {})) for (const f of new Set([spot.defaults?.small, spot.defaults?.large])) if (f) await seedFile(f);
  }
  const url = port ? `http://127.0.0.1:${port}` : 'http://editor.test';
  const call = async (method, path, { as = OWNER, body, form, idem, headers = {}, token } = {}) => {
    const h = { 'X-Site-Editor': '1', ...headers };
    if (as) h['Cf-Access-Jwt-Assertion'] = token || accessToken(as);
    if (idem !== false && method !== 'GET') h['Idempotency-Key'] = idem || 'k' + randomBytes(8).toString('hex');
    let payload;
    if (form) { const r = new Response(form); h['Content-Type'] = r.headers.get('content-type'); payload = Buffer.from(await r.arrayBuffer()); } else if (body !== undefined) { payload = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
    // Miniflare's local connection very rarely drops a request (≈1 in 25 runs, seen on big uploads): retry it.
    // The same Idempotency-Key goes with the retry, so the editor never does a save twice.
    let res;
    for (let attempt = 1; ; attempt++) {
      try { res = await mf.dispatchFetch(url + path, { method, headers: h, body: payload }); break; } catch (e) {
        if (attempt >= 3 || !/fetch failed/.test(String(e?.message))) throw e;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
  return { mf, gh, emails, site, call, url, close: () => mf.dispose() };
}

/** Make a real JPEG with EXIF + GPS, using sharp. */
export async function testJpeg({ width = 1600, height = 1200, color = '#7a9', gps = true, label = '' } = {}) {
  const sharp = (await import('sharp')).default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" font-size="${Math.round(height / 6)}" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text></svg>`;
  let img = sharp(Buffer.from(svg)).jpeg({ quality: 80 });
  if (gps) img = img.withExifMerge({ IFD0: { Make: 'TestPhone', Model: 'GPS-Test' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '35/1 2/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '80/1 45/1 0/1' } });
  return img.toBuffer();
}

export async function listFixtures() { return readdir(join(root, 'tests')); }



/** This client's setup, for tests that must adapt to it (features switched off, other photo spots, other pages). */
export async function clientSetup() {
  const config = JSON.parse(await readFile(join(root, 'client.config.json'), 'utf8'));
  const site = JSON.parse(await readFile(join(root, 'content/site.json'), 'utf8'));
  const reviews = existsSync(join(root, 'content/reviews.json')) ? JSON.parse(await readFile(join(root, 'content/reviews.json'), 'utf8')).items || [] : [];
  const slideshow = config.features?.slideshow !== false;
  return {
    config, site, reviews, slideshow,
    reviewsOn: config.features?.reviews !== false,
    reviewsPath: config.reviewsPath || '/reviews/',
    reviewsFile: 'content/reviews.json',
    spots: Object.keys(config.photoSpots || {}),
  };
}
