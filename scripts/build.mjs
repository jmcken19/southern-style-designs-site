#!/usr/bin/env node
// Builds the public website into dist/ (or OUT_DIR).
//   BASE_PATH  – path prefix for the GitHub Pages testing link, e.g. "/acme-site" ("" for a real domain)
//   PREVIEW    – "1" adds the testing banner, turns off the contact form and asks search engines not to index
//   SITE_URL   – full public URL (canonical links + sitemap on the live site)
//   BUILD_ID   – usually the git commit SHA; written to /version.json so the editor can confirm a change is live
//   OUT_DIR    – output folder (default dist; the live site uses dist-prod)
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { validateSlideshow, validateReviewsPath, HERO_SIZES } from '../src/lib/core.mjs';
import { sitePhoto, validatePhotos, validateSpotConfig } from '../src/lib/photos.mjs';
import { validateText } from '../src/lib/text.mjs';
import { redirectPage } from '../src/parts/index.mjs';
import { routes, renderRoute, notFoundHtml } from '../src/site/routes.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Flags work on every computer (Windows cmd can't do "PREVIEW=1 node …"): --preview, --out <dir>.
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const out = resolve(root, flag('--out') || process.env.OUT_DIR || 'dist');
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
const PREVIEW = process.env.PREVIEW === '1' || argv.includes('--preview');
const SITE_URL = process.env.SITE_URL || '';
let BUILD_ID = process.env.BUILD_ID || '';
if (!BUILD_ID) { try { BUILD_ID = execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { BUILD_ID = 'dev'; } }

const readJson = async (p) => JSON.parse(await readFile(join(root, p), 'utf8'));

/** Load and check everything. Any problem stops the build (so a broken change never goes live). */
export async function loadContent() {
  const config = await readJson('client.config.json');
  const site = await readJson('content/site.json');
  const text = await readJson('content/text.json'); // all wording (src/lib/text.mjs)
  const rFile = existsSync(join(root, 'content/reviews.json')) ? await readJson('content/reviews.json') : { items: [] };
  const reviews = rFile.items || [];
  const problems = [];
  problems.push(...validateReviewsPath(config.reviewsPath));
  problems.push(...validateSpotConfig(config.photoSpots));
  problems.push(...validateSlideshow(site));
  problems.push(...validatePhotos(site, config.photoSpots));
  problems.push(...validateText(text, site));
  for (const s of site.heroSlides || []) for (const w of HERO_SIZES) {
    if (!existsSync(join(root, 'public', `${s.src}-${w}.jpg`))) problems.push(`missing slideshow image public${s.src}-${w}.jpg`);
  }
  for (const k of Object.keys(config.photoSpots || {})) for (const f of ['small', 'large']) {
    const src = sitePhoto(site, config.photoSpots, k)[f];
    if (!existsSync(join(root, 'public', src))) problems.push(`missing image public${src} (photo spot "${k}")`);
  }
  const slugs = new Set();
  reviews.forEach((t, i) => {
    if (!/^[a-z0-9-]{1,80}$/.test(t.slug || '')) problems.push(`reviews[${i}].slug invalid`);
    if (slugs.has(t.slug)) problems.push(`reviews[${i}].slug duplicated`);
    slugs.add(t.slug);
    if (!t.title || !Array.isArray(t.text) || !t.text.length) problems.push(`reviews[${i}] needs a title and text`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date || '')) problems.push(`reviews[${i}].date must be YYYY-MM-DD`);
  });
  if (problems.length) throw new Error('Content problems:\n - ' + problems.join('\n - '));
  const removedReviewSlugs = (rFile.removedSlugs || []).filter((s) => /^[a-z0-9-]+$/.test(s) && !slugs.has(s));
  return { config, site, text, reviews, removedReviewSlugs };
}

async function writePage(path, html) {
  const file = path.endsWith('.html') ? join(out, path) : join(out, path, 'index.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
}

async function main() {
  const content = await loadContent();
  const ctx = {
    ...content,
    preview: PREVIEW,
    siteUrl: SITE_URL,
    buildId: BUILD_ID.slice(0, 12),
    url: (p) => (/^(https?:|mailto:|tel:|sms:)/.test(p) ? p : BASE + p),
  };
  if (existsSync(out)) await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(join(root, 'public'), out, { recursive: true });

  const pages = routes(ctx);
  for (const r of pages) await writePage(r.path, renderRoute(ctx, r));

  // Reviews the owner removed: their old address forwards to the reviews page.
  const rp = ctx.config.reviewsPath || '/reviews/';
  for (const s of content.removedReviewSlugs) await writePage(`${rp}${s}/`, redirectPage(ctx.url(rp), 'See all reviews'));
  // Old addresses from the client's previous website (client.config.json → redirects: { "/old/": "/new/" }).
  // An old address ending in .html (/about.html) gets that exact file; others get a folder (/about/ → about/index.html).
  // Never overwrite a real page (e.g. "/index.html" is the home page itself).
  for (const [from, to] of Object.entries(ctx.config.redirects || {})) {
    if (!/^\/[a-z0-9/_.-]*$/i.test(from) || pages.some((p) => p.path === from)) continue;
    const target = /\.html$/i.test(from) ? from : from.endsWith('/') ? from : from + '/';
    const file = /\.html$/i.test(target) ? target : target + 'index.html';
    if (pages.some((p) => (p.path.endsWith('/') ? p.path + 'index.html' : p.path) === file)) continue;
    await writePage(target, redirectPage(ctx.url(to)));
  }
  await writePage('404.html', notFoundHtml(ctx));

  // Used by the owner editor to confirm a change is live.
  await writeFile(join(out, 'version.json'), JSON.stringify({ build: BUILD_ID, builtAt: new Date().toISOString() }));
  await writeFile(join(out, '.nojekyll'), '');
  if (PREVIEW || !SITE_URL) {
    await writeFile(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  } else {
    const base = SITE_URL.replace(/\/$/, '');
    await writeFile(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `<url><loc>${base}${p.path}</loc></url>`).join('\n')}\n</urlset>\n`);
    await writeFile(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
  }
  console.log(`Built ${pages.length} pages (${content.reviews.length} reviews) → ${out} (base "${BASE}", preview ${PREVIEW})`);
}

// Run directly (works on Windows too, where the path is C:\…).
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err) => { console.error(err.message || err); process.exit(1); });
}
