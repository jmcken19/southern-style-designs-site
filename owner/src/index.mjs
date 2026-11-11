// Owner editor service (Cloudflare Worker) – lets the business owner change photos and reviews.
// Everything sits behind Cloudflare Access, and every API call re-checks the Access token itself
// (see auth.mjs). The GitHub write token exists only as a Worker secret.
import { authenticate } from './auth.mjs';
import { github } from './github.mjs';
import { sniffType } from './images.mjs';
import { photosRoutes } from './photos.mjs';
import { reviewsRoutes } from './reviews.mjs';
import { textRoutes } from './text.mjs';
import config from '../../client.config.json';
import reviewsContent from '../../content/reviews.json';
import siteContent from '../../content/site.json';
import textContent from '../../content/text.json';
import { routes as siteRoutes } from '../../src/site/routes.mjs';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const DAILY_LIMITS = { upload: 400, publish: 120, save: 1000 };

class HttpError extends Error { constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; } }

const now = () => new Date().toISOString();
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });

function securityHeaders(res, { html = false } = {}) {
  const h = new Headers(res.headers);
  h.set('X-Content-Type-Options', 'nosniff');
  // The editor shows its own page preview in a frame; everything else may never be framed.
  h.set('X-Frame-Options', /frame-ancestors 'self'/.test(h.get('Content-Security-Policy') || '') ? 'SAMEORIGIN' : 'DENY');
  h.set('Referrer-Policy', 'same-origin');
  h.set('Strict-Transport-Security', 'max-age=31536000');
  h.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (html && !h.has('Content-Security-Policy')) {
    h.set('Content-Security-Policy', "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) {
        const res = await handleApi(request, env, url, ctx);
        return securityHeaders(res);
      }
      // Static editor screens. Cloudflare Access protects these too; the API check above is the real gate.
      const res = await env.ASSETS.fetch(request);
      return securityHeaders(res, { html: (res.headers.get('content-type') || '').includes('text/html') });
    } catch (err) {
      if (err instanceof HttpError) return securityHeaders(json({ error: err.message, ...err.extra }, err.status));
      console.error('unhandled', err && err.stack || err);
      return securityHeaders(json({ error: 'Something went wrong on our side. Your work is saved up to your last "Saved" message. Please try again in a minute.' }, 500));
    }
  },
};

// Owners edit on a laptop only (house rule – set ALLOW_PHONES=true to allow phones). Phones get a friendly refusal.
// This is a house rule, not a security boundary – sign-in is the security boundary.
export function isPhone(ua) {
  ua = String(ua || '');
  return /iPhone|iPod|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(ua) || (/Android/i.test(ua) && /Mobile/i.test(ua));
}

async function handleApi(request, env, url, ctx) {
  const user = await authenticate(request, env);
  if (!user) throw new HttpError(401, 'Please sign in again.', { signIn: true });
  if (env.ALLOW_PHONES !== 'true' && isPhone(request.headers.get('User-Agent'))) {
    throw new HttpError(403, 'The website editor works on your laptop only. Please open your bookmark on your laptop.', { laptopOnly: true });
  }

  const method = request.method;
  if (!['GET', 'HEAD'].includes(method)) {
    // CSRF: browsers cannot add this header cross-site without a CORS preflight, which we never allow.
    if (request.headers.get('X-Site-Editor') !== '1') throw new HttpError(403, 'Blocked request.');
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) throw new HttpError(403, 'Blocked request.');
  }
  if (method === 'OPTIONS') throw new HttpError(405, 'Not allowed.');

  const parts = url.pathname.split('/').filter(Boolean).slice(1); // after "api"
  const A = { env, db: env.DB, user, url, request, ctx };

  if (parts[0] === 'me' && method === 'GET') {
    return json({
      email: user.email, role: user.role, support: supportInfo(env), site: { url: publicBase(env), name: config.client?.name || '' },
      features: { slideshow: config.features?.slideshow !== false, reviews: config.features?.reviews !== false },
      pages: editorPages(env),
      spots: Object.fromEntries(Object.entries(config.photoSpots || {}).map(([k, s]) => [k, { label: s.label, where: s.where, page: s.page, tip: s.tip || '', min: s.minEdge || 800 }])),
    });
  }
  if (parts[0] === 'homepage') return photosHandler()(A, parts, method);
  if (parts[0] === 'reviews' && config.features?.reviews !== false) return reviewsHandler()(A, parts, method, idempotent);
  if (parts[0] === 'text') return textHandler()(A, parts, method, idempotent);
  if (parts[0] === 'publish-status' && method === 'GET') return json(await publishStatus(A, parts[1]));
  if (parts[0] === 'publish-retry' && method === 'POST') return json(await publishRetry(A, parts[1]));
  throw new HttpError(404, 'Not found.');
}

/* ---------- helpers ---------- */

const H = () => ({ HttpError, json, now, readJsonBody, needRevision, rateLimit, logEvent, idempotent, publicBase, config });
let _reviews;
function reviewsHandler() { return (_reviews ||= reviewsRoutes(H())); }
let _photos;
function photosHandler() { return (_photos ||= photosRoutes(H())); }
let _text;
function textHandler() { return (_text ||= textRoutes(H())); }

/** The site's pages for the editor's page picker. One page per review is left out, except the first one under
 *  "More pages" (with the "page not found" page), so the words that only show there can be changed too.
 *  routes() gets the same ctx shape as in the build (site, config, reviews, url), so a page list that reads
 *  ctx.site (e.g. one page per service) works in the editor too. */
function editorPages(env) {
  const rp = config.reviewsPath || '/reviews/';
  const base = publicBase(env);
  const all = siteRoutes({ site: siteContent, config, text: textContent, reviews: reviewsContent.items || [], preview: true, siteUrl: '', buildId: 'editor', url: (p) => (/^(https?:|mailto:|tel:|sms:)/.test(p) ? p : base + p) });
  const isReview = (r) => r.path.startsWith(rp) && r.path !== rp;
  const oneReview = all.find(isReview);
  return [
    ...all.filter((r) => !isReview(r)).map((r) => ({ path: r.path, title: r.title, ...(r.more ? { more: true } : {}) })),
    ...(oneReview ? [{ path: oneReview.path, title: 'One review (example)', more: true }] : []),
    { path: '/404', title: 'Page not found', more: true },
  ];
}

function supportInfo(env) {
  return { name: env.SUPPORT_NAME || config.owner?.supportName || '', email: env.SUPPORT_EMAIL || '', phone: env.SUPPORT_PHONE || '' };
}
function publicBase(env) { return (env.PUBLIC_SITE_URL || '').replace(/\/$/, ''); }

async function logEvent(A, action, item = null, detail = null) {
  await A.db.prepare('INSERT INTO events (at, actor, item, action, detail) VALUES (?, ?, ?, ?, ?)')
    .bind(now(), A.user.email, item, action, detail ? JSON.stringify(detail).slice(0, 2000) : null).run();
}

async function rateLimit(A, kind) {
  const since = new Date(Date.now() - 86400_000).toISOString();
  const row = await A.db.prepare("SELECT COUNT(*) AS n FROM events WHERE actor = ? AND at > ? AND action LIKE ?").bind(A.user.email, since, kind + '%').first();
  if ((row?.n || 0) >= DAILY_LIMITS[kind]) throw new HttpError(429, 'That is a lot of changes for one day, so the editor paused to be safe. Please contact your website helper if you need more today.');
}

/** Same request sent twice (double tap, flaky signal) returns the first result instead of doing it twice. */
async function idempotent(A, fn) {
  const key = A.request.headers.get('Idempotency-Key');
  if (!key || !/^[A-Za-z0-9-]{8,64}$/.test(key)) throw new HttpError(400, 'Please refresh the page and try again.');
  const k = `${A.user.email}:${key}`;
  const existing = await A.db.prepare('SELECT response FROM idem WHERE key = ?').bind(k).first();
  if (existing) {
    if (existing.response) return json(JSON.parse(existing.response));
    throw new HttpError(409, 'This is still being processed. Please wait a moment.');
  }
  await A.db.prepare('INSERT INTO idem (key, actor, created_at) VALUES (?, ?, ?)').bind(k, A.user.email, Date.now()).run();
  try {
    const result = await fn();
    await A.db.prepare('UPDATE idem SET response = ? WHERE key = ?').bind(JSON.stringify(result), k).run();
    A.ctx?.waitUntil?.(A.db.prepare('DELETE FROM idem WHERE created_at < ?').bind(Date.now() - 2 * 86400_000).run());
    return json(result);
  } catch (e) {
    await A.db.prepare('DELETE FROM idem WHERE key = ?').bind(k).run(); // allow a real retry
    throw e;
  }
}

function needRevision(body) {
  const rev = Number(body?.baseRevision);
  if (!Number.isInteger(rev) || rev < 1) throw new HttpError(400, 'Please refresh the page and try again.');
  return rev;
}

async function readJsonBody(request, max = 64 * 1024) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > max) throw new HttpError(413, 'That was too much text to save at once.');
  const text = await request.text();
  if (text.length > max) throw new HttpError(413, 'That was too much text to save at once.');
  try { return JSON.parse(text || '{}'); } catch { throw new HttpError(400, 'Please refresh the page and try again.'); }
}

async function publishStatus(A, sha) {
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new HttpError(400, 'Bad request.');
  const base = publicBase(A.env);
  const gh = github(A.env);
  let deployedBuild = null;
  try {
    const v = await fetch(`${base}/version.json?t=${Date.now()}`, { cf: { cacheTtl: 0 }, headers: { 'Cache-Control': 'no-cache' } });
    if (v.ok) deployedBuild = (await v.json()).build;
  } catch { /* site unreachable: treat as still publishing */ }
  if (deployedBuild === sha || (deployedBuild && await isAncestor(A, sha, deployedBuild))) return { state: 'live' };
  let wf = 'unknown';
  try { wf = await gh.workflowState(sha); } catch { /* ignore */ }
  if (wf === 'failure') return { state: 'failed' };
  return { state: 'publishing', workflow: wf };
}

async function isAncestor(A, sha, head) {
  const res = await fetch(`${A.env.GITHUB_API || 'https://api.github.com'}/repos/${A.env.GITHUB_REPO}/compare/${sha}...${head}`, {
    headers: { Authorization: `Bearer ${A.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'site-owner-editor' },
  });
  if (!res.ok) return false;
  const c = await res.json();
  return c.status === 'ahead' || c.status === 'identical';
}

async function publishRetry(A, sha) {
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new HttpError(400, 'Bad request.');
  await github(A.env).rerun(sha);
  await logEvent(A, 'publish-retry', null, { sha });
  return { ok: true };
}

export { sniffType };
