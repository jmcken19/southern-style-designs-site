// STARTER PAGES – replace/extend for each client (rebuild THEIR pages with THEIR words).
// Never invent facts, awards, numbers or reviews: copy what the client's current site says, or ask them.
// Every visible word goes through t() / tBlock() / tList() (src/lib/text.mjs): the words live in content/text.json
// (or content/site.json for business facts), and the owner can click and change them in the editor.
import { e } from '../lib/core.mjs';
import { editMark, ownedBy } from '../lib/editables.mjs';
import { t, tBlock, tText } from '../lib/text.mjs';
import { heroSlideshow, reviewsRow, reviewCard, reviewFull, contactForm, spotImage } from '../parts/index.mjs';

const phoneHref = (site) => site.phoneHref || (site.phone ? 'tel:' + site.phone.replace(/[^\d+]/g, '') : '');

/** Call / Text / Email buttons (+ optional message form under them). */
export function contactBox(ctx, { form = true, id = 'ask' } = {}) {
  const { site } = ctx;
  return `<aside class="ask" aria-label="Contact ${e(tText(ctx, 'site.name'))}">
  <h2 class="ask__title">${t(ctx, 'ask.title')}</h2>
  ${site.phone ? `<a class="btn btn--accent" href="${e(phoneHref(site))}">${t(ctx, 'ask.call')} ${t(ctx, 'site.phone')}</a>` : ''}
  ${site.textNumber || site.phone ? `<a class="btn" href="sms:${e((site.textNumber || site.phone).replace(/[^\d+]/g, ''))}">${t(ctx, 'ask.text')}</a>` : ''}
  ${site.email ? `<a class="btn" href="mailto:${e(site.email)}">${t(ctx, 'ask.email')}</a>` : ''}
  ${form && ctx.config.features?.contactForm !== false ? contactForm(ctx, { id, titleKey: 'ask.formTitle' }) : ''}
</aside>`;
}

export function homePage(ctx) {
  const { site } = ctx;
  const inner = `<h1>${t(ctx, 'site.name')}</h1>${site.tagline ? `<p>${t(ctx, 'site.tagline')}</p>` : ''}
    ${site.phone ? `<p class="hero__actions"><a class="btn btn--accent" href="${e(phoneHref(site))}">${t(ctx, 'home.call')} ${t(ctx, 'site.phone')}</a></p>` : ''}`;
  const hero = ctx.config.features?.slideshow !== false && site.heroSlides?.length
    ? heroSlideshow(ctx, { inner })
    : `<section class="intro"><div class="wrap">${inner}</div></section>`;
  return `${hero}
<section class="section"><div class="wrap prose">
  ${site.homeIntro?.length ? tBlock(ctx, 'site.homeIntro') : ''}
</div></section>
${ctx.config.features?.reviews !== false ? reviewsRow(ctx) : ''}`;
}

export function aboutPage(ctx) {
  const { site } = ctx;
  return `<div class="wrap page with-side">
  <div class="prose">
    <h1>${t(ctx, 'site.aboutTitle')}</h1>
    ${ctx.config.photoSpots?.headshot ? spotImage(ctx, 'headshot', { className: 'headshot', width: 360, height: 420, sizes: '360px', lazy: false }) : ''}
    ${site.about?.length ? tBlock(ctx, 'site.about') : ''}
  </div>
  ${contactBox(ctx)}
</div>`;
}

export function contactPage(ctx) {
  const { site } = ctx;
  return `<div class="wrap page">
  <div class="prose">
    <h1>${t(ctx, 'contact.title')}</h1>
    ${site.phone ? `<p><strong>${t(ctx, 'contact.phone')}</strong> <a href="${e(phoneHref(site))}">${t(ctx, 'site.phone')}</a></p>` : ''}
    ${site.email ? `<p><strong>${t(ctx, 'contact.email')}</strong> <a href="mailto:${e(site.email)}">${t(ctx, 'site.email')}</a></p>` : ''}
    ${site.address ? `<p><strong>${t(ctx, 'contact.address')}</strong> ${t(ctx, 'site.address')}</p>` : ''}
    ${site.hours ? `<p><strong>${t(ctx, 'contact.hours')}</strong> ${t(ctx, 'site.hours')}</p>` : ''}
    <div class="contact-form">${ctx.config.features?.contactForm !== false ? contactForm(ctx, { id: 'contact', level: 2 }) : ''}</div>
  </div>
</div>`;
}

export function reviewsPage(ctx) {
  const list = ctx.reviews || []; // the order of content/reviews.json (the owner arranges it in the editor)
  return `<div class="wrap page"${editMark(ctx, 'reviews', 'list', 'Client reviews')}>
  <h1>${t(ctx, 'reviews.title')}</h1>
  <div class="tgrid">${list.map((t) => reviewCard(ctx, t, { level: 2, mark: true })).join('')}</div>
</div>`;
}

export function reviewPage(ctx, r) {
  return `<div class="wrap page with-side">
  <div class="prose">
    <p class="kicker"><a href="${ctx.url(ctx.config.reviewsPath || '/reviews/')}">${t(ctx, 'reviews.back')}</a></p>
    <h1${ownedBy(ctx, 'reviews')}>${e(r.title)}</h1>
    ${reviewFull(r, ctx)}
  </div>
  ${contactBox(ctx)}
</div>`;
}

export function notFoundPage(ctx) {
  return `<div class="wrap page prose">
  <h1>${t(ctx, 'notFound.title')}</h1>
  <p>${t(ctx, 'notFound.before')} <a href="${ctx.url('/')}">${t(ctx, 'notFound.home')}</a> ${t(ctx, 'notFound.or')} <a href="${ctx.url('/contact/')}">${t(ctx, 'notFound.contact')}</a>.</p>
</div>`;
}
