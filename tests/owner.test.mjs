// API-level tests of the owner editor, running the real Worker code in Miniflare.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { startEditor, accessToken, otherKey, testJpeg, clientSetup, OWNER, MAINT } from './harness.mjs';
import { hasMetadata, cleanJpeg } from '../owner/src/images.mjs';
import { readFileSync } from 'node:fs';

// The phone in the repo before the test (each client has their own).
const ORIGINAL_PHONE = JSON.parse(readFileSync(new URL('../content/site.json', import.meta.url), 'utf8')).phone;

// Tests adapt to THIS client: features switched off are skipped, photo spots come from client.config.json.
const C = await clientSetup();
const SPOT = C.spots[0]; // the first photo spot (if the client has any)
const noSpot = !SPOT && 'this client has no photo spots';
const noSlides = !C.slideshow && 'this client has no slideshow';
const noReviews = !C.reviewsOn && 'reviews are switched off for this client';

let E;
before(async () => { E = await startEditor(); });
after(async () => { await E.close(); });

async function waitLive(sha) {
  for (let i = 0; i < 10; i++) { const s = await E.call('GET', `/api/publish-status/${sha}`); if (s.data.state !== 'publishing') return s.data.state; }
  return 'publishing';
}
async function heroForm(rev, { color = '#468', label = 'HERO' } = {}) {
  const base = await testJpeg({ width: 2400, height: 1600, color, label, gps: true });
  const fd = new FormData();
  for (const w of [2000, 1400, 800]) fd.append(`w${w}`, new Blob([await sharp(base).resize(w).withExifMerge({ IFD0: { Make: 'X' } }).jpeg().toBuffer()]), `w${w}.jpg`);
  fd.append('original', new Blob([base]), 'o.jpg');
  fd.append('baseRevision', String(rev));
  return fd;
}
const H0 = async () => (await E.call('GET', '/api/homepage')).data;

test('signed-out, forged, expired and wrong-audience requests are rejected', async () => {
  for (const opts of [{ as: null }, { token: accessToken(OWNER, { key: otherKey }) }, { token: accessToken(OWNER, { exp: 1000 }) }, { token: accessToken(OWNER, { aud: 'other' }) }, { as: 'stranger@example.com' }]) {
    assert.equal((await E.call('GET', '/api/me', opts)).status, 401);
  }
  const me = await E.call('GET', '/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.role, 'owner');
  assert.deepEqual(Object.keys(me.data.spots), C.spots, 'photo spots come from client.config.json');
  assert.deepEqual(me.data.features, { slideshow: C.slideshow, reviews: C.reviewsOn });
  assert.equal((await E.call('GET', '/api/me', { as: MAINT })).data.role, 'maintainer');
});

test('CSRF: writes without the editor header or from another origin are blocked', async () => {
  const H = await H0();
  assert.equal((await E.call('POST', '/api/homepage/discard', { body: { baseRevision: H.revision }, headers: { 'X-Site-Editor': '' } })).status, 403);
  assert.equal((await E.call('POST', '/api/homepage/discard', { body: { baseRevision: H.revision }, headers: { Origin: 'https://evil.example' } })).status, 403);
});

test('bad uploads: non-image, fake JPEG and oversized images are refused with a clear message', async () => {
  const H = await H0();
  const fd = new FormData();
  for (const w of [2000, 1400, 800]) fd.append(`w${w}`, new Blob(['<script>alert(1)</script>'], { type: 'image/jpeg' }), 'x.jpg');
  fd.append('baseRevision', String(H.revision));
  const r = await E.call('POST', '/api/homepage/photos', { form: fd });
  assert.equal(r.status, 422);
  assert.match(r.data.error, /photo/i);
  const huge = await sharp({ create: { width: 5000, height: 3000, channels: 3, background: '#888' } }).jpeg().toBuffer();
  const fd2 = new FormData();
  for (const w of [2000, 1400, 800]) fd2.append(`w${w}`, new Blob([huge]), 'l.jpg');
  fd2.append('baseRevision', String(H.revision));
  assert.equal((await E.call('POST', '/api/homepage/photos', { form: fd2 })).status, 422);
});

/** Make one unpublished photo change this client supports (a photo spot, or else a slideshow photo). */
async function photoChange(H, color) {
  const r = SPOT ? await E.call('POST', `/api/homepage/spot/${SPOT}`, { form: await heroForm(H.revision, { color }) }) : await E.call('POST', '/api/homepage/photos', { form: await heroForm(H.revision, { color }) });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}
const noPhotos = !SPOT && !C.slideshow && 'this client has no photos to change';

test('failed website build reports failure, keeps the change, and retry recovers', { skip: noPhotos }, async () => {
  let H = await H0();
  H = await photoChange(H, '#933');
  E.gh.failNextRun = true;
  const p = await E.call('POST', '/api/homepage/publish', { body: { baseRevision: H.revision } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  assert.equal((await E.call('GET', `/api/publish-status/${p.data.commit}`)).data.state, 'failed');
  assert.equal((await E.call('POST', `/api/publish-retry/${p.data.commit}`, { body: {} })).status, 200);
  assert.equal(await waitLive(p.data.commit), 'live');
});

test('concurrent push to the repo is not overwritten (commit retried on top)', { skip: noPhotos }, async () => {
  let H = await H0();
  H = await photoChange(H, '#393');
  E.gh.raceOnce = true;
  const p = await E.call('POST', '/api/homepage/publish', { body: { baseRevision: H.revision } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  assert.ok(E.gh.read('README-race.md'), 'the other change survived');
  const live = JSON.parse(E.gh.read('content/site.json'));
  if (SPOT) assert.equal(live.photos[SPOT].id, H.draft.photos[SPOT].id, 'our change landed');
  else assert.equal(live.heroSlides.length, H.draft.slides.length, 'our change landed');
});

test('cleanJpeg strips EXIF/GPS but keeps the picture', async () => {
  const j = await testJpeg({ width: 640, height: 480 });
  assert.equal(hasMetadata(j), true);
  const c = cleanJpeg(new Uint8Array(j));
  assert.equal(hasMetadata(c.bytes), false);
  assert.equal(c.width, 640); assert.equal(c.height, 480);
  const meta = await sharp(Buffer.from(c.bytes)).metadata();
  assert.equal(meta.width, 640);
});

test('security headers are present on editor pages and API', async () => {
  const r = await E.call('GET', '/api/me');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const page = await E.mf.dispatchFetch(E.url + '/', { headers: { 'Cf-Access-Jwt-Assertion': accessToken(OWNER) } });
  assert.match(page.headers.get('content-security-policy') || '', /default-src 'self'/);
  await page.text();
});

test('homepage slideshow: starts from the website, add/reorder/focus/speed/fade, preview, publish, remove old', { skip: noSlides }, async () => {
  assert.equal((await E.call('GET', '/api/homepage', { as: null })).status, 401);
  let H = (await E.call('GET', '/api/homepage')).data;
  const repoSite = JSON.parse(E.gh.read('content/site.json'));
  const start = H.draft.slides.map((s) => s.id);
  assert.ok(start.length >= 1, 'starts from the website slideshow');
  assert.deepEqual(start, repoSite.heroSlides.map((s) => s.id));
  assert.equal(H.draft.seconds, repoSite.heroSlideSeconds ?? 7, 'speed from the website');
  assert.equal(H.draft.fade, repoSite.heroFade === true, 'slide/fade from the website');
  assert.equal(H.hasUnpublishedChanges, false);
  // Existing photo thumbnail comes from the repo.
  const th = await E.mf.dispatchFetch(E.url + `/api/homepage/photo/${start[0]}?w=800`, { headers: { 'Cf-Access-Jwt-Assertion': accessToken(OWNER) } });
  assert.equal(th.status, 200); await th.arrayBuffer();

  for (const c of ['#843', '#384']) { const r = await E.call('POST', '/api/homepage/photos', { form: await heroForm(H.revision, { color: c }) }); assert.equal(r.status, 200, JSON.stringify(r.data)); H = r.data; }
  assert.equal(H.draft.slides.length, start.length + 2);
  const [b, c] = H.draft.slides.slice(-2).map((s) => s.id);
  const a = start[0];
  const order = [c, ...start, b];
  H = (await E.call('PUT', '/api/homepage/photos', { body: { order, focus: { [c]: '50% 15%' }, baseRevision: H.revision } })).data;
  assert.deepEqual(H.draft.slides.map((s) => s.id), order);
  assert.equal(H.draft.slides[0].focus, '50% 15%');
  const bad = await E.call('PUT', '/api/homepage/settings', { body: { seconds: 999, fade: true, baseRevision: H.revision } });
  assert.equal(bad.status, 400);
  H = (await E.call('PUT', '/api/homepage/settings', { body: { seconds: 4, fade: true, autoplay: false, baseRevision: H.revision } })).data;
  assert.equal(H.draft.autoplay, false);
  const still = await E.call('GET', '/api/homepage/preview');
  assert.doesNotMatch(still.data, /data-interval/, 'still = no rotation');
  H = (await E.call('PUT', '/api/homepage/settings', { body: { seconds: 4, fade: true, autoplay: true, baseRevision: H.revision } })).data;
  assert.equal(H.hasUnpublishedChanges, true);
  // Stale revision is refused.
  assert.equal((await E.call('PUT', '/api/homepage/settings', { as: MAINT, body: { seconds: 10, fade: false, baseRevision: H.revision - 1 } })).status, 409);

  // Website not changed yet.
  assert.equal(JSON.parse(E.gh.read('content/site.json')).heroSlides.length, start.length);
  const pv = await E.call('GET', '/api/homepage/preview');
  assert.equal(pv.status, 200);
  const heroImgs = [...pv.data.matchAll(/hero__slide[^>]*>\s*<img src="([^"]+)"/g)];
  assert.equal(heroImgs.length, order.length, 'every slide found in the preview');
  for (const m of heroImgs) {
    assert.match(m[1], /^\/api\/homepage\/photo\/s-[a-z0-9]+\/w-1400\.jpg$/, 'preview photos come from the editor (draft photos are not public yet)');
    const img = await E.mf.dispatchFetch(E.url + m[1], { headers: { 'Cf-Access-Jwt-Assertion': accessToken(OWNER) } });
    assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/jpeg'); await img.arrayBuffer();
  }
  assert.match(pv.data, /hero--fade/); assert.match(pv.data, /data-interval="4"/); assert.doesNotMatch(pv.data, /Preview only/); assert.match(pv.data, /preview-bar/);
  assert.equal((await E.call('GET', '/api/homepage/preview', { as: null })).status, 401);

  const p = await E.call('POST', '/api/homepage/publish', { body: { baseRevision: H.revision } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  const site = JSON.parse(E.gh.read('content/site.json'));
  assert.deepEqual(site.heroSlides.map((s) => s.id), order);
  assert.equal(site.heroSlideSeconds, 4); assert.equal(site.heroFade, true); assert.equal(site.heroAutoplay, true);
  assert.doesNotMatch(pv.data, /hero__pause-icon/, 'no visible pause icon');
  assert.equal(site.phone, ORIGINAL_PHONE, 'other site settings untouched');
  for (const w of [800, 1400, 2000]) {
    const bytes = E.gh.read(`public/assets/img/hero/${c}-${w}.jpg`);
    assert.ok(bytes); assert.equal(hasMetadata(bytes), false, 'no GPS/EXIF on public slideshow photo');
  }
  assert.equal(await waitLive(p.data.commit), 'live');
  H = p.data.homepage;
  assert.equal(H.hasUnpublishedChanges, false);

  // Remove down to one (c), then the last one is refused.
  for (const id of [b, ...start]) H = (await E.call('DELETE', `/api/homepage/photos/${id}?baseRevision=${H.revision}`)).data;
  assert.deepEqual(H.draft.slides.map((s) => s.id), [c]);
  const last = await E.call('DELETE', `/api/homepage/photos/${c}?baseRevision=${H.revision}`);
  assert.equal(last.status, 422, 'cannot remove the last photo');
  H = (await E.call('POST', '/api/homepage/discard', { body: { baseRevision: H.revision } })).data;
  assert.equal(H.draft.slides.length, order.length, 'undo goes back to what is live');
  H = (await E.call('DELETE', `/api/homepage/photos/${b}?baseRevision=${H.revision}`)).data;
  const p2 = await E.call('POST', '/api/homepage/publish', { body: { baseRevision: H.revision } });
  assert.equal(p2.status, 200);
  assert.equal(E.gh.read(`public/assets/img/hero/${b}-800.jpg`), null, 'removed photo deleted from site');
  const orig = repoSite.heroSlides.find((s) => s.id === a);
  if (!orig.src.startsWith('/assets/img/hero/')) assert.ok(E.gh.read(`public${orig.src}-800.jpg`), 'original site photo files are left alone');
});

test('photo spots: replace, undo, preview the right page, publish only what changed', { skip: noSpot }, async () => {
  let H = await H0();
  const th = await E.mf.dispatchFetch(E.url + `/api/homepage/spot/${SPOT}/img`, { headers: { 'Cf-Access-Jwt-Assertion': accessToken(OWNER) } });
  assert.equal(th.status, 200, 'current photo served through the editor'); await th.arrayBuffer();
  assert.equal((await E.call('POST', '/api/homepage/spot/nope', { form: await heroForm(H.revision) })).status, 404);
  let r = await E.call('POST', `/api/homepage/spot/${SPOT}`, { form: await heroForm(H.revision, { color: '#622' }) });
  assert.equal(r.status, 200, JSON.stringify(r.data)); H = r.data;
  const id = H.draft.photos[SPOT].id;
  const pv = await E.call('GET', `/api/homepage/preview?page=${SPOT}`);
  assert.equal(pv.status, 200);
  assert.match(pv.data, new RegExp(`/api/homepage/photo/${id}/w-1400\\.jpg`), 'the spot\'s page preview shows the new private photo');
  H = (await E.call('POST', `/api/homepage/spot/${SPOT}/undo`, { body: { baseRevision: H.revision } })).data;
  assert.equal(H.draft.photos[SPOT].id, JSON.parse(E.gh.read('content/site.json')).photos?.[SPOT]?.id, 'undo = what is live');
  r = await E.call('POST', `/api/homepage/spot/${SPOT}`, { form: await heroForm(H.revision, { color: '#226' }) }); H = r.data;
  const p = await E.call('POST', '/api/homepage/publish', { body: { baseRevision: H.revision } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  const site = JSON.parse(E.gh.read('content/site.json'));
  assert.ok(Object.keys(site.photos).includes(SPOT));
  for (const w of [800, 1400, 2000]) { const b = E.gh.read(`public/assets/img/hero/${site.photos[SPOT].id}-${w}.jpg`); assert.ok(b); assert.equal(hasMetadata(b), false); }
  assert.equal(await waitLive(p.data.commit), 'live');
});

test('client reviews: add, edit, remove, preview, publish; old address of a removed review forwards', { skip: noReviews }, async () => {
  assert.equal((await E.call('GET', '/api/reviews', { as: null })).status, 401);
  let R = (await E.call('GET', '/api/reviews')).data;
  const start = R.draft.items.length;
  assert.ok(start >= 1, 'starts from the website reviews');
  const bad = await E.call('POST', '/api/reviews', { body: { fields: { title: '', text: '', date: '2099-01-01' }, baseRevision: R.revision } });
  assert.equal(bad.status, 422); assert.match(bad.data.error, /title/i);
  let r = await E.call('POST', '/api/reviews', { body: { fields: { title: 'Made selling easy', client: 'Pat Q.', role: 'Seller', date: '2026-10-01', text: 'They were great.\n\nWould hire again.' }, baseRevision: R.revision } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); R = r.data;
  const added = R.draft.items[0];
  assert.equal(added.slug, 'made-selling-easy'); assert.deepEqual(added.text, ['They were great.', 'Would hire again.']);
  // Edit an existing (excerpt) review: wording changes, address stays, excerpt flag goes.
  const ex = R.draft.items.find((x) => x.excerptOnly) || R.draft.items[1];
  r = await E.call('PUT', `/api/reviews/item/${ex.slug}`, { body: { fields: { title: ex.title, client: 'J. D.', role: '', date: ex.date, text: 'The full review text from the owner.' }, baseRevision: R.revision } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); R = r.data;
  const edited = R.draft.items.find((x) => x.slug === ex.slug);
  assert.equal(edited.client, 'J. D.'); assert.equal(edited.excerptOnly, undefined); assert.equal(edited.role, undefined);
  // Remove one.
  const gone = R.draft.items.find((x) => x.slug !== ex.slug && x.slug !== 'made-selling-easy').slug;
  R = (await E.call('DELETE', `/api/reviews/item/${gone}?baseRevision=${R.revision}`)).data;
  assert.equal(R.draft.items.length, start);
  assert.equal((await E.call('DELETE', `/api/reviews/item/${gone}?baseRevision=${R.revision}`)).status, 404);
  assert.equal((await E.call('POST', '/api/reviews', { as: MAINT, body: { fields: { title: 'x', text: 'y', date: '2026-01-01' }, baseRevision: R.revision - 1 } })).status, 409, 'stale save refused');
  // Website unchanged until publish; preview shows the draft.
  assert.equal(JSON.parse(E.gh.read('content/reviews.json')).items.length, start);
  const pv = await E.call('GET', '/api/reviews/preview');
  assert.equal(pv.status, 200); assert.match(pv.data, /Made selling easy/); assert.match(pv.data, /The full review text from the owner/);
  const p = await E.call('POST', '/api/reviews/publish', { body: { baseRevision: R.revision } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  const file = JSON.parse(E.gh.read('content/reviews.json'));
  assert.equal(file.items.length, start); assert.ok(file._comment, 'file comment kept');
  assert.ok(file.items.some((x) => x.slug === 'made-selling-easy'));
  assert.deepEqual(file.removedSlugs, [gone]);
  assert.equal(await waitLive(p.data.commit), 'live');
  R = p.data.reviews; assert.equal(R.hasUnpublishedChanges, false);
  // Undo works; can't remove the last review.
  R = (await E.call('DELETE', `/api/reviews/item/made-selling-easy?baseRevision=${R.revision}`)).data;
  R = (await E.call('POST', '/api/reviews/discard', { body: { baseRevision: R.revision } })).data;
  assert.ok(R.draft.items.some((x) => x.slug === 'made-selling-easy'));
});

test('client reviews: arrange the order (file order = shown order); new go to the top, edit/remove keep the order', { skip: (noReviews || C.reviews.length < 2) && 'needs reviews on and at least 2 reviews' }, async () => {
  const FILE = C.reviewsFile;
  const fileSlugs = () => JSON.parse(E.gh.read(FILE)).items.map((x) => x.slug);
  // The order the page shows, read from the editor's page preview (each review card carries its slug in edit mode).
  const pageOrder = async () => {
    const pv = await E.call('GET', `/api/homepage/preview?edit=1&path=${encodeURIComponent(C.reviewsPath)}`);
    assert.equal(pv.status, 200);
    return [...pv.data.matchAll(/data-edit="review" data-edit-key="([^"]+)"/g)].map((m) => m[1]);
  };
  let R = (await E.call('GET', '/api/reviews')).data;
  const start = R.draft.items.map((x) => x.slug);
  assert.deepEqual(start, fileSlugs(), 'the editor starts in the file order');
  assert.deepEqual(await pageOrder(), start, 'the page shows the reviews in the file order');
  const order = (slugs, rev = R.revision, as) => E.call('POST', '/api/reviews/order', { as, body: { slugs, baseRevision: rev } });
  assert.equal((await E.call('POST', '/api/reviews/order', { as: null, body: { slugs: start, baseRevision: R.revision } })).status, 401, 'signed out');
  // Only a full permutation of the current reviews is accepted.
  for (const bad of [start.slice(1), [...start, start[0]], [start[0], ...start.slice(1, -1), start[0]], [...start.slice(0, -1), 'not-a-review'], 'abc', null, [...start.slice(0, -1), 7]]) {
    const r = await order(bad);
    assert.equal(r.status, 400, `refused: ${JSON.stringify(bad)}`); assert.match(r.data.error, /reload/i);
  }
  assert.equal((await order([...start].reverse(), R.revision - 1)).status, 409, 'stale order refused');
  assert.equal((await E.call('GET', '/api/reviews')).data.revision, R.revision, 'refused orders saved nothing');
  // Same order: nothing to save.
  assert.equal((await order(start)).data.revision, R.revision);
  // Reverse: saved as a draft, shown in the preview, the website file untouched; order-only change counts as unpublished.
  const rev = [...start].reverse();
  let r = await order(rev); assert.equal(r.status, 200, JSON.stringify(r.data)); R = r.data;
  assert.deepEqual(R.draft.items.map((x) => x.slug), rev);
  assert.deepEqual(R.live.items.map((x) => x.slug), start);
  assert.equal(R.hasUnpublishedChanges, true, 'an order-only change is an unpublished change');
  assert.deepEqual(await pageOrder(), rev, 'the preview shows the draft order');
  const rpv = await E.call('GET', '/api/reviews/preview');
  const hrefOrder = [...new Set([...rpv.data.matchAll(/href="[^"]*\/([a-z0-9-]+)\/"/g)].map((m) => m[1]).filter((x) => start.includes(x)))];
  assert.deepEqual(hrefOrder, rev, 'the reviews preview shows the draft order too');
  assert.deepEqual(fileSlugs(), start, 'website unchanged until Publish');
  // Undo (discard) puts the published order back.
  R = (await E.call('POST', '/api/reviews/discard', { body: { baseRevision: R.revision } })).data;
  assert.deepEqual(R.draft.items.map((x) => x.slug), start); assert.equal(R.hasUnpublishedChanges, false);
  assert.deepEqual(await pageOrder(), start);
  // Publish writes the new order to the file (and nothing else about the reviews changes).
  const before = JSON.parse(E.gh.read(FILE));
  R = (await order(rev)).data;
  const p = await E.call('POST', '/api/reviews/publish', { body: { baseRevision: R.revision } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  const after = JSON.parse(E.gh.read(FILE));
  assert.deepEqual(after.items.map((x) => x.slug), rev, 'published order is in the file');
  assert.deepEqual(after.items, rev.map((s) => before.items.find((x) => x.slug === s)), 'every review is word for word the same');
  assert.deepEqual(after.removedSlugs, before.removedSlugs, 'no review counted as removed');
  R = p.data.reviews; assert.equal(R.hasUnpublishedChanges, false);
  // A new review goes to the top; editing keeps its place; removing keeps the others' order.
  r = await E.call('POST', '/api/reviews', { body: { fields: { title: 'Order test review', text: 'Great.', date: '2020-01-01' }, baseRevision: R.revision } });
  R = r.data; const added = R.draft.items[0].slug;
  assert.deepEqual(R.draft.items.map((x) => x.slug), [added, ...rev], 'new review shows first (even with an old date)');
  const mid = R.draft.items[1];
  R = (await E.call('PUT', `/api/reviews/item/${mid.slug}`, { body: { fields: { title: mid.title, client: mid.client || '', role: mid.role || '', date: mid.date, text: mid.text.join('\n\n') }, baseRevision: R.revision } })).data;
  assert.deepEqual(R.draft.items.map((x) => x.slug), [added, ...rev], 'editing keeps the place');
  R = (await E.call('DELETE', `/api/reviews/item/${rev[0]}?baseRevision=${R.revision}`)).data;
  assert.deepEqual(R.draft.items.map((x) => x.slug), [added, ...rev.slice(1)], 'removing keeps the others in order');
  // An order sent before the removal no longer matches the reviews: refused, nothing changes.
  assert.equal((await order([added, ...rev], R.revision)).status, 400);
  // Clean up: undo, then publish the original order again.
  R = (await E.call('POST', '/api/reviews/discard', { body: { baseRevision: R.revision } })).data;
  R = (await order(start)).data;
  assert.equal((await E.call('POST', '/api/reviews/publish', { body: { baseRevision: R.revision } })).status, 200);
  assert.deepEqual(fileSlugs(), start);
});

test('laptop only: phone browsers are refused, laptops are allowed', async () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
  const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
  const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
  for (const ua of [iphone, android]) {
    const r = await E.call('GET', '/api/me', { headers: { 'User-Agent': ua } });
    assert.equal(r.status, 403); assert.equal(r.data.laptopOnly, true); assert.match(r.data.error, /laptop/);
  }
  for (const ua of [windows, mac]) assert.equal((await E.call('GET', '/api/me', { headers: { 'User-Agent': ua } })).status, 200);
  // signed-out phone still gets "sign in", not a hint that the editor exists
  assert.equal((await E.call('GET', '/api/me', { as: null, headers: { 'User-Agent': iphone } })).status, 401);
});

test('edit-on-the-page: edit marks only in edit mode, page picker, preview may be framed by the editor only', async () => {
  const me = await E.call('GET', '/api/me');
  assert.ok(Array.isArray(me.data.pages) && me.data.pages.some((p) => p.path === '/'), 'page list for the page picker');
  const reviewPages = me.data.pages.filter((p) => p.path.startsWith(C.reviewsPath) && p.path !== C.reviewsPath);
  assert.ok(reviewPages.length <= 1 && reviewPages.every((p) => p.more), 'one page per review is left out of the picker (only one example, under "More pages")');
  assert.ok(me.data.pages.some((p) => p.path === '/404' && p.more), 'the "page not found" page is under "More pages" (its words can be changed)');
  const nf = await E.call('GET', '/api/homepage/preview?edit=1&path=%2F404');
  assert.match(nf.data, /data-edit="text"/, 'the editor can show the "page not found" page (with its words editable)');

  const edit = await E.call('GET', '/api/homepage/preview?edit=1');
  if (C.slideshow && C.site.heroSlides?.length) assert.match(edit.data, /data-edit="slideshow"/, 'slideshow is marked editable');
  assert.match(edit.data, /<meta name="editor-preview"/, 'edit-mode pages carry the editor marker');
  assert.equal(edit.headers.get('X-Frame-Options'), 'SAMEORIGIN', 'the editor may show its own preview in a frame');
  assert.match(edit.headers.get('Content-Security-Policy'), /frame-ancestors 'self'/);

  if (SPOT) {
    const page = C.config.photoSpots[SPOT].page;
    const spotPage = await E.call('GET', `/api/homepage/preview?edit=1&path=${encodeURIComponent(page)}`);
    assert.match(spotPage.data, new RegExp(`data-edit="photo" data-edit-key="${SPOT}"`), 'photo spot on its page is marked');
  }
  const home = await E.call('GET', '/api/homepage/preview?edit=1&path=%2F');
  const unknown = await E.call('GET', '/api/homepage/preview?edit=1&path=%2Fnot-a-page%2F');
  const title = (h) => /<title>([^<]*)<\/title>/.exec(h)?.[1];
  assert.equal(title(unknown.data), title(home.data), 'unknown page falls back to the homepage');

  const plain = await E.call('GET', '/api/homepage/preview');
  assert.doesNotMatch(plain.data, /data-edit=/, 'no edit marks outside edit mode');
  assert.match(plain.data, /<meta name="editor-preview"/, 'every preview carries the editor marker (the visitor view uses it)');
  const api = await E.call('GET', '/api/homepage');
  assert.equal(api.headers.get('X-Frame-Options'), 'DENY', 'everything else still refuses to be framed');
});

test('preview: allows Google Fonts, https images and video/map embeds; nothing else', async () => {
  const csp = (await E.call('GET', '/api/homepage/preview?edit=1')).headers.get('Content-Security-Policy');
  assert.match(csp, /style-src [^;]*https:\/\/fonts\.googleapis\.com/);
  assert.match(csp, /font-src [^;]*https:\/\/fonts\.gstatic\.com/);
  assert.match(csp, /img-src [^;]*https:/);
  assert.match(csp, /frame-src [^;]*https:\/\/www\.youtube-nocookie\.com[^;]*https:\/\/www\.google\.com/);
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src https:\/\/site\.example\.test(;|$)/, 'scripts only from the public site');
});

test('preview: an unreadable reviews draft still shows the page (falls back to the published reviews)', { skip: noReviews }, async () => {
  await E.call('GET', '/api/reviews'); // makes sure the reviews row exists
  const db = await E.mf.getD1Database('DB');
  const row = await db.prepare('SELECT draft FROM settings WHERE key = ?').bind('reviews').first();
  await db.prepare('UPDATE settings SET draft = ? WHERE key = ?').bind('{not json', 'reviews').run();
  try {
    const pv = await E.call('GET', `/api/homepage/preview?edit=1&path=${encodeURIComponent(C.reviewsPath)}`);
    assert.equal(pv.status, 200);
    assert.match(pv.data, /<html/);
  } finally {
    await db.prepare('UPDATE settings SET draft = ? WHERE key = ?').bind(row.draft, 'reviews').run();
  }
});

test('reviews: a title with no Latin letters gets a dated address, never "-2"', { skip: noReviews }, async () => {
  let R = (await E.call('GET', '/api/reviews')).data;
  const add = async (title) => { const r = await E.call('POST', '/api/reviews', { body: { fields: { title, text: 'Great.', date: '2026-03-04' }, baseRevision: R.revision } }); assert.equal(r.status, 200, JSON.stringify(r.data)); R = r.data; return R.draft.items[0].slug; };
  assert.equal(await add('🎉🎉🎉'), 'review-2026-03-04');
  assert.equal(await add('★★★★★'), 'review-2026-03-04-2');
  R = (await E.call('POST', '/api/reviews/discard', { body: { baseRevision: R.revision } })).data;
  assert.equal(R.hasUnpublishedChanges, false);
});

test('reviews switched off: no reviews routes, no review edit marks', { skip: C.reviewsOn && 'reviews are on for this client' }, async () => {
  assert.equal((await E.call('GET', '/api/reviews')).status, 404);
  const me = await E.call('GET', '/api/me');
  assert.ok(!me.data.pages.some((p) => p.path === C.reviewsPath));
  for (const p of me.data.pages) assert.doesNotMatch((await E.call('GET', `/api/homepage/preview?edit=1&path=${encodeURIComponent(p.path)}`)).data, /data-edit="reviews?"/);
});
