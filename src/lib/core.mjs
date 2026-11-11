// Small shared helpers used by the website build AND the owner editor (runs in Node and in a Cloudflare Worker).

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
export const e = escapeHtml;

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export function randomId(prefix, bytes = 8) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return prefix + Array.from(a, (b) => (b % 36).toString(36)).join('');
}

/** "2025-09-09" → "09/09/2025" (change here if a client prefers another format). */
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[2]}/${m[3]}/${m[1]}` : escapeHtml(iso);
}

/** Newest first; keeps the original order for equal dates. Reviews are shown in the order of content/reviews.json
 *  (the owner arranges it in the editor); this is only for a one-time sort of an older client's file. */
export function newestFirst(list) {
  return list.map((t, i) => [t, i]).sort((a, b) => String(b[0].date).localeCompare(String(a[0].date)) || a[1] - b[1]).map((x) => x[0]);
}

/* ---------- Homepage slideshow ---------- */
export const HERO_SPEEDS = { slow: 10, normal: 7, fast: 4 };
export const HERO_SIZES = [800, 1400, 2000];
export const MAX_HERO_SLIDES = 12;
const HERO_SRC_RE = /^\/assets\/img\/(hero-\d{1,2}|hero\/s-[a-z0-9]{6,32})$/;

/** Validate the slideshow part of content/site.json. Returns a list of problems (empty = fine). */
export function validateSlideshow(site) {
  const p = [];
  const slides = site?.heroSlides;
  if (slides === undefined) return p; // this client has no slideshow
  if (!Array.isArray(slides) || slides.length < 1) p.push('heroSlides needs at least one photo');
  else {
    if (slides.length > MAX_HERO_SLIDES) p.push(`heroSlides can have at most ${MAX_HERO_SLIDES} photos`);
    const ids = new Set();
    slides.forEach((s, i) => {
      if (!/^s-[a-z0-9]{3,32}$/.test(s.id || '')) p.push(`heroSlides[${i}].id must look like s-xxxxxx`);
      if (ids.has(s.id)) p.push(`heroSlides[${i}].id is duplicated`);
      ids.add(s.id);
      if (!HERO_SRC_RE.test(s.src || '')) p.push(`heroSlides[${i}].src must be /assets/img/hero-N or /assets/img/hero/<id> (files <src>-800.jpg, -1400.jpg, -2000.jpg)`);
      if (typeof s.alt !== 'string' || s.alt.length > 200) p.push(`heroSlides[${i}].alt must be text (max 200)`);
      if (s.focus && !/^\d{1,3}% \d{1,3}%$/.test(s.focus)) p.push(`heroSlides[${i}].focus must look like "50% 50%"`);
    });
  }
  const n = site?.heroSlideSeconds;
  if (!(typeof n === 'number' && n >= 2 && n <= 30)) p.push('heroSlideSeconds must be a number from 2 to 30');
  if (typeof site?.heroFade !== 'boolean') p.push('heroFade must be true or false');
  if (site?.heroAutoplay !== undefined && typeof site.heroAutoplay !== 'boolean') p.push('heroAutoplay must be true or false');
  return p;
}

/** client.config.json → reviewsPath must look like "/reviews/" or "/our-clients/testimonials/" (slash at both ends). */
export function validateReviewsPath(p) {
  if (p === undefined) return [];
  return /^\/([a-z0-9-]+\/)+$/.test(String(p)) ? [] : [`reviewsPath "${p}" must start and end with a slash, e.g. "/testimonials/"`];
}
