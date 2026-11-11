// Website photos: the homepage slideshow (photos, order, focus, speed, slide/fade, slideshow vs still)
// and single "photo spots" defined in client.config.json → photoSpots.
// Safety model: private draft in D1/KV, revision check on every save, one non-forced Git commit
// to publish, "live" only after the website reports it.
import { github } from './github.mjs';
import { validateVariant, validateOriginal } from './images.mjs';
import { validateSlideshow as validateHomepage, HERO_SIZES, MAX_HERO_SLIDES, randomId } from '../../src/lib/core.mjs';
import { sitePhoto, validatePhotos } from '../../src/lib/photos.mjs';
import { renderPath, notFoundHtml, routes as siteRoutes } from '../../src/site/routes.mjs';
import { previewHeaders, markPreview, parseReviewsDraft } from './preview.mjs';
import { withDraftWords } from './text.mjs';
import siteContent from '../../content/site.json';
import reviewsContent from '../../content/reviews.json';
import textContent from '../../content/text.json';

const KEY = 'homepage';
const ID_RE = /^s-[a-z0-9]{3,32}$/;
const HERO_DIR = 'public/assets/img/hero';

export function photosRoutes(H) {
  const { HttpError, json, now, readJsonBody, needRevision, rateLimit, logEvent, idempotent, publicBase, config } = H;
  const PHOTO_SPOTS = config.photoSpots || {};

  const fromSite = (site) => ({
    slides: (site.heroSlides || []).map((s, i) => ({ id: s.id || `s-legacy${i + 1}`, src: s.src, alt: s.alt || '', focus: s.focus || '50% 50%' })),
    seconds: typeof site.heroSlideSeconds === 'number' ? site.heroSlideSeconds : 7,
    fade: site.heroFade === true,
    autoplay: site.heroAutoplay !== false,
    photos: spotsFrom(site),
  });
  function spotsFrom(site) {
    const out = {};
    for (const k of Object.keys(PHOTO_SPOTS)) { const p = sitePhoto(site, PHOTO_SPOTS, k); out[k] = { ...(p.id ? { id: p.id } : {}), small: p.small, large: p.large, alt: p.alt }; }
    return out;
  }
  // Rows saved before photo spots existed: fill them in from the website's settings.
  const withSpots = (st) => (st && !st.photos ? { ...st, photos: spotsFrom(siteContent) } : st);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function view(row) {
    return { revision: row.revision, draft: row.draft, live: row.live, hasUnpublishedChanges: !same(row.draft, row.live), lastCommit: row.last_commit, updatedAt: row.updated_at, updatedBy: row.updated_by };
  }

  async function readRow(A) {
    const r = await A.db.prepare('SELECT * FROM settings WHERE key = ?').bind(KEY).first();
    return r ? { ...r, draft: withSpots(JSON.parse(r.draft)), live: r.live ? withSpots(JSON.parse(r.live)) : null } : null;
  }

  /** Load the slideshow, creating it from the website's current settings the first time and
   *  picking up changes made directly in the repo (e.g. by an AI assistant). */
  async function load(A) {
    let row = await readRow(A);
    let file = null;
    try { file = A.env.GITHUB_TOKEN ? await github(A.env).getFile('content/site.json') : null; } catch { /* offline: use what we have */ }
    const repoState = file ? fromSite(JSON.parse(new TextDecoder().decode(file.bytes))) : fromSite(siteContent);
    const t = now();
    if (!row) {
      await A.db.prepare('INSERT OR IGNORE INTO settings (key, revision, draft, live, repo_sha, updated_at, updated_by) VALUES (?, 1, ?, ?, ?, ?, ?)')
        .bind(KEY, JSON.stringify(repoState), JSON.stringify(repoState), file?.sha || null, t, 'website').run();
      return readRow(A);
    }
    if (file && row.repo_sha !== file.sha) {
      const draftUntouched = same(row.draft, row.live);
      if (!same(row.live, repoState)) {
        await A.db.prepare('UPDATE settings SET live = ?, draft = ?, repo_sha = ?, revision = revision + 1, updated_at = ?, updated_by = ? WHERE key = ?')
          .bind(JSON.stringify(repoState), JSON.stringify(draftUntouched ? repoState : row.draft), file.sha, t, 'website', KEY).run();
      } else {
        await A.db.prepare('UPDATE settings SET repo_sha = ? WHERE key = ?').bind(file.sha, KEY).run();
      }
      row = await readRow(A);
    }
    return row;
  }

  async function write(A, row, changes, expectedRevision) {
    const fields = { ...changes, updated_at: now(), updated_by: A.user.email };
    const cols = Object.keys(fields);
    const vals = cols.map((c) => ((c === 'draft' || c === 'live') && fields[c] && typeof fields[c] === 'object' ? JSON.stringify(fields[c]) : fields[c]));
    const res = await A.db.prepare(`UPDATE settings SET ${cols.map((c) => `${c} = ?`).join(', ')}, revision = revision + 1 WHERE key = ? AND revision = ?`).bind(...vals, KEY, expectedRevision).run();
    if (!res.meta.changes) throw new HttpError(409, 'The homepage photos were changed on another computer since you opened this page. Click "Reload latest" to see the newest version.', { conflict: true });
    return readRow(A);
  }

  async function readForm(A) {
    const len = Number(A.request.headers.get('content-length') || 0);
    if (len > 40 * 1024 * 1024) throw new HttpError(413, 'That photo is too large to upload. Please try a different photo.');
    let form;
    try { form = await A.request.formData(); } catch { throw new HttpError(400, 'The photo did not arrive completely. Please check your signal and try again.'); }
    const get = async (n) => { const f = form.get(n); return f && typeof f !== 'string' ? new Uint8Array(await f.arrayBuffer()) : null; };
    const variants = {};
    for (const w of HERO_SIZES) {
      const v = validateVariant(w === 800 ? 'small' : 'large', await get(`w${w}`));
      if (v.error) throw new HttpError(422, v.error);
      variants[w] = v;
    }
    const original = await get('original');
    const orig = original && !validateOriginal(original).error ? original : null;
    return { variants, original: orig, baseRevision: Number(form.get('baseRevision')), alt: String(form.get('alt') || '').slice(0, 200) };
  }

  async function store(A, id, p) {
    for (const w of HERO_SIZES) await A.env.PHOTOS.put(`hero:${id}:${w}`, p.variants[w].bytes);
    if (p.original) await A.env.PHOTOS.put(`heroorig:${id}`, p.original, { metadata: { by: A.user.email, at: now() } });
  }

  const routes = {
    async get(A) { return json(view(await load(A))); },

    async settings(A) {
      const body = await readJsonBody(A.request);
      const rev = needRevision(body);
      const row = await load(A);
      const seconds = Number(body.seconds);
      if (!(seconds >= 2 && seconds <= 30)) throw new HttpError(400, 'Choose Slow, Normal, or Fast.');
      if (typeof body.fade !== 'boolean') throw new HttpError(400, 'Choose fade on or off.');
      const autoplay = typeof body.autoplay === 'boolean' ? body.autoplay : row.draft.autoplay !== false;
      const updated = await write(A, row, { draft: { ...row.draft, seconds, fade: body.fade, autoplay } }, rev);
      await logEvent(A, 'save-homepage-settings');
      return json(view(updated));
    },

    async add(A) {
      await rateLimit(A, 'upload');
      const p = await readForm(A);
      let row = await load(A);
      if (row.draft.slides.length >= MAX_HERO_SLIDES) throw new HttpError(422, `The slideshow can have up to ${MAX_HERO_SLIDES} photos. Remove one first.`);
      const id = randomId('s-', 10);
      await store(A, id, p);
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          row = await readRow(A);
          const slide = { id, src: `/assets/img/hero/${id}`, alt: p.alt || 'Homepage photo', focus: '50% 50%' };
          const updated = await write(A, row, { draft: { ...row.draft, slides: [...row.draft.slides, slide] } }, row.revision);
          await logEvent(A, 'upload-homepage', null, { id });
          return view(updated);
        } catch (e) { if (!(e instanceof HttpError && e.status === 409)) throw e; }
      }
      throw new HttpError(409, 'Too many changes at once. Please try again.');
    },

    async replace(A, id) {
      await rateLimit(A, 'upload');
      const p = await readForm(A);
      const row = await load(A);
      const i = row.draft.slides.findIndex((s) => s.id === id);
      if (i < 0) throw new HttpError(404, 'That photo is no longer in the slideshow. Please refresh.');
      const newId = randomId('s-', 10);
      await store(A, newId, p);
      const slides = row.draft.slides.slice();
      slides[i] = { id: newId, src: `/assets/img/hero/${newId}`, alt: p.alt || slides[i].alt, focus: slides[i].focus };
      const updated = await write(A, row, { draft: { ...row.draft, slides } }, p.baseRevision);
      await logEvent(A, 'upload-homepage-replace', null, { from: id, to: newId });
      return view(updated);
    },

    async spot(A, key) {
      if (!PHOTO_SPOTS[key]) throw new HttpError(404, 'Not found.');
      await rateLimit(A, 'upload');
      const p = await readForm(A);
      const row = await load(A);
      const id = randomId('s-', 10);
      await store(A, id, p);
      const prev = row.draft.photos[key];
      const photos = { ...row.draft.photos, [key]: { id, small: `/assets/img/hero/${id}-800.jpg`, large: `/assets/img/hero/${id}-1400.jpg`, alt: p.alt || PHOTO_SPOTS[key].newAlt || prev.alt } };
      const updated = await write(A, row, { draft: { ...row.draft, photos } }, p.baseRevision);
      await logEvent(A, 'upload-site-photo', null, { spot: key, id });
      return view(updated);
    },

    async spotUndo(A, key) {
      if (!PHOTO_SPOTS[key]) throw new HttpError(404, 'Not found.');
      const body = await readJsonBody(A.request);
      const rev = needRevision(body);
      const row = await load(A);
      const photos = { ...row.draft.photos, [key]: row.live.photos[key] };
      const updated = await write(A, row, { draft: { ...row.draft, photos } }, rev);
      await logEvent(A, 'save-site-photo-undo', null, { spot: key });
      return json(view(updated));
    },

    /** Thumbnail for a photo spot, draft or live (the editor only loads images from itself). */
    async spotImage(A, key) {
      if (!PHOTO_SPOTS[key]) throw new HttpError(404, 'Not found.');
      const which = A.url.searchParams.get('v') === 'live' ? 'live' : 'draft';
      const row = await load(A);
      const p = (row[which] || row.draft).photos[key];
      if (p.id) return routes.photo(A, p.id, 'w-800.jpg');
      const cacheKey = `spotdef:${p.small}`;
      let bytes = await A.env.PHOTOS.get(cacheKey, 'arrayBuffer');
      if (!bytes) {
        const f = A.env.GITHUB_TOKEN ? await github(A.env).getFile(`public${p.small}`) : null;
        if (!f) throw new HttpError(404, 'Photo not found.');
        bytes = f.bytes;
        await A.env.PHOTOS.put(cacheKey, bytes);
      }
      return new Response(bytes, { headers: { 'Content-Type': /\.png$/i.test(p.small) ? 'image/png' : 'image/jpeg', 'Cache-Control': 'private, max-age=300' } });
    },

    async arrange(A) {
      const body = await readJsonBody(A.request);
      const rev = needRevision(body);
      const row = await load(A);
      const byId = new Map(row.draft.slides.map((s) => [s.id, s]));
      const order = Array.isArray(body.order) ? body.order : [];
      if (order.length !== byId.size || !order.every((x) => byId.has(x))) throw new HttpError(409, 'The photos changed since you opened this page. Please click "Reload latest".', { conflict: true });
      const focus = body.focus && typeof body.focus === 'object' ? body.focus : {};
      const alts = body.alts && typeof body.alts === 'object' ? body.alts : {};
      const slides = order.map((id) => {
        const s = byId.get(id);
        const f = typeof focus[id] === 'string' && /^\d{1,3}% \d{1,3}%$/.test(focus[id]) ? focus[id] : s.focus;
        const a = typeof alts[id] === 'string' ? alts[id].slice(0, 200) : s.alt;
        return { ...s, focus: f, alt: a };
      });
      const updated = await write(A, row, { draft: { ...row.draft, slides } }, rev);
      await logEvent(A, 'save-homepage-photos');
      return json(view(updated));
    },

    async remove(A, id) {
      const rev = Number(A.url.searchParams.get('baseRevision'));
      if (!Number.isInteger(rev)) throw new HttpError(400, 'Please refresh the page and try again.');
      const row = await load(A);
      const slides = row.draft.slides.filter((s) => s.id !== id);
      if (slides.length === row.draft.slides.length) throw new HttpError(404, 'That photo was already removed.');
      if (!slides.length) throw new HttpError(422, 'The slideshow needs at least one photo. Add the new photo first, then remove this one.');
      const updated = await write(A, row, { draft: { ...row.draft, slides } }, rev);
      await logEvent(A, 'save-homepage-remove', null, { id });
      return json(view(updated));
    },

    async discard(A) {
      const body = await readJsonBody(A.request);
      const rev = needRevision(body);
      const row = await load(A);
      const updated = await write(A, row, { draft: row.live }, rev);
      await logEvent(A, 'save-homepage-discard');
      return json(view(updated));
    },

    async photo(A, id, suffix) {
      if (!ID_RE.test(id || '')) throw new HttpError(404, 'Not found.');
      const fromSuffix = String(suffix || '').match(/^w-(800|1400|2000)\.jpg$/);
      const q = Number(fromSuffix ? fromSuffix[1] : A.url.searchParams.get('w'));
      const w = HERO_SIZES.includes(q) ? q : 800;
      let bytes = await A.env.PHOTOS.get(`hero:${id}:${w}`, 'arrayBuffer');
      if (!bytes) {
        // Photos that were already on the website before the editor existed: copy from the repo once.
        const row = await readRow(A);
        const slide = [...(row?.draft.slides || []), ...(row?.live?.slides || [])].find((s) => s.id === id);
        const spotted = !slide && [...Object.values(row?.draft.photos || {}), ...Object.values(row?.live?.photos || {})].some((p) => p.id === id);
        if (!slide && !spotted) throw new HttpError(404, 'Photo not found.');
        const f = await github(A.env).getFile(slide ? `public${slide.src}-${w}.jpg` : `${HERO_DIR}/${id}-${w}.jpg`);
        if (!f) throw new HttpError(404, 'Photo not found.');
        bytes = f.bytes;
        await A.env.PHOTOS.put(`hero:${id}:${w}`, bytes);
      }
      return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400' } });
    },

    async preview(A) {
      const row = await load(A);
      const base = publicBase(A.env);
      const srcToId = new Map(row.draft.slides.map((s) => [s.src, s.id]));
      const draftSpotIds = new Set(Object.values(row.draft.photos).map((p) => p.id).filter(Boolean));
      const site = { ...siteContent, ...(row.draft.slides.length ? { heroSlides: row.draft.slides } : {}), heroSlideSeconds: row.draft.seconds, heroFade: row.draft.fade, heroAutoplay: row.draft.autoplay !== false, photos: row.draft.photos };
      // ?page=<photo spot key> previews the page that spot is on; ?path=/about/ previews that page;
      // otherwise the homepage. ?edit=1 adds the editable marks used by the "edit on the page" editor.
      const spot = PHOTO_SPOTS[A.url.searchParams.get('page')];
      const wanted = A.url.searchParams.get('path');
      // Reviews: show the owner's unpublished review changes too, so the page is exactly what Publish will make.
      const rrow = config.features?.reviews !== false ? await A.db.prepare('SELECT draft FROM settings WHERE key = ?').bind('reviews').first() : null;
      const reviews = rrow ? parseReviewsDraft(rrow.draft, reviewsContent.items || []) : (reviewsContent.items || []);
      // Words: the owner's unpublished wording (content/text.json + the site.json fields it lists).
      const trow = await A.db.prepare('SELECT draft FROM settings WHERE key = ?').bind('text').first();
      const words = withDraftWords(site, textContent, trow?.draft);
      // Other draft sources (e.g. a new kind added by following docs/EDITOR.md) merge their draft into `site` here,
      // so the page always shows exactly what Publish will make.
      const ctx = {
        site: words.site, text: words.text, config, reviews, preview: true, editMode: A.url.searchParams.get('edit') === '1', siteUrl: '', buildId: 'preview-' + Date.now(),
        // Slides are written as url(src) + "-800.jpg", so a slide's src maps to a private photo address
        // that the "-<width>.jpg" suffix completes (draft photos aren't public yet).
        url: (p) => {
          if (srcToId.has(p)) return `/api/homepage/photo/${srcToId.get(p)}/w`;
          const m = /^\/assets\/img\/hero\/(s-[a-z0-9]+)-(800|1400|2000)\.jpg$/.exec(p);
          if (m && draftSpotIds.has(m[1])) return `/api/homepage/photo/${m[1]}/w-${m[2]}.jpg`;
          return /^(https?:|mailto:|tel:|sms:)/.test(p) ? p : base + p;
        },
      };
      // The page list is built with the same ctx as the page itself (routes() may read ctx.site / ctx.reviews).
      const known = siteRoutes(ctx).map((r) => r.path);
      const path = spot ? spot.page : (known.includes(wanted) || wanted === '/404' ? wanted : '/');
      const html = path === '/404' ? notFoundHtml(ctx) : renderPath(ctx, path);
      return new Response(markPreview(html), { headers: previewHeaders(base) });
    },

    async publish(A) {
      await rateLimit(A, 'publish');
      if (!A.env.GITHUB_TOKEN) throw new HttpError(503, 'Publishing is not connected yet. Your changes are saved. Please tell your website helper.');
      const body = await readJsonBody(A.request);
      const rev = needRevision(body);
      const row = await load(A);
      if (row.revision !== rev) throw new HttpError(409, 'The homepage photos were changed on another computer. Click "Reload latest" first.', { conflict: true });
      const t = Date.now();
      const lock = await A.db.prepare('UPDATE settings SET lock_until = ? WHERE key = ? AND (lock_until IS NULL OR lock_until < ?)').bind(t + 90_000, KEY, t).run();
      if (!lock.meta.changes) throw new HttpError(409, 'The homepage is already being published. Please wait a minute.');
      try {
        const d = row.draft;
        const gh = github(A.env);
        const result = await gh.commit(`Update website photos${d.slides.length ? `: slideshow (${d.slides.length} photo${d.slides.length === 1 ? '' : 's'}, ${d.autoplay === false ? 'still' : `slideshow, ${d.seconds}s, ${d.fade ? 'fade' : 'slide'}`})` : ''}\n\nBy ${A.user.email} via the owner editor.`, async () => {
          const site = JSON.parse(await gh.getText('content/site.json'));
          if (config.features?.slideshow !== false && d.slides.length) {
            site.heroSlides = d.slides.map(({ id, src, alt, focus }) => ({ id, src, alt, focus }));
            site.heroSlideSeconds = d.seconds;
            site.heroFade = d.fade;
            site.heroAutoplay = d.autoplay !== false;
          }
          // Only store spots that differ from the original photo, so site.json stays tidy.
          const photos = {};
          for (const [k, p] of Object.entries(d.photos || {})) {
            const def = PHOTO_SPOTS[k]?.defaults;
            if (def && (p.id || p.small !== def.small || p.large !== def.large)) photos[k] = p;
          }
          if (Object.keys(photos).length) site.photos = photos; else delete site.photos;
          const problems = [...validateHomepage(site), ...validatePhotos(site, PHOTO_SPOTS)];
          if (problems.length) throw new HttpError(422, 'Something about the photos is not ready: ' + problems[0]);
          const changes = [{ path: 'content/site.json', content: JSON.stringify(site, null, 2) + '\n' }];
          const existing = new Set((await gh.listDir(HERO_DIR)).map((f) => f.name));
          const wanted = new Set();
          for (const s of d.slides) {
            if (!s.src.startsWith('/assets/img/hero/')) continue; // photos that came with the original site stay where they are
            for (const w of HERO_SIZES) {
              const name = `${s.id}-${w}.jpg`;
              wanted.add(name);
              if (existing.has(name)) continue;
              const bytes = await A.env.PHOTOS.get(`hero:${s.id}:${w}`, 'arrayBuffer');
              if (!bytes) throw new HttpError(500, 'A photo is missing from storage. Please remove it and add it again.');
              changes.push({ path: `${HERO_DIR}/${name}`, content: new Uint8Array(bytes) });
            }
          }
          for (const p of Object.values(d.photos || {})) {
            if (!p.id) continue;
            for (const w of HERO_SIZES) {
              const name = `${p.id}-${w}.jpg`;
              wanted.add(name);
              if (existing.has(name)) continue;
              const bytes = await A.env.PHOTOS.get(`hero:${p.id}:${w}`, 'arrayBuffer');
              if (!bytes) throw new HttpError(500, 'A photo is missing from storage. Please replace it again.');
              changes.push({ path: `${HERO_DIR}/${name}`, content: new Uint8Array(bytes) });
            }
          }
          for (const name of existing) if (/^s-[a-z0-9]+-\d+\.jpg$/.test(name) && !wanted.has(name)) changes.push({ path: `${HERO_DIR}/${name}`, content: null });
          return changes;
        });
        const updated = await write(A, row, { live: d, last_commit: result.sha, lock_until: null }, row.revision);
        await logEvent(A, 'publish-homepage', null, { commit: result.sha });
        return { homepage: view(updated), commit: result.sha, checkPath: '/' };
      } finally {
        await A.db.prepare('UPDATE settings SET lock_until = NULL WHERE key = ?').bind(KEY).run();
      }
    },
  };

  return async function handle(A, parts, method) {
    // parts: ['homepage', ...]
    if (parts.length === 1 && method === 'GET') return routes.get(A);
    if (parts[1] === 'settings' && method === 'PUT') return routes.settings(A);
    if (parts[1] === 'photos' && parts.length === 2 && method === 'POST') return idempotent(A, () => routes.add(A));
    if (parts[1] === 'photos' && parts.length === 2 && method === 'PUT') return routes.arrange(A);
    if (parts[1] === 'photos' && parts.length === 3 && method === 'DELETE') return routes.remove(A, parts[2]);
    if (parts[1] === 'photos' && parts[3] === 'replace' && method === 'POST') return idempotent(A, () => routes.replace(A, parts[2]));
    if (parts[1] === 'spot' && parts.length === 3 && method === 'POST') return idempotent(A, () => routes.spot(A, parts[2]));
    if (parts[1] === 'spot' && parts[3] === 'img' && method === 'GET') return routes.spotImage(A, parts[2]);
    if (parts[1] === 'spot' && parts[3] === 'undo' && method === 'POST') return routes.spotUndo(A, parts[2]);
    if (parts[1] === 'photo' && method === 'GET') return routes.photo(A, parts[2], parts[3]);
    if (parts[1] === 'preview' && method === 'GET') return routes.preview(A);
    if (parts[1] === 'publish' && method === 'POST') return idempotent(A, () => routes.publish(A));
    if (parts[1] === 'discard' && method === 'POST') return routes.discard(A);
    throw new HttpError(404, 'Not found.');
  };
}
