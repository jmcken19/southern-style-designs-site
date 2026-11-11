// Southern Style Designs – pages. One page with sections (hero, about, services, portfolio, reviews, contact),
// plus a reviews list page and "page not found".
// Never invent facts, awards, numbers or reviews. Anything unknown is a [bracketed placeholder] in content/.
// Every visible word goes through t() / tBlock() (src/lib/text.mjs).
import { e } from '../lib/core.mjs';
import { editMark, ownedBy } from '../lib/editables.mjs';
import { t, tBlock, tText } from '../lib/text.mjs';
import { heroSlideshow, spotImage } from '../parts/index.mjs';
import { portfolioCategories } from '../lib/portfolio.mjs';
import { phoneHref } from './layout.mjs';

const SERVICE_KEYS = ['1', '2', '3', '4'];

function hero(ctx) {
  const { site } = ctx;
  const inner = `<h1>${t(ctx, 'hero.title')}</h1>
    ${site.tagline ? `<p class="hero__tagline">${t(ctx, 'site.tagline')}</p>` : ''}
    <p class="hero__actions">
      ${site.phone ? `<a class="btn btn--light" href="${e(phoneHref(site))}">${t(ctx, 'hero.call')} ${t(ctx, 'site.phone')}</a>` : ''}
      <a class="btn btn--accent" href="#contact">${t(ctx, 'hero.book')}</a>
    </p>`;
  return heroSlideshow(ctx, { inner, label: tText(ctx, 'site.name') });
}

function about(ctx) {
  const { site } = ctx;
  return `<section id="about" class="section about" aria-labelledby="about-h">
  <div class="wrap about__in">
    <div class="about__photo">${spotImage(ctx, 'marcie', { className: 'about__img', width: 450, height: 550, sizes: '(min-width: 900px) 420px, 80vw' })}</div>
    <div class="about__text">
      <p class="about__place">${t(ctx, 'about.place')}</p>
      <h2 id="about-h">${t(ctx, 'site.aboutTitle')}</h2>
      ${site.about?.length ? tBlock(ctx, 'site.about') : ''}
    </div>
  </div>
</section>`;
}

function services(ctx) {
  return `<section id="services" class="section services" aria-labelledby="services-h">
  <div class="wrap">
    <h2 id="services-h" class="section-title">${t(ctx, 'services.title')}</h2>
    <p class="section-intro">${t(ctx, 'services.intro')}</p>
    <ul class="services__grid">${SERVICE_KEYS.map((k) => `<li class="service">
      <h3>${t(ctx, `services.${k}.title`)}</h3>
      <p>${t(ctx, `services.${k}.body`)}</p>
    </li>`).join('')}</ul>
    <p class="center"><a class="btn" href="#contact">${t(ctx, 'services.cta')}</a></p>
  </div>
</section>`;
}

function portfolio(ctx) {
  const items = ctx.site.portfolio || [];
  const cats = portfolioCategories(ctx.config);
  const own = ownedBy(ctx, 'portfolio');
  const card = (w) => `<li class="work" data-cat="${e(w.category)}">
      <figure>
        <img src="${ctx.url(w.src)}-1400.jpg" srcset="${ctx.url(w.src)}-800.jpg 800w, ${ctx.url(w.src)}-1400.jpg 1400w, ${ctx.url(w.src)}-2000.jpg 2000w" sizes="(min-width: 1000px) 31vw, (min-width: 600px) 46vw, 92vw" width="800" height="600" alt="${e(w.alt || w.title)}" loading="lazy" decoding="async">
        <figcaption><span class="work__title"${own}>${e(w.title)}</span><span class="work__cat">${t(ctx, `portfolio.cat.${w.category}`)}</span></figcaption>
      </figure>
    </li>`;
  return `<section id="portfolio" class="section portfolio" aria-labelledby="portfolio-h"${editMark(ctx, 'portfolio', 'gallery', 'Portfolio')}>
  <div class="wrap">
    <h2 id="portfolio-h" class="section-title">${t(ctx, 'portfolio.title')}</h2>
    <p class="section-intro">${t(ctx, 'portfolio.intro')}</p>
    <div class="filters" role="group" aria-labelledby="filters-label">
      <span id="filters-label" class="filters__label">${t(ctx, 'portfolio.filter')}</span>
      <button type="button" class="filter" data-filter="all" aria-pressed="true">${t(ctx, 'portfolio.all')}</button>
      ${cats.map((c) => `<button type="button" class="filter" data-filter="${e(c.key)}" aria-pressed="false">${t(ctx, `portfolio.cat.${c.key}`)}</button>`).join('')}
    </div>
    <ul class="works" data-works>${items.map(card).join('')}</ul>
    <p class="works__none" data-works-none hidden>${t(ctx, 'portfolio.none')}</p>
  </div>
</section>`;
}

function reviewSlot(ctx, r) {
  const own = ownedBy(ctx, 'reviews');
  return `<li class="review" data-review="${e(r.slug)}"${editMark(ctx, 'review', r.slug, r.title)}>
    <h3 class="review__title"${own}>${e(r.title)}</h3>
    <blockquote${own}>${r.text.map((p) => `<p>${e(p)}</p>`).join('')}</blockquote>
    ${r.client ? `<p class="review__by"${own}>${e(r.client)}</p>` : ''}
  </li>`;
}

function reviews(ctx, { id = 'reviews', level = 2, titleKey = 'reviews.title', max = 0 } = {}) {
  const all = ctx.reviews || []; // the order of content/reviews.json (the owner arranges it in the editor)
  const list = max ? all.slice(0, max) : all;
  return `<section id="${id}" class="section reviews" aria-labelledby="${id}-h"${editMark(ctx, 'reviews', 'list', 'Reviews')}>
  <div class="wrap">
    <h${level} id="${id}-h" class="section-title">${t(ctx, titleKey)}</h${level}>
    <p class="badge"><span class="badge__stars" aria-hidden="true">★★★★★</span> <span>${t(ctx, 'reviews.badge')}</span> <span class="badge__verify">${t(ctx, 'reviews.verify')}</span></p>
    <ul class="reviews__list">${list.map((r) => reviewSlot(ctx, r)).join('')}</ul>
    ${max ? `<p class="center reviews__all"><a class="btn" href="${ctx.url(ctx.config.reviewsPath || '/reviews/')}">${t(ctx, 'reviews.all')}</a></p>` : ''}
  </div>
</section>`;
}

function contact(ctx) {
  const { site } = ctx;
  const f = (name, label, type, opts = '') =>
    `<div class="cform__field"><label for="cf-${name}">${label}</label><input id="cf-${name}" name="${name}" type="${type}" ${opts}></div>`;
  return `<section id="contact" class="section contact" aria-labelledby="contact-h">
  <div class="wrap contact__in">
    <div class="contact__info">
      <h2 id="contact-h">${t(ctx, 'contact.title')}</h2>
      <p>${t(ctx, 'contact.intro')}</p>
      <dl class="contact__list">
        ${site.phone ? `<div><dt>${t(ctx, 'contact.phone')}</dt><dd><a href="${e(phoneHref(site))}">${t(ctx, 'site.phone')}</a></dd></div>` : ''}
        ${site.address ? `<div><dt>${t(ctx, 'contact.address')}</dt><dd>${t(ctx, 'site.address')}</dd></div>` : ''}
        ${site.hours ? `<div><dt>${t(ctx, 'contact.hours')}</dt><dd>${t(ctx, 'site.hours')}</dd></div>` : ''}
      </dl>
      ${site.phone ? `<p><a class="btn btn--accent" href="${e(phoneHref(site))}">${t(ctx, 'contact.call')} ${t(ctx, 'site.phone')}</a></p>` : ''}
      <div class="map-slot" role="img" aria-label="${e(tText(ctx, 'contact.map'))}"><p>${t(ctx, 'contact.map')}</p></div>
    </div>
    <form class="cform" data-demo-form novalidate>
      <h3 class="cform__title">${t(ctx, 'form.title')}</h3>
      ${f('name', t(ctx, 'form.name'), 'text', 'autocomplete="name" required maxlength="100"')}
      ${f('email', t(ctx, 'form.email'), 'email', 'autocomplete="email" required maxlength="200"')}
      ${f('phone', `${t(ctx, 'form.phone')} <span class="cform__opt">${t(ctx, 'form.optional')}</span>`, 'tel', 'autocomplete="tel" maxlength="40"')}
      <div class="cform__field"><label for="cf-message">${t(ctx, 'form.message')}</label><textarea id="cf-message" name="message" rows="5" required maxlength="3000"></textarea></div>
      <button class="btn btn--accent cform__send" type="submit">${t(ctx, 'form.send')}</button>
      <p class="cform__status" role="status" aria-live="polite" data-demo-msg hidden>${t(ctx, 'form.demo')}</p>
    </form>
  </div>
</section>`;
}

export function homePage(ctx) {
  return `${hero(ctx)}
${about(ctx)}
${services(ctx)}
${portfolio(ctx)}
${ctx.config.features?.reviews !== false ? reviews(ctx, { max: 3 }) : ''}
${contact(ctx)}`;
}

export function reviewsPage(ctx) {
  return `<div class="page">
  <p class="wrap"><a href="${ctx.url('/')}">${t(ctx, 'reviews.back')}</a></p>
  ${reviews(ctx, { id: 'all-reviews', level: 1, titleKey: 'reviews.pageTitle' })}
</div>`;
}

export function notFoundPage(ctx) {
  return `<div class="wrap page prose">
  <h1>${t(ctx, 'notFound.title')}</h1>
  <p>${t(ctx, 'notFound.before')} <a href="${ctx.url('/')}">${t(ctx, 'notFound.home')}</a> ${t(ctx, 'notFound.or')} <a href="${ctx.url('/#contact')}">${t(ctx, 'notFound.contact')}</a>.</p>
</div>`;
}
