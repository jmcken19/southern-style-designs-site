// PARTS LIBRARY – reusable pieces proven on danmckennahomes.com.
// Use only the ones a client needs; each client's own layout/pages (src/site/) decide where they go.
// Styles: public/assets/css/parts.css   Behaviour: public/assets/js/site.js   Docs: docs/PARTS.md
//
// Every function takes `ctx` (built by scripts/build.mjs or the editor preview):
//   ctx.site   – content/site.json        ctx.config – client.config.json
//   ctx.url(p) – turns "/about/" into the right address (testing link vs live site)
//   ctx.preview – true on the testing link and in editor previews (no lead collection, noindex)
//   ctx.text   – content/text.json (all wording: every visible word goes through t()/tBlock()/tList(), src/lib/text.mjs)
import { e, formatDate, newestFirst } from '../lib/core.mjs';
import { sitePhoto } from '../lib/photos.mjs';
import { editMark, ownedBy } from '../lib/editables.mjs';
import { t, tText } from '../lib/text.mjs';

export { newestFirst };

/* ---------- <head> pieces ---------- */

/** Things every page's <head> needs: robots rules for previews, canonical, favicon set, CSS/JS. */
export function headTags(ctx, { path }) {
  const { url, preview } = ctx;
  const canonical = ctx.siteUrl ? ctx.siteUrl.replace(/\/$/, '') + path : '';
  return `${preview ? '<meta name="robots" content="noindex, nofollow, noarchive">' : ''}
${preview && !ctx.editMode ? '<script>try{if(localStorage.getItem("previewBarHidden")==="1")document.documentElement.classList.add("preview-hidden")}catch(e){}</script>' : ''}
${canonical && !preview ? `<link rel="canonical" href="${e(canonical)}">` : ''}
<link rel="icon" href="${url('/favicon.ico')}" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="${url('/assets/img/favicon-32.png')}">
<link rel="apple-touch-icon" href="${url('/assets/img/apple-touch-icon.png')}">
<link rel="stylesheet" href="${url('/assets/css/site.css')}?v=${ctx.buildId}">
<script src="${url('/assets/js/site.js')}?v=${ctx.buildId}" defer></script>`;
}

/** Yellow "Testing preview" strip with a Hide button. Only on the testing link / editor preview. */
export function testingBanner(ctx) {
  if (!ctx.preview) return '';
  const live = ctx.config?.domain?.main ? `https://${ctx.config.domain.main}/` : '';
  return `<div class="preview-bar" role="note"${ownedBy(ctx, 'preview')}>Testing preview – not the live website.${live ? ` <a href="${e(live)}">Go to the live site</a>` : ''}<button type="button" class="preview-bar__hide" data-hide-preview aria-label="Hide this testing banner">Hide ×</button></div>`;
}

/* ---------- Homepage slideshow ---------- */

export function heroSeconds(site) {
  const n = Number(site.heroSlideSeconds);
  return Number.isFinite(n) && n >= 2 && n <= 30 ? n : 7;
}

/**
 * Full-width photo slideshow (owner manages photos, order, speed, slide/fade, slideshow vs still in the editor).
 * `inner` = the HTML shown on top of the photos (headline, buttons).
 */
export function heroSlideshow(ctx, { inner = '', label = 'Welcome', className = '' } = {}) {
  const { site, url } = ctx;
  const slidesData = site.heroSlides || [];
  const slides = slidesData.map((s, i) => `<div class="hero__slide${i === 0 ? ' is-active' : ''}"${i ? ' aria-hidden="true"' : ''}>
      <img src="${url(s.src)}-1400.jpg" srcset="${url(s.src)}-800.jpg 800w, ${url(s.src)}-1400.jpg 1400w, ${url(s.src)}-2000.jpg 2000w" sizes="100vw" alt="${e(s.alt)}" style="object-position:${e(s.focus || '50% 50%')}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
    </div>`).join('');
  const multi = slidesData.length > 1 && site.heroAutoplay !== false;
  return `<section class="hero${site.heroFade ? ' hero--fade' : ' hero--slide'}${className ? ' ' + e(className) : ''}" aria-label="${e(label)}"${multi ? ` data-interval="${heroSeconds(site)}"` : ''}${editMark(ctx, 'slideshow', 'hero', 'Homepage photos')}>
  <div class="hero__slides">${slides}</div>
  <div class="hero__text">${inner}</div>
  ${multi ? `<button class="hero__pause sr-focus" type="button" aria-pressed="false">${t(ctx, 'hero.pause')}</button>` : ''}
</section>`;
}

/* ---------- Single replaceable photo ("photo spot") ---------- */

/** <img> for a photo spot the owner can replace in the editor (see client.config.json → photoSpots). */
export function spotImage(ctx, key, { className = '', width, height, sizes = '100vw', lazy = true } = {}) {
  const p = sitePhoto(ctx.site, ctx.config.photoSpots, key);
  const srcset = p.small !== p.large ? ` srcset="${ctx.url(p.small)} 800w, ${ctx.url(p.large)} 1400w" sizes="${e(sizes)}"` : '';
  return `<img${className ? ` class="${e(className)}"` : ''} src="${ctx.url(p.large)}"${srcset}${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''} alt="${e(p.alt)}"${lazy ? ' loading="lazy"' : ''} decoding="async"${editMark(ctx, 'photo', key, ctx.config.photoSpots?.[key]?.label || '')}>`;
}

/** True while a spot still shows its original photo (e.g. to keep a caption that only fits the original). */
export function spotIsOriginal(ctx, key) {
  return !sitePhoto(ctx.site, ctx.config.photoSpots, key).id;
}

/* ---------- Reviews ---------- */

/** Where the reviews live (client.config.json → reviewsPath, e.g. "/testimonials/" to keep a client's old address). */
export function reviewsPath(ctx) { return ctx.config?.reviewsPath || '/reviews/'; }
export function reviewPath(ctx, t) { return `${reviewsPath(ctx)}${t.slug}/`; }

export function reviewCard(ctx, r, { full = false, maxChars = 170, level = 3, mark = false } = {}) {
  const first = r.text[0];
  const short = !full && first.length > maxChars ? first.slice(0, first.lastIndexOf(' ', maxChars - 5)) + '…' : first;
  const own = ownedBy(ctx, 'reviews'); // the review's own words are changed in the reviews panel
  return `<article class="tcard"${mark ? editMark(ctx, 'review', r.slug, r.title) : ''}>
  <p class="tcard__meta"${own}>${r.client ? `<span>${e(r.client)}</span>` : ''}<time datetime="${e(r.date)}">${formatDate(r.date)}</time></p>
  <h${level} class="tcard__title"${own}><a href="${ctx.url(reviewPath(ctx, r))}">${e(r.title)}</a></h${level}>
  <blockquote${own}><p>${e(short)}</p></blockquote>
  <a class="tcard__more" href="${ctx.url(reviewPath(ctx, r))}" aria-label="${e(tText(ctx, 'reviews.readMore'))}: ${e(r.title)}">${t(ctx, 'reviews.readMore')}</a>
</article>`;
}

/** Full review (for the single-review page). Its words are changed in the reviews panel (ctx: edit marks). */
export function reviewFull(t, ctx = {}) {
  return `<blockquote class="tquote"${ownedBy(ctx, 'reviews')}>${t.text.map((p) => `<p>${e(p)}</p>`).join('')}
  <footer>${t.client ? `<strong>${e(t.client)}</strong>` : ''}${t.role ? ` <span>${e(t.role)}</span>` : ''} <time datetime="${e(t.date)}">${formatDate(t.date)}</time></footer>
</blockquote>`;
}

/**
 * Reviews drifting slowly sideways in an endless loop (all reviews in the order of content/reviews.json – the
 * owner arranges it in the editor – starting at a random one).
 * Drag with mouse or finger; pauses on hover; keyboard users get a Pause button.
 */
export function reviewsRow(ctx, { titleKey = 'reviews.rowTitle', viewAllKey = 'reviews.viewAll', fadeIn = true } = {}) {
  const list = ctx.reviews || [];
  if (!list.length) return '';
  return `<section class="reviews-row" aria-labelledby="rr-h"${fadeIn ? ' data-reveal' : ''}${editMark(ctx, 'reviews', 'row', 'Client reviews')}>
  <div class="wrap">
    <h2 id="rr-h" class="section-title">${t(ctx, titleKey)}</h2>
    <div class="carousel" data-carousel data-marquee>
      <div class="carousel__track" tabindex="0" aria-label="Client reviews – drag or scroll sideways to read more">${list.map((x) => reviewCard(ctx, x)).join('')}</div>
      <div class="carousel__dots" role="group" aria-label="Choose review"></div>
      <button class="marquee-pause sr-focus" type="button" aria-pressed="false" hidden>${t(ctx, 'reviews.pause')}</button>
    </div>
    <p class="center"><a class="btn" href="${ctx.url(reviewsPath(ctx))}">${t(ctx, viewAllKey)}</a></p>
  </div>
</section>`;
}

/* ---------- Contact form ---------- */

/**
 * "Send a message" form. Delivered by FormSubmit (formsubmit.co: free, no account) to
 * content/site.json → contactFormTo (an email, or the random alias FormSubmit gives after activation).
 * Switched off on previews (no lead collection there).
 */
export function contactForm(ctx, { id = 'cf', titleKey = 'form.title', prefill = '', level = 3 } = {}) {
  const { site } = ctx;
  if (!site.contactFormTo) return '';
  const to = encodeURIComponent(site.contactFormTo);
  const off = ctx.preview;
  const next = ctx.siteUrl ? `${ctx.siteUrl.replace(/\/$/, '')}/contact/?sent=1` : '';
  const f = (name, label, type, opts = '') => // label: already-escaped HTML from t()
    `<div class="cform__field"><label for="${id}-${name}">${label}</label><input id="${id}-${name}" name="${name}" type="${type}" ${opts}></div>`;
  return `<form class="cform" data-cform action="https://formsubmit.co/${to}" method="post" data-ajax="https://formsubmit.co/ajax/${to}">
  <h${level} class="cform__title">${t(ctx, titleKey)}</h${level}>
  ${off ? `<p class="cform__note"${ownedBy(ctx, 'preview')}>Testing preview – this form is switched off here.</p>` : ''}
  ${f('name', t(ctx, 'form.name'), 'text', 'autocomplete="name" required maxlength="100"')}
  ${f('email', t(ctx, 'form.email'), 'email', 'autocomplete="email" required maxlength="200"')}
  ${f('phone', `${t(ctx, 'form.phone')} <span class="cform__opt">${t(ctx, 'form.optional')}</span>`, 'tel', 'autocomplete="tel" maxlength="40"')}
  <div class="cform__field"><label for="${id}-message">${t(ctx, 'form.message')}</label><textarea id="${id}-message" name="message" rows="4" required maxlength="3000">${e(prefill)}</textarea></div>
  <input type="hidden" name="_subject" value="New message from ${e(ctx.config?.domain?.main || site.name || 'your website')}">
  <input type="hidden" name="_template" value="table">
  <input type="hidden" name="_captcha" value="false">
  ${next ? `<input type="hidden" name="_next" value="${e(next)}">` : ''}
  <div class="cform__trap" aria-hidden="true"><label>Leave this empty<input type="text" name="_honey" tabindex="-1" autocomplete="off"></label></div>
  <button class="btn btn--accent cform__send" type="submit"${off && !ctx.editMode ? ' disabled' : ''}>${t(ctx, 'form.send')}</button>
  <p class="cform__status" role="status" aria-live="polite"></p>
</form>`;
}

/* ---------- Simple redirect page (old addresses → new ones) ---------- */
export function redirectPage(to, label = 'Continue') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${e(label)}</title><meta name="robots" content="noindex"><link rel="canonical" href="${e(to)}"><meta http-equiv="refresh" content="0; url=${e(to)}"></head><body><p><a href="${e(to)}">${e(label)}</a></p></body></html>`;
}
