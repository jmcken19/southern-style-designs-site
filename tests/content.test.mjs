// Website build tests: the build works, previews behave like previews, bad content is caught.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSlideshow, validateReviewsPath, escapeHtml, slugify, newestFirst } from '../src/lib/core.mjs';
import { editMark } from '../src/lib/editables.mjs';
import { validatePhotos, validateSpotConfig, sitePhoto } from '../src/lib/photos.mjs';
import { routes, renderPath } from '../src/site/routes.mjs';
import { contactForm, spotImage, spotIsOriginal } from '../src/parts/index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (p) => JSON.parse(await readFile(join(root, p), 'utf8'));
// Tests adapt to THIS client (its pages, features and photo spots).
const CONFIG = await readJson('client.config.json');
const TEXT = await readJson('content/text.json');
const REVIEWS_ON = CONFIG.features?.reviews !== false;
const SPOT = Object.keys(CONFIG.photoSpots || {})[0];
// Fixtures that don't depend on the client's own content.
const SPOTS_FIXTURE = { headshot: { label: 'Your photo', where: 'About page', page: '/about/', defaults: { small: '/assets/img/a-800.jpg', large: '/assets/img/a-1400.jpg', alt: 'Owner' } } };
const SLIDES_FIXTURE = { heroSlides: [{ id: 's-abc123', src: '/assets/img/hero-1', alt: 'A photo', focus: '50% 50%' }], heroSlideSeconds: 7, heroFade: false, heroAutoplay: true };

async function build(env) {
  const out = await mkdtemp(join(tmpdir(), 'site-'));
  execFileSync(process.execPath, [join(root, 'scripts/build.mjs')], { env: { ...process.env, OUT_DIR: out, BUILD_ID: 'abc123', ...env } });
  return { out, read: (p) => readFile(join(out, p), 'utf8'), done: () => rm(out, { recursive: true, force: true }) };
}

test('live build: every page, sitemap, robots, version.json, no testing banner, form on', async () => {
  const b = await build({ SITE_URL: 'https://www.example.com' });
  const config = await readJson('client.config.json');
  const site = await readJson('content/site.json');
  const reviews = existsSync(join(root, 'content/reviews.json')) ? (await readJson('content/reviews.json')).items : [];
  const pages = routes({ config, site, reviews, url: (p) => p });
  for (const r of pages) assert.ok(existsSync(join(b.out, r.path, 'index.html')), r.path);
  const other = pages.find((r) => r.path !== '/').path; // e.g. /about/
  const home = await b.read('index.html');
  assert.doesNotMatch(home, /preview-bar/);
  assert.doesNotMatch(home, /noindex/);
  assert.doesNotMatch(home, /data-edit=/, 'the real website never carries edit marks');
  if (REVIEWS_ON && reviews.length) assert.match(home, /data-marquee/, 'reviews row on the homepage');
  if (!REVIEWS_ON) assert.doesNotMatch(home, new RegExp(`href="${config.reviewsPath || '/reviews/'}"`), 'no menu link to reviews that are switched off');
  if (CONFIG.features?.contactForm !== false && site.contactFormTo && existsSync(join(b.out, 'contact/index.html'))) {
    assert.match(await b.read('contact/index.html'), /data-cform[\s\S]*?type="submit">/);
    assert.doesNotMatch(await b.read('contact/index.html'), /switched off/);
  }
  assert.match(await b.read('robots.txt'), /Sitemap: https:\/\/www.example.com\/sitemap.xml/);
  assert.match(await b.read('sitemap.xml'), new RegExp(`<loc>https://www.example.com${other}</loc>`));
  assert.equal(JSON.parse(await b.read('version.json')).build, 'abc123');
  assert.match(await b.read(`${other.slice(1)}index.html`), new RegExp(`rel="canonical" href="https://www.example.com${other}"`));
  assert.ok(existsSync(join(b.out, '404.html')));
  await b.done();
});

test('testing build: banner, noindex, contact form switched off, paths under the repo name', async () => {
  const b = await build({ PREVIEW: '1', BASE_PATH: '/acme-site' });
  const home = await b.read('index.html');
  assert.match(home, /preview-bar/);
  assert.match(home, /noindex/);
  assert.match(home, /href="\/acme-site\/[a-z0-9-]+\/"/, 'links are under the repo name');
  if (CONFIG.features?.contactForm !== false && existsSync(join(b.out, 'contact/index.html')) && /data-cform/.test(await b.read('contact/index.html'))) assert.match(await b.read('contact/index.html'), /switched off[\s\S]*disabled>Send message/);
  assert.match(await b.read('robots.txt'), /Disallow: \//);
  await b.done();
});

test('helpers escape HTML and make clean addresses', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(slugify('Café & Bar – Main St!'), 'cafe-and-bar-main-st');
  assert.deepEqual(newestFirst([{ date: '2020-01-01', n: 1 }, { date: '2024-01-01', n: 2 }, { date: '2020-01-01', n: 3 }]).map((x) => x.n), [2, 1, 3]);
});

test('reviews show in the order of the reviews file (the owner arranges it), on every page that lists them', { skip: !REVIEWS_ON && 'reviews are off' }, async () => {
  const site = await readJson('content/site.json');
  // Deliberately not sorted by date: the file order must win.
  const reviews = [['b-old', '2019-05-05'], ['a-new', '2025-01-01'], ['c-mid', '2022-03-03']].map(([slug, date]) => ({ slug, title: `Title ${slug}`, date, text: [`Words of ${slug}.`] }));
  const ctx = { site, config: CONFIG, text: TEXT, reviews, preview: false, siteUrl: '', buildId: 'test', url: (p) => p };
  const cardOrder = (html) => [...html.matchAll(/<article class="tcard"[\s\S]*?href="[^"]*\/([a-z-]+)\/"/g)].map((m) => m[1]);
  const listed = routes(ctx).map((r) => r.path).filter((p) => cardOrder(renderPath(ctx, p)).length >= 2);
  assert.ok(listed.includes(CONFIG.reviewsPath || '/reviews/'), 'the reviews page lists the reviews');
  for (const p of listed) assert.deepEqual(cardOrder(renderPath(ctx, p)), ['b-old', 'a-new', 'c-mid'], `file order on ${p}`);
});

test('slideshow and photo-spot settings are checked', async () => {
  const site = await readJson('content/site.json');
  const config = await readJson('client.config.json');
  assert.deepEqual(validateSlideshow(site), [], "this client's slideshow is valid");
  assert.deepEqual(validateSpotConfig(config.photoSpots), [], "this client's photo spots are valid");
  assert.deepEqual(validateSlideshow(SLIDES_FIXTURE), []);
  assert.ok(validateSlideshow({ ...SLIDES_FIXTURE, heroSlides: [] }).length);
  assert.ok(validateSlideshow({ ...SLIDES_FIXTURE, heroSlideSeconds: 99 }).length);
  assert.deepEqual(validateSlideshow({ name: 'No slideshow' }), [], 'a client without a slideshow is fine');
  assert.deepEqual(validateSpotConfig(SPOTS_FIXTURE), []);
  assert.ok(validatePhotos({ photos: { headshot: { small: 'https://evil.example/x.jpg', large: '/assets/img/a.jpg' } } }, SPOTS_FIXTURE).length);
  assert.ok(validatePhotos({ photos: { banner: {} } }, SPOTS_FIXTURE).length, 'unknown spot');
  assert.ok(validateSpotConfig({ Bad: { label: 'x' } }).length);
});

test('a replaced photo shows on its page; originals keep their captions', { skip: !SPOT && 'this client has no photo spots' }, async () => {
  const config = await readJson('client.config.json');
  const site = { ...(await readJson('content/site.json')) }; delete site.photos;
  const ctx = (s) => ({ site: s, config, text: TEXT, reviews: [], url: (p) => p });
  assert.equal(spotIsOriginal(ctx(site), SPOT), true);
  const changed = { ...site, photos: { [SPOT]: { id: 's-abc123', small: '/assets/img/hero/s-abc123-800.jpg', large: '/assets/img/hero/s-abc123-1400.jpg', alt: 'Owner' } } };
  assert.deepEqual(validatePhotos(changed, config.photoSpots), []);
  assert.match(spotImage(ctx(changed), SPOT), /s-abc123-1400\.jpg/);
  assert.equal(spotIsOriginal(ctx(changed), SPOT), false);
  assert.equal(sitePhoto(site, config.photoSpots, SPOT).small, config.photoSpots[SPOT].defaults.small);
});

test('reviewsPath must have a slash at both ends; edit marks follow the features', () => {
  assert.deepEqual(validateReviewsPath('/testimonials/'), []);
  assert.deepEqual(validateReviewsPath('/our-clients/testimonials/'), []);
  assert.deepEqual(validateReviewsPath(undefined), [], 'not set = /reviews/');
  for (const bad of ['/testimonials', 'testimonials/', '/', '/Reviews/']) assert.ok(validateReviewsPath(bad).length, bad);
  const ctx = (features) => ({ editMode: true, config: { features } });
  assert.match(editMark(ctx({}), 'reviews', 'row'), /data-edit="reviews"/);
  assert.equal(editMark(ctx({ reviews: false }), 'reviews', 'row'), '');
  assert.equal(editMark(ctx({ reviews: false }), 'review', 'x'), '');
  assert.equal(editMark(ctx({ slideshow: false }), 'slideshow', 'hero'), '');
  assert.match(editMark(ctx({ slideshow: false }), 'photo', 'headshot'), /data-edit="photo"/);
  assert.equal(editMark({ editMode: false, config: {} }, 'photo', 'headshot'), '', 'never on the real website');
});

test('contact form: off without an address, off on previews, honeypot present', () => {
  const config = { domain: { main: 'www.example.com' } };
  assert.equal(contactForm({ site: {}, config, text: TEXT, url: (p) => p }), '');
  const live = contactForm({ site: { contactFormTo: 'a@b.com' }, config, text: TEXT, url: (p) => p, siteUrl: 'https://www.example.com' });
  assert.match(live, /formsubmit\.co\/ajax\/a%40b\.com/);
  assert.match(live, /name="_honey"/);
  assert.match(contactForm({ site: { contactFormTo: 'a@b.com' }, config, text: TEXT, preview: true, url: (p) => p }), /disabled>Send message/);
  // In the editor the button stays clickable (so its words can be changed); the editor switches forms off itself.
  assert.doesNotMatch(contactForm({ site: { contactFormTo: 'a@b.com' }, config, text: TEXT, preview: true, editMode: true, url: (p) => p }), / disabled>/);
});

test('old addresses and removed reviews forward instead of breaking', async () => {
  const cfgPath = join(root, 'client.config.json');
  const revPath = join(root, 'content/reviews.json');
  const cfg0 = await readFile(cfgPath, 'utf8'); const rev0 = await readFile(revPath, 'utf8');
  try {
    const cfg = JSON.parse(cfg0); cfg.redirects = { '/old-about-page/': '/about/', '/old-page.html': '/about/', '/index.html': '/about/' };
    const { writeFile } = await import('node:fs/promises');
    await writeFile(cfgPath, JSON.stringify(cfg));
    const rev = JSON.parse(rev0); rev.removedSlugs = ['gone-review']; await writeFile(revPath, JSON.stringify(rev));
    const b = await build({});
    assert.match(await b.read('old-about-page/index.html'), /http-equiv="refresh" content="0; url=\/about\/"/);
    assert.match(await b.read('old-page.html'), /http-equiv="refresh" content="0; url=\/about\/"/, 'an old .html address gets that exact file (old sites often used /page.html)');
    assert.ok(!existsSync(join(b.out, 'old-page.html/index.html')));
    assert.doesNotMatch(await b.read('index.html'), /http-equiv="refresh"/, 'a redirect never overwrites a real page');
    const rp = cfg.reviewsPath || '/reviews/';
    assert.match(await b.read(`${rp.slice(1)}gone-review/index.html`), new RegExp(`url=${rp}`));
    await b.done();
  } finally {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(cfgPath, cfg0); await writeFile(revPath, rev0);
  }
});

test('browser scripts have no syntax errors (site + editor)', () => {
  for (const f of ['public/assets/js/site.js', 'owner/ui/app.js']) execFileSync(process.execPath, ['--check', join(root, f)]);
});

test('DNS snapshot finds hidden SPF helper records (the GoDaddy "_spfm" trap)', async () => {
  const { snapshot } = await import('../scripts/dns-snapshot.mjs');
  const zone = {
    'example.com|MX': [{ name: 'example.com.', type: 15, data: '1 aspmx.l.google.com.' }],
    'example.com|TXT': [{ name: 'example.com.', type: 16, data: 'v=spf1 include:dc-abc._spfm.example.com ~all' }],
    'example.com|NS': [{ name: 'example.com.', type: 2, data: 'ns23.domaincontrol.com.' }],
    'dc-abc._spfm.example.com|TXT': [{ name: 'dc-abc._spfm.example.com.', type: 16, data: 'v=spf1 include:_spf.google.com ~all' }],
  };
  const fake = async (url) => { const u = new URL(url); const k = `${u.searchParams.get('name')}|${u.searchParams.get('type')}`; return { json: async () => ({ Answer: zone[k] || [] }) }; };
  const { rows, hiddenSpf } = await snapshot('example.com', fake);
  assert.deepEqual(hiddenSpf, ['dc-abc._spfm.example.com']);
  assert.ok(rows.some((r) => r.name === 'dc-abc._spfm.example.com' && /_spf.google.com/.test(r.data)));
  assert.ok(rows.some((r) => r.type === 'MX'));
});
